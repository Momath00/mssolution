from datetime import date

from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .emails import envoyer_contact, envoyer_demande_soumission, envoyer_document, envoyer_rapport_comptable
from .models import Client, CompteGrandLivre, Coordonnees, Depense, Document, Evenement, Realisation
from .pdf import generer_pdf_document, generer_rapport_comptable
from .serializers import (
    ClientSerializer,
    CompteGrandLivreSerializer,
    ContactSerializer,
    CoordonneesSerializer,
    DemandeSoumissionSerializer,
    DepenseSerializer,
    DocumentSerializer,
    EvenementSerializer,
    RealisationSerializer,
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


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]
    queryset = Document.objects.select_related('client').prefetch_related('lignes')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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


class CompteGrandLivreViewSet(viewsets.ModelViewSet):
    serializer_class = CompteGrandLivreSerializer
    permission_classes = [IsAuthenticated]
    queryset = CompteGrandLivre.objects.all()


class DepenseViewSet(viewsets.ModelViewSet):
    serializer_class = DepenseSerializer
    permission_classes = [IsAuthenticated]
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
        revenu_mois = Document.objects.filter(
            type_document='facture',
            statut='payee',
            date_creation__year=today.year,
            date_creation__month=today.month,
        )
        chiffre_affaires_total = Document.objects.filter(type_document='facture', statut='payee')

        revenu_par_mois = []
        for (y, m) in _six_derniers_mois(today):
            docs_du_mois = Document.objects.filter(
                type_document='facture', statut='payee', date_creation__year=y, date_creation__month=m,
            )
            revenu_par_mois.append({
                'mois': f'{MOIS_ABREGES[m - 1]} {y}',
                'total': sum((doc.total for doc in docs_du_mois), start=0),
            })

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


class RapportComptableView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        annee, trimestre = _annee_trimestre(request)
        pdf_bytes = generer_rapport_comptable(annee, trimestre)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="Rapport-comptable-T{trimestre}-{annee}.pdf"'
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
        pdf_bytes = generer_rapport_comptable(annee, trimestre)
        envoyer_rapport_comptable(pdf_bytes, annee, trimestre)
        return Response({'detail': 'ok'})
