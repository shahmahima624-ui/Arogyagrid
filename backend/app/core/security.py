import logging
import time
import jwt
import httpx
from fastapi import HTTPException, status
from cryptography.x509 import load_pem_x509_certificate
from cryptography.hazmat.backends import default_backend

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken-system@system.gserviceaccount.com"
_certs_cache = {}
_certs_expiry = 0

async def get_google_public_keys():
    """Fetch public keys from Google and cache them."""
    global _certs_cache, _certs_expiry
    now = time.time()
    if _certs_cache and now < _certs_expiry:
        return _certs_cache

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(GOOGLE_CERTS_URL)
            if response.status_code == 200:
                # Cache control headers can tell us expiry, but we cache for 1 hour by default
                _certs_cache = response.json()
                _certs_expiry = now + 3600
                return _certs_cache
    except Exception as e:
        logger.error(f"Failed to fetch Firebase public keys: {e}")
        if _certs_cache:
            return _certs_cache  # Fallback to expired cache if fetch fails
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )
    return {}

def get_public_key_from_cert(pem_cert_str: str):
    """Convert PEM certificate string to cryptography public key object."""
    cert = load_pem_x509_certificate(pem_cert_str.encode("utf-8"), default_backend())
    return cert.public_key()

async def verify_firebase_token(token: str) -> dict:
    """
    Decode and verify a Firebase ID token.
    If settings.mock_auth is True and the token begins with 'mock-',
    bypasses real verification and returns mock claims.
    """
    if settings.mock_auth and token.startswith("mock-"):
        # Support mock tokens for local development
        # Format: 'mock-district-admin' or 'mock-facility-admin-sanand' or 'mock-warehouse-manager'
        uid = token
        email = f"{token.replace('mock-', '')}@aarogyagrid.org"
        name = token.replace("mock-", "").replace("-", " ").title()
        return {
            "firebase_uid": uid,
            "email": email,
            "name": name,
            "uid": uid
        }

    if not settings.firebase_project_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase Project ID is not configured on the server."
        )

    try:
        # Extract the token header to find the kid (Key ID)
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token header: missing key ID"
            )

        public_keys = await get_google_public_keys()
        pem_cert = public_keys.get(kid)
        if not pem_cert:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: unknown public key ID"
            )

        # PyJWT expects public key or cert
        # We load the public key from the x509 cert
        public_key = get_public_key_from_cert(pem_cert)

        project_id = settings.firebase_project_id
        decoded_token = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}"
        )
        
        # Format claims consistently
        decoded_token["firebase_uid"] = decoded_token.get("sub")
        return decoded_token

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )
