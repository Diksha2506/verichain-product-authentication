from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from ..core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, unique=True, index=True, nullable=False)
    serial_number = Column(String, unique=True, index=True)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"))
    batch_id = Column(String)
    name = Column(String, nullable=False)
    category = Column(String)
    status = Column(String, nullable=False)
    metadata_hash = Column(String)
    manufactured_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    manufacturer = relationship("Manufacturer", back_populates="products")
    supply_chain_events = relationship("SupplyChainEvent", back_populates="product", cascade="all, delete-orphan")
    verification_scans = relationship("VerificationScan", back_populates="product", cascade="all, delete-orphan")
    risk_assessments = relationship("RiskAssessment", back_populates="product", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="product", cascade="all, delete-orphan")
    blockchain_transactions = relationship("BlockchainTransaction", back_populates="product", cascade="all, delete-orphan")
