from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class VerificationScanResponse(BaseModel):
    id: int
    product_id: int
    scan_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device_reference: Optional[str] = None
    timestamp: datetime
    result: str
    risk_score: Optional[int] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
