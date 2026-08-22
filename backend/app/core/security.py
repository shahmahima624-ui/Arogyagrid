import logging
from fastapi import HTTPException, status
import jwt

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def verify_token(token: str) -> dict:
    """
    Strict JWT token verification. Fails closed with 401 Unauthorized for missing,
    invalid, expired, malformed, wrong-issuer, or wrong-audience tokens.

    Authentication Provider: Supabase (HS256 using SUPABASE_JWT_SECRET).
    Audience: SUPABASE_JWT_AUDIENCE env var (typically 'authenticated').
    Issuer: SUPABASE_JWT_ISSUER env var (Supabase project URL).

    Development/Test: Mock tokens beginning with 'mock-' are accepted ONLY when
    MOCK_AUTH=true and ENVIRONMENT is 'development' or 'test'.
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

    # --- 2. Supabase JWT Verification ---
    # Only SUPABASE_JWT_SECRET is used — generic SECRET_KEY is NOT a valid JWT fallback.
    jwt_secret = settings.supabase_jwt_secret
    if not jwt_secret:
        logger.error("SUPABASE_JWT_SECRET not configured — cannot verify external JWT tokens.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication service not configured. Contact administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Build decode options — verify audience and issuer if configured
    decode_options: dict = {}
    decode_kwargs: dict = {
        "algorithms": ["HS256"],
        "options": decode_options,
    }

    if settings.supabase_jwt_audience:
        decode_kwargs["audience"] = settings.supabase_jwt_audience
    else:
        # Audience not configured — skip verification but log a warning in production
        decode_options["verify_aud"] = False
        if settings.environment.lower() == "production":
            logger.warning(
                "SUPABASE_JWT_AUDIENCE not configured. Audience claim not verified. "
                "Set SUPABASE_JWT_AUDIENCE=authenticated for production."
            )

    if settings.supabase_jwt_issuer:
        decode_kwargs["issuer"] = settings.supabase_jwt_issuer
    else:
        decode_options["verify_iss"] = False

    try:
        decoded = jwt.decode(token, jwt_secret, **decode_kwargs)
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
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token audience mismatch — token not intended for this service",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidIssuerError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token issuer mismatch — token not issued by the expected provider",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        logger.warning(f"JWT verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature or payload",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_firebase_token(token: str) -> dict:
    return await verify_token(token)
