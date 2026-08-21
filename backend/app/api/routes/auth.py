from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import User
from app.schemas.core import UserOut
from app.core.dependencies import get_current_user

router = APIRouter()

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get the profile of the currently logged-in user.
    """
    return current_user


@router.post("/sync", response_model=UserOut)
def sync_user(current_user: User = Depends(get_current_user)):
    """
    Sync/Register a user. If the user doesn't exist in the database,
    the get_current_user dependency will handle creation/lookup,
    and this endpoint will return their profile details.
    """
    return current_user
