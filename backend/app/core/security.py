import logging
from fastapi import HTTPException, status
import jwt

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def verify_token(token: str) -> dict:
    """
    Strict JWT token verification. Fails closed with 401 Unauthorized for missing,
    invalid, expired, or malformed tokens.
    """
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --- 1. Development/Test Mock Token Path ---
    if token.startswith("mock-"):
        if not settings.mock_auth or settings.environment.lower() not in ("development", "test"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Mock authentication disabled in production",
                headers={"WWW-Authenticate": "Bearer"},
            )
        uid = token
        email = f"{token.replace('mock-', '').replace('-', '.')}@aarogyagrid.org"
        name = token.replace("mock-", "").replace("-", " ").title()
        return {
            "sub": uid,
            "firebase_uid": uid,
            "supabase_uid": uid,
            "email": email,
            "name": name,
        }

    # --- 2. Supabase / Standard JWT Verification ---
    jwt_secret = settings.supabase_jwt_secret or settings.secret_key
    if jwt_secret:
        try:
            decoded = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            uid = decoded.get("sub") or decoded.get("user_id") or token[:32]
            return {
                "sub": uid,
                "firebase_uid": uid,
                "supabase_uid": uid,
                "email": decoded.get("email", f"{uid}@user.aarogyagrid.org"),
                "name": decoded.get("name") or decoded.get("email", "Authenticated User"),
            }
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.PyJWTError as e:
            logger.warning(f"JWT verification error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature or payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def verify_firebase_token(token: str) -> dict:
    return await verify_token(token)
