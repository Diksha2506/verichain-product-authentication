from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base

class VerificationScan(Base):
    __tablename__ = "verification_scans"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    scan_location = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    device_reference = Column(String)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    result = Column(String, nullable=False)
    risk_score = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="verification_scans")
