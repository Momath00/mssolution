from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .auth_views import CookieTokenObtainPairView, CookieTokenRefreshView, LogoutView
from .views import (
    ClientViewSet,
    CompteGrandLivreViewSet,
    ContactView,
    ContratViewSet,
    CoordonneesView,
    DashboardStatsView,
    DemandeSoumissionView,
    DepenseViewSet,
    DocumentViewSet,
    EvenementViewSet,
    RapportComptableArchiveViewSet,
    RapportComptableEnvoyerView,
    RapportComptableExcelView,
    RapportComptableView,
    RealisationViewSet,
    SoumissionContratPdfView,
    SoumissionPubliqueView,
    SoumissionRepondreView,
)

router = DefaultRouter()
router.register('realisations', RealisationViewSet, basename='realisation')
router.register('clients', ClientViewSet, basename='client')
router.register('documents', DocumentViewSet, basename='document')
router.register('contrats', ContratViewSet, basename='contrat')
router.register('evenements', EvenementViewSet, basename='evenement')
router.register('comptes-grand-livre', CompteGrandLivreViewSet, basename='compte-grand-livre')
router.register('depenses', DepenseViewSet, basename='depense')
router.register('rapports-comptables', RapportComptableArchiveViewSet, basename='rapport-comptable-archive')

urlpatterns = [
    path('auth/token/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('coordonnees/', CoordonneesView.as_view(), name='coordonnees'),
    path('contact/', ContactView.as_view(), name='contact'),
    path('demande-soumission/', DemandeSoumissionView.as_view(), name='demande-soumission'),
    path('soumission-publique/<uuid:token>/', SoumissionPubliqueView.as_view(), name='soumission-publique'),
    path(
        'soumission-publique/<uuid:token>/repondre/',
        SoumissionRepondreView.as_view(),
        name='soumission-repondre',
    ),
    path(
        'soumission-publique/<uuid:token>/contrat-pdf/',
        SoumissionContratPdfView.as_view(),
        name='soumission-contrat-pdf',
    ),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('rapport-comptable/', RapportComptableView.as_view(), name='rapport-comptable'),
    path('rapport-comptable/excel/', RapportComptableExcelView.as_view(), name='rapport-comptable-excel'),
    path('rapport-comptable/envoyer/', RapportComptableEnvoyerView.as_view(), name='rapport-comptable-envoyer'),
    path('', include(router.urls)),
]
