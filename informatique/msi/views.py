from datetime import date

from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .emails import envoyer_contact, envoyer_demande_soumission, envoyer_document
from .models import Client, Coordonnees, Document, Realisation
from .pdf import generer_pdf_document
from .serializers import (
    ClientSerializer,
    ContactSerializer,
    CoordonneesSerializer,
    DemandeSoumissionSerializer,
    DocumentSerializer,
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
