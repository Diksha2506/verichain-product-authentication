from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class SupplyChainEventResponse(BaseModel):
    id: int
    product_id: int
    event_type: str
    actor_id: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: datetime
    transaction_reference: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
