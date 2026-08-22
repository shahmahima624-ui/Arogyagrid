import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import User, UserRole, Facility, District, Warehouse, StockTransfer
from app.core.security import verify_token

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency to extract and verify the authorization token.
    Fails closed with 401 Unauthorized if token is missing, invalid, or expired.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = await verify_token(credentials.credentials)
    firebase_uid = claims.get("firebase_uid") or claims.get("sub")

    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid identity claims",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Lookup user in database
    user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
    if user:
        if user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive"
            )
        return user

    # 2. Provision mock users in dev/test mode if mock token
    if firebase_uid.startswith("mock-"):
        role = UserRole.DISTRICT_ADMIN.value
        if "facility-admin" in firebase_uid:
            role = UserRole.FACILITY_ADMIN.value
        elif "warehouse-manager" in firebase_uid:
            role = UserRole.WAREHOUSE_MANAGER.value
        elif "staff" in firebase_uid:
            role = UserRole.HEALTHCARE_STAFF.value

        district = db.scalar(select(District))
        district_id = district.id if district else None
        facility_id = None

        if role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
            all_facilities = db.scalars(select(Facility)).all()
            for f in all_facilities:
                clean_name = f.name.lower().replace("phc", "").replace("chc", "").strip()
                token_parts = firebase_uid.lower().split("-")
                if any(part in clean_name for part in token_parts if len(part) > 2):
                    facility_id = f.id
                    district_id = f.district_id
                    break

            if not facility_id and all_facilities:
                facility_id = all_facilities[0].id
                district_id = all_facilities[0].district_id

        user = User(
            firebase_uid=firebase_uid,
            name=claims.get("name", "Mock User"),
            email=claims.get("email", f"{firebase_uid}@aarogyagrid.org"),
            role=role,
            facility_id=facility_id,
            district_id=district_id,
            status="ACTIVE"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    # 3. For real unprovisioned users, assign lowest safe role (HEALTHCARE_STAFF) without admin rights
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Account not provisioned. Contact your District Health Administrator."
    )


def require_role(allowed_roles: list[UserRole]):
    """
    Dependency factory to restrict endpoints by user role.
    """
    def dependency(user: User = Depends(get_current_user)):
        if user.role not in [role.value for role in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{user.role}' not permitted for this operation"
            )
        return user
    return dependency


def verify_scope(
    user: User, 
    facility_id: uuid.UUID | None = None, 
    warehouse_id: uuid.UUID | None = None,
    district_id: uuid.UUID | None = None,
    db: Session | None = None
) -> None:
    """
    Strict server-side resource scoping validation.
    """
    if user.role == UserRole.DISTRICT_ADMIN.value:
        if district_id and user.district_id and user.district_id != district_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot access resources outside your assigned district"
            )
        return

    if user.role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
        if warehouse_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Facility users cannot access warehouse resources"
            )
        if facility_id is not None and user.facility_id != facility_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to access this facility"
            )

    elif user.role == UserRole.WAREHOUSE_MANAGER.value:
        if facility_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Warehouse managers cannot access facility resources"
            )
        if warehouse_id is not None and db is not None:
            warehouse = db.get(Warehouse, warehouse_id)
            if warehouse and user.district_id and warehouse.district_id != user.district_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Cannot access a warehouse outside your assigned district"
                )


def verify_transfer_scope(user: User, transfer: StockTransfer, db: Session) -> None:
    """
    Verify user scope against a specific stock transfer record.
    """
    if user.role == UserRole.DISTRICT_ADMIN.value:
        return

    if user.role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
        if user.facility_id not in (transfer.source_facility_id, transfer.destination_facility_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Transfer does not involve your assigned facility"
            )

    elif user.role == UserRole.WAREHOUSE_MANAGER.value:
        if not transfer.source_warehouse_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Warehouse manager can only manage warehouse dispatch transfers"
            )
        warehouse = db.get(Warehouse, transfer.source_warehouse_id)
        if warehouse and user.district_id and warehouse.district_id != user.district_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Transfer belongs to a warehouse outside your district"
            )
