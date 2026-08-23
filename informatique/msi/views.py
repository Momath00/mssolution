import logging
from datetime import date

from django.core.files.base import ContentFile
from django.db.models import ProtectedError
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .contrats import creer_contrat, creer_facture_solde
from .emails import (
    envoyer_confirmation_paiement,
    envoyer_contact,
    envoyer_contrat_signe,
    envoyer_demande_soumission,
    envoyer_document,
    envoyer_rapport_comptable,
    envoyer_soumission_refusee,
)
from .models import (
    Client,
    CompteGrandLivre,
    Contrat,
    Coordonnees,
    Depense,
    Document,
    Evenement,
    RapportComptableArchive,
    Realisation,
)
from .excel import generer_excel_rapport_comptable
from .pagination import PaginationStandard
from .pdf import generer_pdf_document, generer_rapport_comptable
from .serializers import (
    ClientSerializer,
    CompteGrandLivreSerializer,
    ContactSerializer,
    ContratSerializer,
    CoordonneesSerializer,
    DemandeSoumissionSerializer,
    DepenseSerializer,
    DocumentSerializer,
    EvenementSerializer,
    RapportComptableArchiveSerializer,
    RealisationSerializer,
    RepondreSoumissionSerializer,
    SoumissionPubliqueSerializer,
)


class IsAuthenticatedOrReadOnlyPublished(IsAuthenticated):
    """Lecture publique (limitée aux réalisations publiées côté queryset), écriture réservée aux connectés."""

    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return super().has_permission(request, view)


class RealisationViewSet(viewsets.ModelViewSet):
    serializer_class = RealisationSerializer
    permission_classes = [IsAuthenticatedOrReadOnlyPublished]

    def get_queryset(self):
        qs = Realisation.objects.all()
        if not (self.request.user and self.request.user.is_authenticated):
            qs = qs.filter(statut='publie')
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    queryset = Client.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                'Impossible de supprimer ce client : il a des soumissions ou factures associées. '
                'Supprimez-les d\'abord, ou conservez le client.',
            )


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PaginationStandard

    def get_queryset(self):
        queryset = Document.objects.select_related('client', 'contrat_lie', 'contrat').prefetch_related(
            'lignes', 'contrat__factures_liees',
        )
        type_document = self.request.query_params.get('type_document')
        if type_document:
            queryset = queryset.filter(type_document=type_document)
        return queryset

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                'Impossible de supprimer cette soumission : elle a déjà un contrat signé. '
                'Annulez le contrat si nécessaire, ou conservez la soumission comme archive.',
            )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        ancien_statut = serializer.instance.statut
        document = serializer.save()
        if ancien_statut != 'payee' and document.statut == 'payee':
            envoyer_confirmation_paiement(document)

    @action(detail=True, methods=['post'])
    def envoyer(self, request, pk=None):
        document = self.get_object()
        envoyer_document(document)
        document.statut = 'envoyee'
        document.save(update_fields=['statut'])
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        document = self.get_object()
        pdf_bytes = generer_pdf_document(document)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{document.numero}.pdf"'
        return response


class SoumissionPubliqueView(APIView):
    """Consultation publique d'une soumission par son token — utilisée sur la page de signature."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request, token):
        document = get_object_or_404(
            Document.objects.select_related('client').prefetch_related('lignes'),
            token=token, type_document='soumission',
        )
        return Response(SoumissionPubliqueSerializer(document).data)


class SoumissionRepondreView(APIView):
    """Acceptation ou refus public d'une soumission — crée le contrat signé si acceptée."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request, token):
        document = get_object_or_404(
            Document.objects.select_related('client').prefetch_related('lignes'),
            token=token, type_document='soumission',
        )
        if document.statut in ('acceptee', 'refusee'):
            raise ValidationError('Cette soumission a déjà reçu une réponse.')
        if document.statut == 'brouillon':
            raise ValidationError("Cette soumission n'a pas encore été envoyée.")
        if document.date_echeance and document.date_echeance < date.today():
            raise ValidationError("Cette soumission a expiré et ne peut plus être signée.")

        serializer = RepondreSoumissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data['reponse'] == 'acceptee':
            # Le signataire n'a pas à retaper son nom — le client est déjà identifié dans le
            # système, on utilise directement son contact enregistré (ou le nom d'entreprise
            # à défaut de contact précisé).
            nom_signataire = (
                data.get('nom_signataire', '').strip()
                or document.client.nom_contact
                or document.client.nom_entreprise
            )
            contrat = creer_contrat(
                document, request, nom_signataire, data.get('signature_image', ''),
            )
            # Le contrat (et la facture d'acompte, le cas échéant) existent déjà en base à ce
            # stade — un échec d'envoi du courriel ne doit pas faire échouer l'acceptation elle-
            # même côté client, ni renvoyer une erreur pour une opération en réalité réussie.
            try:
                envoyer_contrat_signe(contrat)
            except Exception:
                logging.getLogger(__name__).exception(
                    "Échec de l'envoi du contrat signé %s", contrat.numero,
                )
        else:
            document.statut = 'refusee'
            document.date_reponse = timezone.now()
            document.save(update_fields=['statut', 'date_reponse'])
            envoyer_soumission_refusee(document)

        document.refresh_from_db()
        return Response(SoumissionPubliqueSerializer(document).data)


