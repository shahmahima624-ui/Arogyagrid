import uuid
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.core import User
from app.schemas.reports import DispatchManifestResponse
from app.services import report_service

router = APIRouter()


@router.get("/export-csv")
def export_csv(
    type: str = Query(default="inventory", description="inventory | transfers | audit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exports clean CSV report for inventory, transfers, or audit logs.
    """
    csv_data = report_service.generate_csv_export(db=db, export_type=type)
    filename = f"arogyagrid_{type}_{current_user.role.lower()}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/dispatch-manifest/{transfer_id}", response_model=DispatchManifestResponse)
def get_dispatch_manifest(
    transfer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates official National Health Mission stock dispatch manifest for printable PDF verification.
    """
    return report_service.generate_dispatch_manifest(db=db, transfer_id=transfer_id)
