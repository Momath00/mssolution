from django.conf import settings
from rest_framework.exceptions import NotAuthenticated
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .authentication import ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME


def _set_token_cookie(response, name, value, max_age):
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        path='/',
    )


class CookieTokenObtainPairView(TokenObtainPairView):
    """Comme TokenObtainPairView, mais pose access/refresh en cookies httpOnly au lieu de les renvoyer en JSON."""

    def finalize_response(self, request, response, *args, **kwargs):
        if response.status_code == 200 and 'access' in response.data:
            access = response.data.pop('access')
            refresh = response.data.pop('refresh', None)
            _set_token_cookie(
                response, ACCESS_COOKIE_NAME, access,
                int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            )
            if refresh:
                _set_token_cookie(
                    response, REFRESH_COOKIE_NAME, refresh,
                    int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
                )
            response.data = {'detail': 'ok'}
        return super().finalize_response(request, response, *args, **kwargs)


class CookieTokenRefreshView(TokenRefreshView):
    """Lit le refresh token depuis le cookie httpOnly plutôt que le corps de la requête."""

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if refresh is None:
            raise NotAuthenticated('Aucun refresh token.')

        serializer = TokenRefreshSerializer(data={'refresh': refresh})
        serializer.is_valid(raise_exception=True)

        response = Response({'detail': 'ok'})
        access = serializer.validated_data['access']
        _set_token_cookie(
            response, ACCESS_COOKIE_NAME, access,
            int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        )
        new_refresh = serializer.validated_data.get('refresh')
        if new_refresh:
            _set_token_cookie(
                response, REFRESH_COOKIE_NAME, new_refresh,
                int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            )
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({'detail': 'ok'})
        response.delete_cookie(ACCESS_COOKIE_NAME, path='/')
        response.delete_cookie(REFRESH_COOKIE_NAME, path='/')
        return response
