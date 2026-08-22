import logging
from fastapi import HTTPException, status

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Supabase JWT secret can be used for HS256 verification, but for
# simplicity and "allow all permissions by default" mode, we accept any token
# and auto-resolve users as DISTRICT_ADMIN. This covers the development use case
# where Supabase Auth provides tokens but all permissions are open.

SUPABASE_JWT_SECRET = getattr(settings, "supabase_jwt_secret", None)


async def verify_token(token: str) -> dict:
    """
    Verify an incoming auth token.

    Priority order:
    1. Mock tokens (token starts with 'mock-') — accepted in any mode.
    2. Supabase JWT — decoded with HS256 using the JWT secret if configured.
    3. Fallback — if no secret or decode fails, still accept and return a
       default district-admin claim so all permissions are available.

    User wants "allow all permissions by default", so we never hard-block.
    """

    # --- Mock token path (dev / testing) ---
    if token.startswith("mock-"):
        uid = token
        email = f"{token.replace('mock-', '').replace('-', '.')}@aarogyagrid.org"
        name = token.replace("mock-", "").replace("-", " ").title()
        return {
            "sub": uid,
            "firebase_uid": uid,   # kept for backward compat
            "supabase_uid": uid,
            "email": email,
            "name": name,
        }

    # --- Try Supabase JWT decode ---
    if SUPABASE_JWT_SECRET:
        try:
            import jwt  # PyJWT
            decoded = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            uid = decoded.get("sub", token[:32])
            return {
                "sub": uid,
                "firebase_uid": uid,
                "supabase_uid": uid,
                "email": decoded.get("email", f"{uid}@user.aarogyagrid.org"),
                "name": decoded.get("name") or decoded.get("email", "Supabase User"),
            }
        except Exception as e:
            logger.warning(f"Supabase JWT decode warning: {e} — allowing with default claims")

    # --- Fallback: grant full access (all permissions by default) ---
    # In open-access mode, every request is treated as a DISTRICT_ADMIN.
    fallback_uid = f"anon-{token[:16]}" if len(token) >= 16 else "anon-user"
    return {
        "sub": fallback_uid,
        "firebase_uid": fallback_uid,
        "supabase_uid": fallback_uid,
        "email": "admin@aarogyagrid.org",
        "name": "AarogyaGrid Admin",
    }


# Backward-compat alias used by dependencies.py
async def verify_firebase_token(token: str) -> dict:
    return await verify_token(token)
