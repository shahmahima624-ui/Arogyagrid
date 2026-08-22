from datetime import datetime
from typing import Any
from pydantic import BaseModel


class BackupSnapshotResponse(BaseModel):
    snapshot_id: str
    created_at: datetime
    tables_backed_up: dict[str, int]
    snapshot_json: dict[str, Any]


class RestoreRequest(BaseModel):
    snapshot_json: dict[str, Any]


class RestoreResponse(BaseModel):
    success: bool = True
    restored_at: datetime
    tables_restored: dict[str, int]
    message: str