class SoumissionContratPdfView(APIView):
    """Téléchargement public du contrat signé — sécurisé par le token de la soumission, pas par authentification."""

    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request, token):
        document = get_object_or_404(
            Document.objects.select_related('contrat'), token=token, type_document='soumission',
        )
        if document.statut != 'acceptee' or not hasattr(document, 'contrat'):
            raise Http404
        contrat = document.contrat
        response = HttpResponse(contrat.pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{contrat.numero}.pdf"'
        return response


class ContratViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    """
    Lecture + suppression seulement — jamais de création ni de modification par l'API :
    un contrat est toujours généré automatiquement à la signature d'une soumission
    (voir creer_contrat) et fige des montants/conditions qui ne doivent plus changer,
    c'est ce qui en fait une preuve fiable en cas de litige.
    """

    serializer_class = ContratSerializer
    permission_classes = [IsAuthenticated]
    queryset = Contrat.objects.select_related('soumission').prefetch_related('factures_liees')

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        contrat = self.get_object()
        response = HttpResponse(contrat.pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{contrat.numero}.pdf"'
        return response

    @action(detail=True, methods=['post'])
    def annuler(self, request, pk=None):
        contrat = self.get_object()
        contrat.statut = 'annule' if contrat.statut == 'actif' else 'actif'
        contrat.save(update_fields=['statut'])
        return Response(self.get_serializer(contrat).data)

    @action(detail=True, methods=['post'], url_path='facturer-solde')
    def facturer_solde(self, request, pk=None):
        contrat = self.get_object()
        facture = creer_facture_solde(contrat)
        return Response(DocumentSerializer(facture).data, status=status.HTTP_201_CREATED)


class CompteGrandLivreViewSet(viewsets.ModelViewSet):
    serializer_class = CompteGrandLivreSerializer
    permission_classes = [IsAuthenticated]
    queryset = CompteGrandLivre.objects.all()


class DepenseViewSet(viewsets.ModelViewSet):
    serializer_class = DepenseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PaginationStandard
    queryset = Depense.objects.select_related('compte_grand_livre')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class EvenementViewSet(viewsets.ModelViewSet):
    serializer_class = EvenementSerializer
    permission_classes = [IsAuthenticated]
    queryset = Evenement.objects.select_related('client')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CoordonneesView(APIView):
    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        coordonnees = Coordonnees.load()
        return Response(CoordonneesSerializer(coordonnees).data)

    def put(self, request):
        coordonnees = Coordonnees.load()
        serializer = CoordonneesSerializer(coordonnees, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        return self.put(request)


class ContactView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        serializer = ContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        envoyer_contact(**serializer.validated_data)
        return Response({'detail': 'ok'}, status=status.HTTP_201_CREATED)


class DemandeSoumissionView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        serializer = DemandeSoumissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        envoyer_demande_soumission(**serializer.validated_data)
        return Response({'detail': 'ok'}, status=status.HTTP_201_CREATED)


MOIS_ABREGES = [
    'janv', 'févr', 'mars', 'avr', 'mai', 'juin',
    'juill', 'août', 'sept', 'oct', 'nov', 'déc',
]


def _six_derniers_mois(today):
    mois = []
    y, m = today.year, today.month
    for _ in range(6):
        mois.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(mois))


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        # « payee » vaut revenu reçu peu importe le type — une soumission acceptée dont le
        # client a payé directement (sans facture séparée) compte autant qu'une facture réglée.
        revenu_mois = Document.objects.filter(
            statut='payee',
            date_creation__year=today.year,
            date_creation__month=today.month,
        )
        chiffre_affaires_total = Document.objects.filter(statut='payee')

        revenu_par_mois = []
        for (y, m) in _six_derniers_mois(today):
            docs_du_mois = Document.objects.filter(
                statut='payee', date_creation__year=y, date_creation__month=m,
            )
            revenu_par_mois.append({
                'mois': f'{MOIS_ABREGES[m - 1]} {y}',
                'total': sum((doc.total for doc in docs_du_mois), start=0),
            })

        soumissions_recentes = Document.objects.filter(
            type_document='soumission', statut__in=['acceptee', 'refusee', 'payee'],
        ).select_related('client').prefetch_related('lignes').order_by('-date_reponse')[:5]

        return Response({
            'realisations_publiees': Realisation.objects.filter(statut='publie').count(),
            'factures_totales': Document.objects.filter(type_document='facture').count(),
            'factures_en_attente': Document.objects.filter(
                type_document='facture', statut__in=['brouillon', 'envoyee'],
            ).count(),
            'revenu_du_mois': sum((doc.total for doc in revenu_mois), start=0),
            'clients_actifs': Client.objects.count(),
            'chiffre_affaires_total': sum((doc.total for doc in chiffre_affaires_total), start=0),
            'revenu_par_mois': revenu_par_mois,
            'soumissions_en_attente': Document.objects.filter(
                type_document='soumission', statut='envoyee',
            ).count(),
            'soumissions_recentes': [
                {
                    'id': doc.id,
                    'numero': doc.numero,
                    'client_nom': doc.client.nom_entreprise,
                    'statut': doc.statut,
                    'date_reponse': doc.date_reponse,
                    'total': doc.total,
                }
                for doc in soumissions_recentes
            ],
        })


def _annee_trimestre(request):
    try:
        annee = int(request.query_params.get('annee', date.today().year))
        trimestre = int(request.query_params.get('trimestre', (date.today().month - 1) // 3 + 1))
    except (TypeError, ValueError):
        raise ValidationError('Paramètres « annee » et « trimestre » invalides.')
    if trimestre not in (1, 2, 3, 4):
        raise ValidationError('Le trimestre doit être compris entre 1 et 4.')
    return annee, trimestre


def _archiver_rapport(annee, trimestre, pdf_bytes, excel_bytes):
    """Conserve (ou remplace) la copie archivée du rapport pour ce trimestre — voir en cas de litige/problème."""
    archive, _ = RapportComptableArchive.objects.get_or_create(annee=annee, trimestre=trimestre)
    archive.pdf.save(f'Rapport-comptable-T{trimestre}-{annee}.pdf', ContentFile(pdf_bytes), save=False)
    archive.excel.save(f'Rapport-comptable-T{trimestre}-{annee}.xlsx', ContentFile(excel_bytes), save=True)


def _generer_et_archiver_rapport(annee, trimestre):
    pdf_bytes = generer_rapport_comptable(annee, trimestre)
    excel_bytes = generer_excel_rapport_comptable(annee, trimestre)
    _archiver_rapport(annee, trimestre, pdf_bytes, excel_bytes)
    return pdf_bytes, excel_bytes


class RapportComptableView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        annee, trimestre = _annee_trimestre(request)
        pdf_bytes, _ = _generer_et_archiver_rapport(annee, trimestre)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="Rapport-comptable-T{trimestre}-{annee}.pdf"'
        return response


class RapportComptableExcelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        annee, trimestre = _annee_trimestre(request)
        _, excel_bytes = _generer_et_archiver_rapport(annee, trimestre)
        response = HttpResponse(
            excel_bytes, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="Rapport-comptable-T{trimestre}-{annee}.xlsx"'
        return response


class RapportComptableEnvoyerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        annee, trimestre = _annee_trimestre(request)
        coordonnees = Coordonnees.load()
        if not coordonnees.courriel_comptable:
            raise ValidationError(
                "Aucun courriel de comptable n'est configuré. Ajoutez-le dans Paramètres avant d'envoyer le rapport.",
            )
        pdf_bytes, excel_bytes = _generer_et_archiver_rapport(annee, trimestre)
        envoyer_rapport_comptable(pdf_bytes, excel_bytes, annee, trimestre)
        return Response({'detail': 'ok'})


class RapportComptableArchiveViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet,
):
    """
    Lecture + suppression seulement — les archives sont produites automatiquement lors de la
    génération/l'envoi d'un rapport (voir _archiver_rapport), jamais créées ni modifiées à la main.
    """

    serializer_class = RapportComptableArchiveSerializer
    permission_classes = [IsAuthenticated]
    queryset = RapportComptableArchive.objects.all()

    def perform_destroy(self, instance):
        instance.pdf.delete(save=False)
        instance.excel.delete(save=False)
        instance.delete()

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        archive = self.get_object()
        response = HttpResponse(archive.pdf.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="Rapport-comptable-T{archive.trimestre}-{archive.annee}.pdf"'
        return response

    @action(detail=True, methods=['get'])
    def excel(self, request, pk=None):
        archive = self.get_object()
        if not archive.excel:
            raise Http404
        response = HttpResponse(
            archive.excel.read(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = (
            f'attachment; filename="Rapport-comptable-T{archive.trimestre}-{archive.annee}.xlsx"'
        )
        return response
