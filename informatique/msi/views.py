import logging
import mimetypes
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.files.base import ContentFile
from django.db.models import ProtectedError, Sum
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
    envoyer_recu_paiement,
    envoyer_soumission_refusee,
)
from .models import (
    ArticleCatalogue,
    Client,
    CompteGrandLivre,
    Contrat,
    Coordonnees,
    Depense,
    Document,
    Echeance,
    Evenement,
    Paiement,
    RapportComptableArchive,
    Realisation,
)
from .excel import generer_excel_comptes_a_recevoir, generer_excel_rapport_comptable
from .paiements import (
    attacher_preuve,
    comptes_a_recevoir,
    factures_a_recevoir,
    ventes_emises,
    definir_echeancier,
    enregistrer_paiement,
    envoyer_rappel,
    plan_valide,
    supprimer_paiement,
)
from .pagination import PaginationStandard
from .pdf import generer_pdf_document, generer_rapport_comptable
from .rappels import executer_rappels
from .serializers import (
    ArticleCatalogueSerializer,
    ClientSerializer,
    CompteGrandLivreSerializer,
    ContactSerializer,
    ContratSerializer,
    CoordonneesSerializer,
    DemandeSoumissionSerializer,
    DepenseSerializer,
    DocumentSerializer,
    EcheancierSerializer,
    ParametresRappelsSerializer,
    EnregistrerPaiementSerializer,
    PreuvePaiementSerializer,
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
            'lignes', 'contrat__factures_liees', 'paiements', 'echeances',
        )
        type_document = self.request.query_params.get('type_document')
        if type_document:
            queryset = queryset.filter(type_document=type_document)
        statut = self.request.query_params.get('statut')
        if statut:
            queryset = queryset.filter(statut__in=statut.split(','))
        return queryset

    def _document_a_jour(self, pk):
        """Relit le document avec ses paiements/versements frais, pour la réponse."""
        return self.get_queryset().get(pk=pk)

    def perform_destroy(self, instance):
        # La suppression en cascade ne passe pas par Paiement.delete() : on retire les
        # fichiers de preuve nous-mêmes, sinon ils resteraient orphelins sur le disque.
        preuves = [p.preuve for p in instance.paiements.all() if p.preuve]
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                'Impossible de supprimer cette soumission : elle a déjà un contrat signé. '
                'Annulez le contrat si nécessaire, ou conservez la soumission comme archive.',
            )
        for preuve in preuves:
            preuve.delete(save=False)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        ancien_statut = serializer.instance.statut
        document = serializer.save()
        # Les factures ont leur propre reçu, envoyé à chaque paiement enregistré.
        if document.type_document == 'soumission' and ancien_statut != 'payee' and document.statut == 'payee':
            envoyer_confirmation_paiement(document)

    @action(detail=True, methods=['post'])
    def envoyer(self, request, pk=None):
        document = self.get_object()
        if not plan_valide(document):
            raise ValidationError(
                'Le plan de paiement ne correspond plus au total (les lignes ont changé). '
                'Modifiez le plan avant d’envoyer.'
            )
        envoyer_document(document)
        document.date_envoi = timezone.now()
        if document.type_document == 'facture':
            # Renvoyer une facture déjà (partiellement) payée ne doit pas effacer son statut.
            if document.statut == 'brouillon':
                document.statut = 'envoyee'
            document.save(update_fields=['statut', 'date_envoi'])
            document.recalculer_statut()
        else:
            document.statut = 'envoyee'
            # Un (re)envoi repart d'un cycle de relances neuf (ex. après avoir prolongé la date).
            document.date_relance_soumission = None
            document.date_rappel_expiration = None
            document.date_alerte_expiration = None
            document.save(update_fields=[
                'statut', 'date_envoi', 'date_relance_soumission', 'date_rappel_expiration',
                'date_alerte_expiration',
            ])
        return Response(self.get_serializer(self._document_a_jour(document.pk)).data)

    @action(detail=True, methods=['post'])
    def paiements(self, request, pk=None):
        """Enregistre un montant reçu du client ; le solde et le statut se recalculent."""
        document = self.get_object()
        serializer = EnregistrerPaiementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        paiement = enregistrer_paiement(
            document, montant=data['montant'], date=data['date'], mode=data['mode'],
            reference=data['reference'], note=data['note'], utilisateur=request.user,
            preuve=data.get('preuve'),
        )
        recu_envoye = False
        if data['envoyer_recu']:
            # Le paiement est déjà enregistré : un courriel qui échoue ne doit pas l'annuler.
            try:
                envoyer_recu_paiement(paiement)
                recu_envoye = True
            except Exception:
                logging.getLogger(__name__).exception(
                    "Échec de l'envoi du reçu de paiement (facture %s)", document.numero,
                )
        donnees = self.get_serializer(self._document_a_jour(document.pk)).data
        return Response(
            {'document': donnees, 'recu_envoye': recu_envoye},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['delete'], url_path=r'paiements/(?P<paiement_id>\d+)')
    def retirer_paiement(self, request, pk=None, paiement_id=None):
        document = self.get_object()
        supprimer_paiement(document, int(paiement_id))
        return Response(self.get_serializer(self._document_a_jour(document.pk)).data)

    @action(detail=True, methods=['get', 'post', 'delete'], url_path=r'paiements/(?P<paiement_id>\d+)/preuve')
    def preuve(self, request, pk=None, paiement_id=None):
        """
        GET : affiche la preuve (photo/PDF) d'un paiement — réservé aux utilisateurs connectés.
        POST : ajoute ou remplace la preuve. DELETE : la retire.
        """
        document = self.get_object()
        paiement = get_object_or_404(document.paiements, pk=paiement_id)
        if request.method == 'GET':
            if not paiement.preuve:
                raise Http404
            type_contenu = mimetypes.guess_type(paiement.preuve.name)[0] or 'application/octet-stream'
            with paiement.preuve.open('rb') as fichier:
                response = HttpResponse(fichier.read(), content_type=type_contenu)
            nom = paiement.preuve.name.rsplit('/', 1)[-1]
            response['Content-Disposition'] = f'inline; filename="{nom}"'
            return response
        if request.method == 'DELETE':
            if paiement.preuve:
                paiement.preuve.delete(save=True)
        else:
            serializer = PreuvePaiementSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            attacher_preuve(paiement, serializer.validated_data['preuve'])
        return Response(self.get_serializer(self._document_a_jour(document.pk)).data)

    @action(detail=True, methods=['put'])
    def echeancier(self, request, pk=None):
        """Remplace le plan de paiement (versements aux dates et montants choisis)."""
        document = self.get_object()
        serializer = EcheancierSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        definir_echeancier(document, serializer.validated_data['versements'])
        return Response(self.get_serializer(self._document_a_jour(document.pk)).data)

    @action(detail=True, methods=['post'])
    def rappel(self, request, pk=None):
        """Envoie tout de suite un rappel de paiement au client (solde et versements en retard)."""
        document = self.get_object()
        envoyer_rappel(document)
        return Response(self.get_serializer(self._document_a_jour(document.pk)).data)

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
            Document.objects.select_related('client', 'contrat').prefetch_related('lignes', 'echeances'),
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
    queryset = Contrat.objects.select_related('soumission').prefetch_related(
        'factures_liees__lignes', 'factures_liees__paiements',
    )

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


