import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import User, UserRole, Facility, District
from app.core.security import verify_token

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency to extract and verify the authorization token.
    Supports Supabase JWT, mock tokens, and open-access anon mode.
    All new users are created with DISTRICT_ADMIN role (allow all permissions).
    """
    # If no credentials, grant anonymous district-admin access
    if not credentials:
        token = "anon-default"
        claims = {"firebase_uid": "anon-default", "email": "admin@aarogyagrid.org", "name": "Admin"}
    else:
        token = credentials.credentials
        claims = await verify_token(token)

    firebase_uid = claims.get("firebase_uid")
    
    # Try to find the user in the database
    user = db.scalar(select(User).where(User.firebase_uid == firebase_uid))
    
    if user:
        return user
        
    # Auto-create user with DISTRICT_ADMIN role (all permissions by default)
    if True:  # Always create/auto-sync unknown users
        # Determine role from token hints, but default to DISTRICT_ADMIN
        role = UserRole.DISTRICT_ADMIN.value
        if firebase_uid.startswith("mock-"):
            if "facility-admin" in firebase_uid:
                role = UserRole.FACILITY_ADMIN.value
            elif "warehouse-manager" in firebase_uid:
                role = UserRole.WAREHOUSE_MANAGER.value
            elif "staff" in firebase_uid:
                role = UserRole.HEALTHCARE_STAFF.value
            
        # Get first district
        district = db.scalar(select(District))
        district_id = district.id if district else None
        
        # Resolve facility_id if applicable
        facility_id = None
        if role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
            # Try to match facility name from token (e.g. mock-facility-admin-sanand)
            all_facilities = db.scalars(select(Facility)).all()
            for f in all_facilities:
                # e.g. "Sanand" in "PHC Sanand"
                clean_name = f.name.lower().replace("phc", "").replace("chc", "").strip()
                token_parts = firebase_uid.lower().split("-")
                if any(part in clean_name for part in token_parts if len(part) > 2):
                    facility_id = f.id
                    district_id = f.district_id
                    break
            
            # Fallback to first facility if no match
            if not facility_id and all_facilities:
                facility_id = all_facilities[0].id
                district_id = all_facilities[0].district_id

        # Create new mock user
        user = User(
            firebase_uid=firebase_uid,
            name=claims.get("name", "Mock User"),
            email=claims.get("email", "mock@aarogyagrid.org"),
            role=role,
            facility_id=facility_id,
            district_id=district_id,
            status="ACTIVE"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user




def require_role(allowed_roles: list[UserRole]):
    """
    Dependency factor to restrict endpoints by user role.
    """
    def dependency(user: User = Depends(get_current_user)):
        if user.role not in [role.value for role in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: role not permitted. Required one of {[r.value for r in allowed_roles]}"
            )
        return user
    return dependency


def verify_scope(
    user: User, 
    facility_id: uuid.UUID | None = None, 
    warehouse_id: uuid.UUID | None = None,
    db: Session = None
) -> None:
    """
    Verify that the user has the scope to access or modify resources belonging 
    to the specified facility_id or warehouse_id.
    """
    if user.role == UserRole.DISTRICT_ADMIN.value:
        # District admins have global read/write across the entire district
        return
        
    if user.role in (UserRole.FACILITY_ADMIN.value, UserRole.HEALTHCARE_STAFF.value):
        # Facility scoped users can only access their specific facility.
        # They cannot access warehouses.
        if warehouse_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: facility staff cannot access warehouse resources"
            )
        if facility_id is None or user.facility_id != facility_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: you do not have permission to access this facility"
            )
            
    elif user.role == UserRole.WAREHOUSE_MANAGER.value:
        # Warehouse managers can only access warehouses.
        if facility_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: warehouse managers cannot access facility resources"
            )
        # If warehouse_id is provided, verify it belongs to their district
        # Or, if we want to be strict, they can manage their district's warehouse.
        # In Phase 1 seed, there is exactly 1 warehouse per district.
        if warehouse_id is not None and db is not None:
            warehouse = db.get(Warehouse, warehouse_id) if hasattr(Warehouse, "id") else None
            # Fetch warehouse from DB if we imported it
            # For simplicity, if we don't import Warehouse here, we can query it:
            from app.models.core import Warehouse
            warehouse = db.get(Warehouse, warehouse_id)
            if warehouse and warehouse.district_id != user.district_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: you cannot access a warehouse outside your district"
                )
