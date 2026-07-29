from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token
from .tiers import TierFeatures, features_for

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    email = decode_access_token(token)
    if email is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def require_active_access(user: User = Depends(get_current_user)) -> User:
    """Blocks access once the trial has expired and there's no active paid
    subscription. This is the "you must subscribe after day 7" gate.
    """
    if not user.has_paid_access():
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "Your trial has ended. Subscribe to Standard, Pro, or contact "
            "sales for Enterprise to keep using the platform.",
        )
    return user


def current_features(user: User = Depends(require_active_access)) -> TierFeatures:
    return features_for(user.effective_tier())
