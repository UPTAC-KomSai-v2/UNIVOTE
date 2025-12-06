from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import User

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        print("=" * 50)
        print("AUTHENTICATION ATTEMPT")
        print("All cookies:", dict(request.COOKIES))
        
        raw_token = request.COOKIES.get('access_token')
        print(f"Access token: {raw_token[:50] if raw_token else None}...")
        
        if raw_token is None:
            print("❌ No access_token found")
            return None
        
        try:
            validated_token = self.get_validated_token(raw_token)
            print("✅ Token validated")
            print(f"Token payload: {validated_token.payload}")
        except Exception as e:
            print(f"❌ Token validation error: {type(e).__name__}: {e}")
            return None
        
        try:
            user = self.get_user(validated_token)
            print(f"User from get_user: {user}")
        except Exception as e:
            print(f"❌ get_user error: {type(e).__name__}: {e}")
            # Try manual lookup
            try:
                email = validated_token.get('email')
                print(f"Trying manual lookup with email: {email}")
                user = User.objects.get(email=email)
                print(f"✅ User found manually: {user.email}")
            except Exception as e2:
                print(f"❌ Manual lookup failed: {e2}")
                return None
        
        if user is None:
            print("❌ User is None")
            raise AuthenticationFailed("User not found")
        
        print(f"✅ Returning user: {user.email}")
        print("=" * 50)
        return (user, validated_token)