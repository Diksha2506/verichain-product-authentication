from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    location_anomaly = Column(Integer, default=0)
    duplicate_scan_risk = Column(Integer, default=0)
    travel_anomaly = Column(Integer, default=0)
    supply_chain_mismatch = Column(Integer, default=0)
    scan_frequency = Column(Integer, default=0)
    total_score = Column(Integer, default=0)
    risk_level = Column(String, nullable=False)
    verification_level = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="risk_assessments")