class ArticleCatalogueViewSet(viewsets.ModelViewSet):
    serializer_class = ArticleCatalogueSerializer
    permission_classes = [IsAuthenticated]
    queryset = ArticleCatalogue.objects.all()


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


class ParametresRappelsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ParametresRappelsSerializer(Coordonnees.load()).data)

    def put(self, request):
        serializer = ParametresRappelsSerializer(Coordonnees.load(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ExecuterRappelsView(APIView):
    """Lance les rappels du jour depuis le tableau de bord — ou seulement les simule."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        simulation = str(request.data.get('simulation', 'true')).lower() in ('1', 'true', 'oui')
        return Response(executer_rappels(simulation=simulation))


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
MOIS_COMPLETS = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]


def _mois_precedents(today, nombre):
    """Les `nombre` derniers mois (année, mois), du plus ancien au mois courant."""
    mois = []
    y, m = today.year, today.month
    for _ in range(nombre):
        mois.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(mois))


def _premier_du_mois(y, m):
    return date(y, m, 1)


def _mois_suivant(y, m):
    return (y + 1, 1) if m == 12 else (y, m + 1)


def _encaisse(debut, fin):
    """
    Argent réellement reçu entre `debut` (inclus) et `fin` (exclu) : les paiements enregistrés
    sur les factures, plus les soumissions marquées payées directement (sans facture ni
    paiements détaillés), comptées à leur date.
    """
    paiements = Paiement.objects.filter(date__gte=debut, date__lt=fin).aggregate(total=Sum('montant'))['total']
    soumissions = Document.objects.filter(
        type_document='soumission', statut='payee',
        date_creation__date__gte=debut, date_creation__date__lt=fin,
    ).exclude(contrat__factures_liees__isnull=False).prefetch_related('lignes')
    return (paiements or Decimal('0')) + sum((doc.total for doc in soumissions), Decimal('0'))


def _a_faire(today):
    """Ce qui demande ton attention dans les 7 prochains jours."""
    dans_7_jours = today + timedelta(days=7)

    versements = []
    for facture in factures_a_recevoir():
        if facture.solde_du <= 0:
            continue
        etats = facture.etat_echeances(today)
        if etats:
            candidats = [(e['echeance'].date, e['reste']) for e in etats if e['reste'] > 0]
        else:
            candidats = [(facture.date_echeance, facture.solde_du)] if facture.date_echeance else []
        for date_prevue, montant in candidats:
            if today <= date_prevue <= dans_7_jours:
                versements.append({
                    'facture_id': facture.id, 'numero': facture.numero,
                    'client': facture.client.nom_entreprise, 'date': date_prevue, 'montant': montant,
                })
    versements.sort(key=lambda v: v['date'])

    soumissions_expirent = [
        {
            'id': s.id, 'numero': s.numero, 'client': s.client.nom_entreprise,
            'date_echeance': s.date_echeance, 'jours': (s.date_echeance - today).days, 'total': s.total,
        }
        for s in Document.objects.filter(
            type_document='soumission', statut='envoyee',
            date_echeance__gte=today, date_echeance__lte=dans_7_jours,
        ).select_related('client').prefetch_related('lignes').order_by('date_echeance')
    ]

    factures_brouillon = [
        {'id': f.id, 'numero': f.numero, 'client': f.client.nom_entreprise, 'total': f.total}
        for f in Document.objects.filter(type_document='facture', statut='brouillon')
        .select_related('client').prefetch_related('lignes').order_by('date_creation')
    ]

    # Rappels automatiques envoyés aujourd'hui (voir rappels.py).
    depuis = timezone.make_aware(datetime.combine(today, time.min))
    rappels = sum(
        Document.objects.filter(**{f'{champ}__gte': depuis}).count()
        for champ in (
            'date_relance_soumission', 'date_rappel_expiration', 'date_alerte_expiration',
            'date_derniere_relance', 'date_rappel_avant_echeance',
        )
    ) + Echeance.objects.filter(date_rappel_avant__gte=depuis).values('document').distinct().count()

    return {
        'versements_semaine': versements,
        'total_versements_semaine': sum((v['montant'] for v in versements), Decimal('0')),
        'soumissions_expirent': soumissions_expirent,
        'factures_brouillon': factures_brouillon,
        'rappels_aujourdhui': rappels,
    }


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()

        # Encaissé ce mois vs le mois précédent.
        debut_mois = _premier_du_mois(today.year, today.month)
        y_prec, m_prec = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        debut_mois_prec = _premier_du_mois(y_prec, m_prec)
        demain = today + timedelta(days=1)

        # Facturé vs encaissé, 12 derniers mois (une requête chacun, réparti en Python).
        mois = _mois_precedents(today, 12)
        debut_serie = _premier_du_mois(*mois[0])
        facture_par_mois = {}
        for vente in ventes_emises(debut_serie, demain):
            local = timezone.localtime(vente.date_creation)
            cle = (local.year, local.month)
            facture_par_mois[cle] = facture_par_mois.get(cle, Decimal('0')) + vente.total
        serie = []
        for (y, m) in mois:
            debut = _premier_du_mois(y, m)
            fin = _premier_du_mois(*_mois_suivant(y, m))
            serie.append({
                'mois': f'{MOIS_ABREGES[m - 1]} {y}',
                'facture': facture_par_mois.get((y, m), Decimal('0')),
                'encaisse': _encaisse(debut, fin),
            })

        recevoir = comptes_a_recevoir(today)
        en_retard = [f for f in recevoir['factures'] if f['jours_retard'] > 0]

        # Taux d'acceptation des soumissions ayant reçu une réponse dans les 12 derniers mois.
        repondues = Document.objects.filter(
            type_document='soumission', date_reponse__date__gte=debut_serie,
        )
        nb_acceptees = repondues.filter(statut__in=['acceptee', 'payee']).count()
        nb_repondues = repondues.filter(statut__in=['acceptee', 'payee', 'refusee']).count()

        en_attente = Document.objects.filter(
            type_document='soumission', statut='envoyee',
        ).prefetch_related('lignes')

        soumissions_recentes = Document.objects.filter(
            type_document='soumission', statut__in=['acceptee', 'refusee', 'payee'],
        ).select_related('client').prefetch_related('lignes').order_by('-date_reponse')[:5]

        il_y_a_un_an = timezone.now() - timedelta(days=365)
        return Response({
            'date': today,
            'mois_courant': MOIS_COMPLETS[today.month - 1],
            'mois_precedent': MOIS_COMPLETS[m_prec - 1],
            'encaisse_mois': _encaisse(debut_mois, demain),
            'encaisse_mois_precedent': _encaisse(debut_mois_prec, debut_mois),
            'comptes_a_recevoir': recevoir['total_du'],
            'nb_factures_a_recevoir': len(recevoir['factures']),
            'montant_en_retard': recevoir['total_en_retard'],
            'factures_en_retard': len(en_retard),
            'clients_en_retard': len({f['client_id'] for f in en_retard}),
            'facture_annee': sum(
                (v.total for v in ventes_emises(date(today.year, 1, 1), demain)), Decimal('0'),
            ),
            'soumissions_en_attente': en_attente.count(),
            'soumissions_en_attente_montant': sum((s.total for s in en_attente), Decimal('0')),
            'taux_acceptation': round(100 * nb_acceptees / nb_repondues) if nb_repondues else None,
            'soumissions_repondues': nb_repondues,
            'clients_actifs': Client.objects.filter(
                documents__date_creation__gte=il_y_a_un_an,
            ).exclude(documents__statut='brouillon').distinct().count(),
            'clients_total': Client.objects.count(),
            'realisations_publiees': Realisation.objects.filter(statut='publie').count(),
            'serie_12_mois': serie,
            'a_faire': _a_faire(today),
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


class ComptesARecevoirView(APIView):
    """Tout l'argent qu'on te doit, classé par retard (âge des comptes), par facture et par client."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(comptes_a_recevoir())


class ComptesARecevoirExcelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        excel_bytes = generer_excel_comptes_a_recevoir(comptes_a_recevoir())
        response = HttpResponse(
            excel_bytes, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="Comptes-a-recevoir-{date.today()}.xlsx"'
        return response


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
