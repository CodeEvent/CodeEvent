from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import current_features
from ..integrations.pentapi import PentapiClient, PentapiConfig
from ..tiers import TierFeatures

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/pentapi/status")
def pentapi_status(features: TierFeatures = Depends(current_features)) -> dict:
    if features.pentapi_integration == "none":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Pentapi integration requires Pro or Enterprise.",
        )
    client = PentapiClient(PentapiConfig())
    return {
        "integration_level": features.pentapi_integration,
        "configured": client.is_configured(),
        "status": "pending_implementation",
        "note": "Wiring is stubbed until the pentapi API surface is available (see app/integrations/pentapi.py).",
    }
