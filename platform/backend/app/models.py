from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from .config import settings
from .database import Base
from .tiers import Tier


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    tier: Mapped[str] = mapped_column(String, default=Tier.TRIAL.value)
    trial_ends_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: _now() + timedelta(days=settings.trial_days)
    )
    subscription_status: Mapped[str] = mapped_column(String, default="trialing")

    stripe_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String, nullable=True)

    def trial_active(self) -> bool:
        ends_at = self.trial_ends_at
        if ends_at.tzinfo is None:
            # SQLite drops tzinfo on round-trip; the app always writes UTC.
            ends_at = ends_at.replace(tzinfo=timezone.utc)
        return _now() < ends_at

    def has_paid_access(self) -> bool:
        if self.subscription_status == "active":
            return True
        return self.tier == Tier.TRIAL.value and self.trial_active()

    def effective_tier(self) -> Tier:
        if self.subscription_status == "active":
            return Tier(self.tier)
        if self.tier == Tier.TRIAL.value and self.trial_active():
            return Tier.TRIAL
        return Tier.TRIAL  # expired trial / no subscription -> most restrictive
