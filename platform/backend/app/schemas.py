from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    tier: str
    subscription_status: str
    trial_ends_at: datetime
    trial_active: bool

    class Config:
        from_attributes = True


class CheckoutSessionRequest(BaseModel):
    tier: str  # "standard" | "pro" — enterprise is rejected, see billing.py


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    mock_mode: bool


class ContactSalesResponse(BaseModel):
    message: str
    email: str
