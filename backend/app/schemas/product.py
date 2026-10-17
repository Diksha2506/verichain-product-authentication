from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class ProductBase(BaseModel):
    product_id: str
    serial_number: Optional[str] = None
    batch_id: Optional[str] = None
    name: str
    category: Optional[str] = None
    status: str
    metadata_hash: Optional[str] = None
    manufactured_at: Optional[datetime] = None

class ProductCreate(ProductBase):
    manufacturer_id: int

class ProductResponse(ProductBase):
    id: int
    manufacturer_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
