from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .auth_views import CookieTokenObtainPairView, CookieTokenRefreshView, LogoutView
from .views import (
    ClientViewSet,
    CompteGrandLivreViewSet,
    ContactView,
    CoordonneesView,
    DashboardStatsView,
    DemandeSoumissionView,
    DepenseViewSet,
    DocumentViewSet,
    EvenementViewSet,
    RapportComptableEnvoyerView,
    RapportComptableView,
    RealisationViewSet,
)

router = DefaultRouter()
router.register('realisations', RealisationViewSet, basename='realisation')
router.register('clients', ClientViewSet, basename='client')
router.register('documents', DocumentViewSet, basename='document')
router.register('evenements', EvenementViewSet, basename='evenement')
router.register('comptes-grand-livre', CompteGrandLivreViewSet, basename='compte-grand-livre')
router.register('depenses', DepenseViewSet, basename='depense')

urlpatterns = [
    path('auth/token/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('coordonnees/', CoordonneesView.as_view(), name='coordonnees'),
    path('contact/', ContactView.as_view(), name='contact'),
    path('demande-soumission/', DemandeSoumissionView.as_view(), name='demande-soumission'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('rapport-comptable/', RapportComptableView.as_view(), name='rapport-comptable'),
    path('rapport-comptable/envoyer/', RapportComptableEnvoyerView.as_view(), name='rapport-comptable-envoyer'),
    path('', include(router.urls)),
]
