from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class RiskAssessmentResponse(BaseModel):
    id: int
    product_id: int
    location_anomaly: int
    duplicate_scan_risk: int
    travel_anomaly: int
    supply_chain_mismatch: int
    scan_frequency: int
    total_score: int
    risk_level: str
    verification_level: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
