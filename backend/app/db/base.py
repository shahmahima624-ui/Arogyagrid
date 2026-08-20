from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for AarogyaGrid relational models."""


# Register all models before metadata is consumed by Alembic.
from app.models import core  # noqa: E402, F401
