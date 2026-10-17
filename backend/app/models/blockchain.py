from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from ..core.database import Base

class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True, nullable=False)
    transaction_hash = Column(String, unique=True, index=True, nullable=False)
    block_number = Column(Integer, nullable=True)
    transaction_type = Column(String, nullable=False) # e.g. "REGISTRATION", "VERIFICATION", "TRANSFER"
    metadata_hash = Column(String, nullable=False)
    contract_address = Column(String, nullable=False)
    network = Column(String, nullable=False)
    status = Column(String, nullable=False) # e.g. "CONFIRMED", "PENDING", "FAILED"
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    product = relationship("Product", back_populates="blockchain_transactions")
