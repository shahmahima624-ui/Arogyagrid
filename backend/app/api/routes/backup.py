from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import User
from app.schemas.backup import BackupSnapshotResponse, RestoreRequest, RestoreResponse
from app.services import backup_service

router = APIRouter()


@router.post("/create", response_model=BackupSnapshotResponse)
def create_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exports a complete JSON database snapshot of districts, facilities, medicines, and inventory batches.
    """
    return backup_service.create_backup_snapshot(db=db)


@router.post("/restore", response_model=RestoreResponse)
def restore_backup(
    body: RestoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Restores relational database tables from a valid JSON backup snapshot.
    """
    return backup_service.restore_backup_snapshot(db=db, snapshot_json=body.snapshot_json)
