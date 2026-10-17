from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List, Optional

from ..core.database import get_db
from ..models.product import Product
from ..models.verification import VerificationScan
from ..models.supply_chain import SupplyChainEvent
from ..models.risk import RiskAssessment
from ..models.alert import Alert
from ..schemas.product import ProductResponse
from ..schemas.risk import RiskAssessmentResponse
from ..schemas.verification import VerificationScanResponse
from ..services.product_service import get_product_by_product_id
from ..services.risk_engine import calculate_risk
from ..services.blockchain_service import check_blockchain_verification
from pydantic import BaseModel

router = APIRouter(prefix="/api/products", tags=["verification"])

from ..services.unified_verification_service import (
    orchestrate_verification,
    UnifiedVerificationResult,
    BlockchainEvidence,
    ProvenanceEvidence,
    RiskEvidence,
)

class VerificationOutcomeResponse(BaseModel):
    requestId: str
    productId: str
    outcome: str
    product: ProductResponse
    riskAssessment: RiskAssessmentResponse
    verificationLevel: int
    blockchainVerified: bool
    provenanceVerified: bool
    cloneDetected: bool
    verifiedAt: str
    verifiedAtIso: str
    reasons: List[str]
    decisionReason: Optional[str] = None
    blockchainEvidence: Optional[BlockchainEvidence] = None
    provenanceEvidence: Optional[ProvenanceEvidence] = None
    riskEvidence: Optional[RiskEvidence] = None


@router.post("/{product_id}/verify", response_model=VerificationOutcomeResponse)
def verify_product(product_id: str, db: Session = Depends(get_db)):
    product = get_product_by_product_id(db, product_id)
    result = orchestrate_verification(db, product)
    return result

@router.get("/{product_id}/verification-history", response_model=list[VerificationScanResponse])
def get_verification_history(product_id: str, db: Session = Depends(get_db)):
    product = get_product_by_product_id(db, product_id)
    scans = (
        db.query(VerificationScan)
        .filter(VerificationScan.product_id == product.id)
        .order_by(VerificationScan.timestamp.desc())
        .all()
    )
    return scans
