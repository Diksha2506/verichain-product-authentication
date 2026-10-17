"""
Unified Verification Service (Phase 5).

Orchestrates multi-layer evidence fusion:
1. Product existence & status in authoritative DB.
2. Blockchain identity registration & active status.
3. Deterministic metadata hash integrity check.
4. Supply-chain provenance consistency.
5. Behavioral anomaly analysis & risk assessment.
6. Deterministic, explainable final decision policy.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..models.product import Product
from ..models.verification import VerificationScan
from ..models.supply_chain import SupplyChainEvent
from ..models.risk import RiskAssessment
from ..models.alert import Alert
from ..models.blockchain import BlockchainTransaction
from ..schemas.product import ProductResponse
from ..schemas.risk import RiskAssessmentResponse
from ..services.risk_engine import calculate_risk, RiskAssessmentResult
from ..services.blockchain_service import check_blockchain_verification, generate_metadata_hash


class BlockchainEvidence(BaseModel):
    status: str             # "VERIFIED", "NOT_REGISTERED", "HASH_MISMATCH", "INACTIVE", "BLOCKCHAIN_ERROR"
    message: str
    verified: bool
    onChainActive: Optional[bool] = None
    expectedHash: Optional[str] = None
    contractAddress: Optional[str] = None
    latestTxHash: Optional[str] = None


class ProvenanceEvidence(BaseModel):
    eventCount: int
    trailIntact: bool
    lastEvent: Optional[str] = None
    lastLocation: Optional[str] = None
    lastTimestamp: Optional[str] = None


class RiskEvidence(BaseModel):
    totalScore: int
    riskLevel: str
    verificationLevel: int
    reasons: List[str]
    anomalies: Dict[str, int]


class UnifiedVerificationResult(BaseModel):
    requestId: str
    productId: str
    outcome: str            # "AUTHENTIC", "SUSPICIOUS", "CLONE SUSPECTED", "TAMPERED", "NOT FOUND", "INDETERMINATE"
    decisionReason: str
    verificationLevel: int
    blockchainVerified: bool
    provenanceVerified: bool
    cloneDetected: bool
    verifiedAt: str
    verifiedAtIso: str
    reasons: List[str]
    blockchainEvidence: BlockchainEvidence
    provenanceEvidence: ProvenanceEvidence
    riskEvidence: RiskEvidence
    product: Optional[ProductResponse] = None
    riskAssessment: Optional[RiskAssessmentResponse] = None


def evaluate_unified_decision(
    bc_status: str,
    risk_level: str,
    risk_score: int,
    provenance_intact: bool,
    reasons: List[str]
) -> tuple[str, str]:
    """
    Evaluates the deterministic policy table from Phase 5 specifications:
    
    | Evidence                                                         | Required Outcome  |
    |------------------------------------------------------------------|-------------------|
    | Product not found                                                | NOT FOUND         |
    | Confirmed metadata hash mismatch                                 | CLONE SUSPECTED   |
    | Blockchain identity confirmed inactive                           | SUSPICIOUS        |
    | Blockchain identity not registered                               | SUSPICIOUS        |
    | Blockchain RPC unavailable                                       | INDETERMINATE     |
    | Blockchain verified, but behavioral risk is high                | SUSPICIOUS        |
    | Blockchain verified, critical clone evidence                     | CLONE SUSPECTED   |
    | Blockchain verified, metadata and provenance consistent, low risk| AUTHENTIC         |
    
    Returns (outcome, decision_reason).
    """
    if bc_status == "HASH_MISMATCH":
        return (
            "CLONE SUSPECTED",
            "Cryptographic metadata mismatch: Authoritative database record differs from on-chain identity hash."
        )
    if bc_status == "INACTIVE":
        return (
            "SUSPICIOUS",
            "Deactivated identity: Product is registered on the ledger but flagged inactive or decommissioned."
        )
    if bc_status == "NOT_REGISTERED":
        return (
            "SUSPICIOUS",
            "Missing ledger identity: Product was not found in the decentralized registry."
        )
    if bc_status == "BLOCKCHAIN_ERROR":
        return (
            "INDETERMINATE",
            "Blockchain node communication error: Unable to cryptographically confirm product identity."
        )

    # Blockchain is VERIFIED
    if risk_level == "CRITICAL":
        return (
            "CLONE SUSPECTED",
            "Behavioral clone evidence: Valid blockchain identity has been duplicated across impossible locations or scan spikes."
        )
    if risk_level == "HIGH":
        return (
            "SUSPICIOUS",
            "High risk signals detected: Chain of custody or geographic scan velocity is anomalous."
        )
    if risk_level == "MEDIUM" or risk_score >= 45:
        return (
            "SUSPICIOUS",
            "Moderate anomaly: Verification depth increased due to scan frequency or location shifts."
        )
    
    if not provenance_intact:
        return (
            "SUSPICIOUS",
            "Incomplete supply-chain provenance: Product origin or custody trail is missing."
        )

    return (
        "AUTHENTIC",
        "Identity verified on-chain, metadata integrity confirmed, custody trail consistent, and behavioral risk is low."
    )


def orchestrate_verification(
    db: Session,
    product: Product,
    scan_location: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None
) -> UnifiedVerificationResult:
    """
    Orchestrates the entire multi-phase verification pipeline and persists
    the resulting scan and risk assessment records.
    """
    # 1. Gather historical signals
    scans = (
        db.query(VerificationScan)
        .filter(VerificationScan.product_id == product.id)
        .order_by(VerificationScan.timestamp.asc())
        .all()
    )
    supply_chain = (
        db.query(SupplyChainEvent)
        .filter(SupplyChainEvent.product_id == product.id)
        .order_by(SupplyChainEvent.timestamp.asc())
        .all()
    )
    latest_tx = (
        db.query(BlockchainTransaction)
        .filter(BlockchainTransaction.product_id == product.id, BlockchainTransaction.status == "CONFIRMED")
        .order_by(BlockchainTransaction.timestamp.desc())
        .first()
    )

    # 2. Blockchain identity verification
    bc_result = check_blockchain_verification(db, product)
    bc_status = bc_result.get("status", "BLOCKCHAIN_ERROR")
    bc_message = bc_result.get("message", "")
    expected_hash = generate_metadata_hash(product)

    # 3. Behavioral risk engine
    risk_result = calculate_risk(product, scans, supply_chain)

    # Combine blockchain-level penalties into risk explanation
    reasons = list(risk_result.reasons)
    if bc_status == "HASH_MISMATCH":
        risk_result.total_score = min(100, risk_result.total_score + 40)
        reasons.append(bc_message)
        if risk_result.risk_level != "CRITICAL":
            risk_result.risk_level = "HIGH" if risk_result.total_score < 80 else "CRITICAL"
            risk_result.verification_level = 3
    elif bc_status == "NOT_REGISTERED":
        reasons.append("Product not registered in decentralized registry.")
        risk_result.total_score = min(100, risk_result.total_score + 10)
    elif bc_status == "INACTIVE":
        reasons.append("Product ledger record is marked inactive.")
        risk_result.total_score = min(75, risk_result.total_score + 30)
        if risk_result.risk_level != "CRITICAL":
            risk_result.risk_level = "HIGH"
    elif bc_status == "BLOCKCHAIN_ERROR":
        reasons.append("Decentralized node lookup failed: state is indeterminate.")

    # 4. Provenance analysis
    provenance_intact = bool(supply_chain)
    last_sc_event = supply_chain[-1] if supply_chain else None

    # 5. Deterministic Policy Decision
    outcome, decision_reason = evaluate_unified_decision(
        bc_status=bc_status,
        risk_level=risk_result.risk_level,
        risk_score=risk_result.total_score,
        provenance_intact=provenance_intact,
        reasons=reasons
    )

    now = datetime.now(timezone.utc)

    # 6. Persist verification scan
    new_scan = VerificationScan(
        product_id=product.id,
        scan_location=scan_location or (last_sc_event.location if last_sc_event else "Web Console"),
        latitude=latitude or (last_sc_event.latitude if last_sc_event else None),
        longitude=longitude or (last_sc_event.longitude if last_sc_event else None),
        timestamp=now,
        result=outcome,
        risk_score=risk_result.total_score
    )
    db.add(new_scan)

    # 7. Persist risk assessment
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

    # 8. Alert generation
    if risk_result.risk_level in ["HIGH", "CRITICAL"] or outcome in ["CLONE SUSPECTED"]:
        alert_type = "CLONE_DETECTED" if outcome == "CLONE SUSPECTED" else "HIGH_RISK_ACTIVITY"
        msg = f"{decision_reason} " + " ".join(reasons)
        existing = db.query(Alert).filter_by(product_id=product.id, alert_type=alert_type, resolved=False).first()
        if not existing:
            alert = Alert(
                product_id=product.id,
                severity=risk_result.risk_level,
                alert_type=alert_type,
                message=msg.strip()
            )
            db.add(alert)

    db.commit()
    db.refresh(assessment)

    # 9. Structure final evidence
    bc_evidence = BlockchainEvidence(
        status=bc_status,
        message=bc_message,
        verified=(bc_status == "VERIFIED"),
        onChainActive=(bc_status == "VERIFIED"),
        expectedHash=expected_hash,
        contractAddress=latest_tx.contract_address if latest_tx else None,
        latestTxHash=latest_tx.transaction_hash if latest_tx else None
    )

    prov_evidence = ProvenanceEvidence(
        eventCount=len(supply_chain),
        trailIntact=provenance_intact,
        lastEvent=last_sc_event.event_type if last_sc_event else None,
        lastLocation=last_sc_event.location if last_sc_event else None,
        lastTimestamp=last_sc_event.timestamp.isoformat() if last_sc_event else None
    )

    risk_evidence = RiskEvidence(
        totalScore=risk_result.total_score,
        riskLevel=risk_result.risk_level,
        verificationLevel=risk_result.verification_level,
        reasons=reasons,
        anomalies={
            "locationAnomaly": risk_result.location_anomaly,
            "duplicateScanRisk": risk_result.duplicate_scan_risk,
            "travelAnomaly": risk_result.travel_anomaly,
            "supplyChainMismatch": risk_result.supply_chain_mismatch,
            "scanFrequency": risk_result.scan_frequency,
        }
    )

    return UnifiedVerificationResult(
        requestId=f"req_{now.timestamp()}",
        productId=product.product_id,
        outcome=outcome,
        decisionReason=decision_reason,
        verificationLevel=risk_result.verification_level,
        blockchainVerified=(bc_status == "VERIFIED"),
        provenanceVerified=provenance_intact,
        cloneDetected=(outcome == "CLONE SUSPECTED"),
        verifiedAt=now.strftime("%B %d, %Y %I:%M %p"),
        verifiedAtIso=now.isoformat(),
        reasons=reasons,
        blockchainEvidence=bc_evidence,
        provenanceEvidence=prov_evidence,
        riskEvidence=risk_evidence,
        product=ProductResponse.model_validate(product),
        riskAssessment=RiskAssessmentResponse.model_validate(assessment)
    )
