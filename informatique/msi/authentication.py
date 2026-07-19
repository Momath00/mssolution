from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

ACCESS_COOKIE_NAME = 'access'
REFRESH_COOKIE_NAME = 'refresh'


class CookieJWTAuthentication(JWTAuthentication):
    """Lit le token d'accès depuis un cookie httpOnly plutôt que le header Authorization."""

    def authenticate(self, request):
        raw_token = request.COOKIES.get(ACCESS_COOKIE_NAME)
        if raw_token is None:
            return None
        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            return None
        return self.get_user(validated_token), validated_token
