from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    """Return a lightweight service liveness response."""
    return {"status": "ok", "service": "AarogyaGrid API"}
