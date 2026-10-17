from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List

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

# Mock frontend structure
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


@router.post("/{product_id}/verify", response_model=VerificationOutcomeResponse)
def verify_product(product_id: str, db: Session = Depends(get_db)):
    product = get_product_by_product_id(db, product_id)
    
    scans = db.query(VerificationScan).filter_by(product_id=product.id).all()
    supply_chain = db.query(SupplyChainEvent).filter_by(product_id=product.id).all()
    
    # 1. Check blockchain
    bc_result = check_blockchain_verification(db, product)
    
    # 2. Check risk
    risk_result = calculate_risk(product, scans, supply_chain)
    
    # 3. Adjust risk based on blockchain verification
    if bc_result["status"] == "HASH_MISMATCH":
        risk_result.total_score = min(100, risk_result.total_score + 40)
        risk_result.reasons.append(bc_result["message"])
        if risk_result.risk_level != "CRITICAL":
            risk_result.risk_level = "HIGH" if risk_result.total_score < 80 else "CRITICAL"
            risk_result.verification_level = 3
    elif bc_result["status"] == "NOT_REGISTERED":
        risk_result.reasons.append("Product not found in blockchain registry.")
        # Not registered doesn't automatically mean fake, but adds suspicion
        risk_result.total_score = min(100, risk_result.total_score + 10)
    elif bc_result["status"] == "INACTIVE":
        risk_result.total_score = min(100, risk_result.total_score + 30)
        risk_result.reasons.append("Product blockchain record is marked inactive.")
        risk_result.risk_level = "HIGH" if risk_result.total_score < 80 else "CRITICAL"
        
    # Create Risk Assessment record
    assessment = RiskAssessment(
        product_id=product.id,
        location_anomaly=risk_result.location_anomaly,
        duplicate_scan_risk=risk_result.duplicate_scan_risk,
        travel_anomaly=risk_result.travel_anomaly,
        supply_chain_mismatch=risk_result.supply_chain_mismatch,
        scan_frequency=risk_result.scan_frequency,
        total_score=risk_result.total_score,
        risk_level=risk_result.risk_level,
        verification_level=risk_result.verification_level
    )
    db.add(assessment)
    
    # Generate Alert if necessary
    if risk_result.risk_level in ["HIGH", "CRITICAL"]:
        alert_type = "CLONE_DETECTED" if risk_result.risk_level == "CRITICAL" else "HIGH_RISK_ACTIVITY"
        msg = " ".join(risk_result.reasons) if risk_result.reasons else "Suspicious activity detected."
        
        # Idempotent check
        existing = db.query(Alert).filter_by(product_id=product.id, alert_type=alert_type, resolved=False).first()
        if not existing:
            alert = Alert(
                product_id=product.id,
                severity=risk_result.risk_level,
                alert_type=alert_type,
                message=msg
            )
            db.add(alert)
            
    db.commit()
    db.refresh(assessment)
    
    # Map to frontend outcome with strict blockchain-integrity enforcement
    # Core principle:
    # 1. Blockchain verifies identity & metadata integrity. If HASH_MISMATCH -> cannot be AUTHENTIC (SUSPICIOUS or CLONE SUSPECTED).
    # 2. If INACTIVE -> cannot be AUTHENTIC (SUSPICIOUS or CLONE SUSPECTED).
    # 3. If NOT_REGISTERED -> cannot be AUTHENTIC.
    # 4. If BLOCKCHAIN_ERROR -> indeterminate/unverified on-chain; cannot report AUTHENTIC blindly.
    # 5. Even if blockchain is VERIFIED, behavioral risk engine can still flag CLONE SUSPECTED.
    if bc_result["status"] == "HASH_MISMATCH":
        outcome = "CLONE SUSPECTED" if risk_result.risk_level == "CRITICAL" else "SUSPICIOUS"
    elif bc_result["status"] == "INACTIVE":
        outcome = "SUSPICIOUS"
    elif bc_result["status"] == "NOT_REGISTERED":
        outcome = "SUSPICIOUS" if risk_result.risk_level != "CRITICAL" else "CLONE SUSPECTED"
    elif bc_result["status"] == "BLOCKCHAIN_ERROR":
        outcome = "SUSPICIOUS" if risk_result.risk_level != "CRITICAL" else "CLONE SUSPECTED"
    else:
        # Blockchain is VERIFIED
        if risk_result.risk_level == "CRITICAL":
            outcome = "CLONE SUSPECTED"
        elif risk_result.risk_level == "HIGH":
            outcome = "SUSPICIOUS"
        elif risk_result.risk_level == "MEDIUM":
            outcome = "SUSPICIOUS" if risk_result.total_score >= 45 else "AUTHENTIC"
        else:
            outcome = "AUTHENTIC"
        
    now = datetime.now(timezone.utc)
    
    return VerificationOutcomeResponse(
        requestId=f"req_{now.timestamp()}",
        productId=product.product_id,
        outcome=outcome,
        product=ProductResponse.model_validate(product),
        riskAssessment=RiskAssessmentResponse.model_validate(assessment),
        verificationLevel=risk_result.verification_level,
        blockchainVerified=(bc_result["status"] == "VERIFIED"),
        provenanceVerified=bool(supply_chain),
        cloneDetected=(risk_result.risk_level == "CRITICAL"),
        verifiedAt=now.strftime("%B %d, %Y %I:%M %p"),
        verifiedAtIso=now.isoformat(),
        reasons=risk_result.reasons
    )

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
