from pydantic import BaseModel, ConfigDict
from datetime import datetime

class AlertResponse(BaseModel):
    id: int
    product_id: int
    severity: str
    alert_type: str
    message: str
    resolved: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
