from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .auth_views import CookieTokenObtainPairView, CookieTokenRefreshView, LogoutView
from .views import (
    ClientViewSet,
    ContactView,
    CoordonneesView,
    DashboardStatsView,
    DemandeSoumissionView,
    DocumentViewSet,
    RealisationViewSet,
)

router = DefaultRouter()
router.register('realisations', RealisationViewSet, basename='realisation')
router.register('clients', ClientViewSet, basename='client')
router.register('documents', DocumentViewSet, basename='document')

urlpatterns = [
    path('auth/token/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('coordonnees/', CoordonneesView.as_view(), name='coordonnees'),
    path('contact/', ContactView.as_view(), name='contact'),
    path('demande-soumission/', DemandeSoumissionView.as_view(), name='demande-soumission'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('', include(router.urls)),
]
