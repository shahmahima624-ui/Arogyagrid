from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.core import User, UserRole
from app.schemas.backup import BackupSnapshotResponse, RestoreRequest, RestoreResponse
from app.services import backup_service

router = APIRouter()
settings = get_settings()


@router.post("/create", response_model=BackupSnapshotResponse)
def create_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DISTRICT_ADMIN])),
):
    """
    Exports a complete JSON database snapshot of districts, facilities, medicines, and inventory batches.
    Requires DISTRICT_ADMIN role.
    """
    return backup_service.create_backup_snapshot(db=db, user=current_user)


@router.post("/restore", response_model=RestoreResponse)
def restore_backup(
    body: RestoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.DISTRICT_ADMIN])),
):
    """
    Restores relational database tables from a valid JSON backup snapshot.
    Requires DISTRICT_ADMIN role and ALLOW_BACKUP_RESTORE setting.
    """
    if not settings.allow_backup_restore and settings.environment.lower() not in ("development", "test"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Database restore operation is disabled in current environment settings"
        )
    return backup_service.restore_backup_snapshot(db=db, snapshot_json=body.snapshot_json, user=current_user)
