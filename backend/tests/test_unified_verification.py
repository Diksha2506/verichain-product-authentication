"""
test_unified_verification.py -- Phase 5 Policy Table Tests.

Verifies all decision outcomes from evaluate_unified_decision() in isolation,
then exercises the full orchestrate_verification() pipeline for key paths.

Decision policy table (from Phase 5 spec):
  HASH_MISMATCH                               -> CLONE SUSPECTED
  INACTIVE                                    -> SUSPICIOUS
  NOT_REGISTERED                              -> SUSPICIOUS
  BLOCKCHAIN_ERROR                            -> INDETERMINATE
  VERIFIED + CRITICAL risk                    -> CLONE SUSPECTED
  VERIFIED + HIGH risk                        -> SUSPICIOUS
  VERIFIED + MEDIUM risk (or score >= 45)     -> SUSPICIOUS
  VERIFIED + provenance missing               -> SUSPICIOUS
  VERIFIED + provenance intact + LOW risk     -> AUTHENTIC
"""
import pytest
from unittest.mock import patch

from app.services.unified_verification_service import evaluate_unified_decision


# ---- Unit tests: evaluate_unified_decision policy table ---------------------

class TestEvaluateUnifiedDecision:
    """Tests each row of the deterministic policy table in isolation."""

    def test_hash_mismatch_is_clone_suspected(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="HASH_MISMATCH",
            risk_level="LOW",
            risk_score=10,
            provenance_intact=True,
            reasons=[],
        )
        assert outcome == "CLONE SUSPECTED"
        assert "mismatch" in reason.lower() or "cryptographic" in reason.lower()

    def test_inactive_is_suspicious(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="INACTIVE",
            risk_level="LOW",
            risk_score=5,
            provenance_intact=True,
            reasons=[],
        )
        assert outcome == "SUSPICIOUS"
        assert "inactive" in reason.lower() or "deactivated" in reason.lower()

    def test_not_registered_is_suspicious(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="NOT_REGISTERED",
            risk_level="LOW",
            risk_score=5,
            provenance_intact=True,
            reasons=[],
        )
        assert outcome == "SUSPICIOUS"
        assert (
            "registry" in reason.lower()
            or "ledger" in reason.lower()
            or "registered" in reason.lower()
        )

    def test_blockchain_error_is_indeterminate(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="BLOCKCHAIN_ERROR",
            risk_level="LOW",
            risk_score=5,
            provenance_intact=True,
            reasons=[],
        )
        assert outcome == "INDETERMINATE"
        assert (
            "error" in reason.lower()
            or "indeterminate" in reason.lower()
            or "communication" in reason.lower()
        )

    def test_verified_critical_risk_is_clone_suspected(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="VERIFIED",
            risk_level="CRITICAL",
            risk_score=90,
            provenance_intact=True,
            reasons=[],
        )
        assert outcome == "CLONE SUSPECTED"
        assert (
            "behavioral" in reason.lower()
            or "clone" in reason.lower()
            or "duplicat" in reason.lower()
        )

    def test_verified_high_risk_is_suspicious(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="VERIFIED",
            risk_level="HIGH",
            risk_score=65,
            provenance_intact=True,
            reasons=[],
        )
        assert outcome == "SUSPICIOUS"
        assert "high" in reason.lower() or "anomal" in reason.lower() or "risk" in reason.lower()

    def test_verified_medium_risk_is_suspicious(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="VERIFIED",
            risk_level="MEDIUM",
            risk_score=45,
            provenance_intact=True,
            reasons=[],
        )
        assert outcome == "SUSPICIOUS"

    def test_verified_low_risk_no_provenance_is_suspicious(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="VERIFIED",
            risk_level="LOW",
            risk_score=10,
            provenance_intact=False,
            reasons=[],
        )
        assert outcome == "SUSPICIOUS"
        assert (
            "provenance" in reason.lower()
            or "supply" in reason.lower()
            or "custody" in reason.lower()
        )

    def test_verified_low_risk_with_provenance_is_authentic(self):
        outcome, reason = evaluate_unified_decision(
            bc_status="VERIFIED",
            risk_level="LOW",
            risk_score=10,
            provenance_intact=True,
            reasons=[],
        )
        assert outcome == "AUTHENTIC"
        assert (
            "verified" in reason.lower()
            or "confirmed" in reason.lower()
            or "authentic" in reason.lower()
        )


# ---- Integration tests: full pipeline via TestClient -----------------------

class TestOrchestrateVerificationPipeline:
    """
    End-to-end tests using the full orchestrate_verification() pipeline through
    the TestClient, with the blockchain call mocked.
    """

    def _seed(self, db_session, supply_chain=True):
        from seed import (
            _seed_manufacturers,
            _seed_products,
            _seed_supply_chain,
            _seed_verification_scans,
        )
        _seed_manufacturers(db_session)
        _seed_products(db_session)
        if supply_chain:
            _seed_supply_chain(db_session)
        _seed_verification_scans(db_session)

    def test_authentic_nike_with_verified_chain(self, client, db_session):
        """Verified blockchain + low risk + provenance => AUTHENTIC."""
        self._seed(db_session)
        with patch(
            "app.services.unified_verification_service.check_blockchain_verification",
            return_value={"status": "VERIFIED", "message": "OK"},
        ):
            resp = client.post("/api/products/VC-NIKE-001/verify")
        assert resp.status_code == 200
        data = resp.json()
        assert data["outcome"] == "AUTHENTIC"
        assert data["blockchainVerified"] is True
        assert data["provenanceVerified"] is True
        assert data["cloneDetected"] is False
        assert data["decisionReason"] is not None
        assert data["blockchainEvidence"]["status"] == "VERIFIED"
        assert data["provenanceEvidence"]["trailIntact"] is True

    def test_clone_suspected_on_hash_mismatch(self, client, db_session):
        """Hash mismatch => CLONE SUSPECTED regardless of risk level."""
        self._seed(db_session)
        with patch(
            "app.services.unified_verification_service.check_blockchain_verification",
            return_value={"status": "HASH_MISMATCH", "message": "Metadata hash does not match."},
        ):
            resp = client.post("/api/products/VC-NIKE-001/verify")
        assert resp.status_code == 200
        data = resp.json()
        assert data["outcome"] == "CLONE SUSPECTED"
        assert data["cloneDetected"] is True
        assert data["blockchainEvidence"]["status"] == "HASH_MISMATCH"

    def test_suspicious_on_inactive_chain(self, client, db_session):
        """Inactive blockchain identity => SUSPICIOUS."""
        self._seed(db_session)
        with patch(
            "app.services.unified_verification_service.check_blockchain_verification",
            return_value={"status": "INACTIVE", "message": "Product is deactivated on-chain."},
        ):
            resp = client.post("/api/products/VC-NIKE-001/verify")
        assert resp.status_code == 200
        data = resp.json()
        assert data["outcome"] == "SUSPICIOUS"

    def test_suspicious_on_not_registered(self, client, db_session):
        """Not registered on chain => SUSPICIOUS."""
        self._seed(db_session)
        with patch(
            "app.services.unified_verification_service.check_blockchain_verification",
            return_value={"status": "NOT_REGISTERED", "message": "Not found on-chain."},
        ):
            resp = client.post("/api/products/VC-NIKE-001/verify")
        assert resp.status_code == 200
        data = resp.json()
        assert data["outcome"] == "SUSPICIOUS"

    def test_indeterminate_on_blockchain_error(self, client, db_session):
        """Blockchain RPC error => INDETERMINATE."""
        self._seed(db_session)
        with patch(
            "app.services.unified_verification_service.check_blockchain_verification",
            return_value={"status": "BLOCKCHAIN_ERROR", "message": "RPC node unreachable."},
        ):
            resp = client.post("/api/products/VC-NIKE-001/verify")
        assert resp.status_code == 200
        data = resp.json()
        assert data["outcome"] == "INDETERMINATE"

    def test_clone_suspected_for_fake_product(self, client, db_session):
        """VC-FAKE-999 has CRITICAL risk => CLONE SUSPECTED (no blockchain mock needed)."""
        self._seed(db_session)
        resp = client.post("/api/products/VC-FAKE-999/verify")
        assert resp.status_code == 200
        data = resp.json()
        assert data["outcome"] == "CLONE SUSPECTED"
        assert data["riskEvidence"]["riskLevel"] == "CRITICAL"
        assert data["cloneDetected"] is True

    def test_not_found_returns_404(self, client):
        """Unknown product ID => 404."""
        resp = client.post("/api/products/VC-DOES-NOT-EXIST/verify")
        assert resp.status_code == 404

    def test_response_has_all_evidence_fields(self, client, db_session):
        """Full response shape includes all evidence sections."""
        self._seed(db_session)
        with patch(
            "app.services.unified_verification_service.check_blockchain_verification",
            return_value={"status": "VERIFIED", "message": "OK"},
        ):
            resp = client.post("/api/products/VC-NIKE-001/verify")
        assert resp.status_code == 200
        data = resp.json()
        for field in ("requestId", "productId", "outcome", "decisionReason", "verificationLevel"):
            assert field in data, f"Missing top-level field: {field}"
        for section in ("blockchainEvidence", "provenanceEvidence", "riskEvidence"):
            assert section in data, f"Missing evidence section: {section}"
        bc = data["blockchainEvidence"]
        assert all(k in bc for k in ("status", "message", "verified"))
        prov = data["provenanceEvidence"]
        assert all(k in prov for k in ("eventCount", "trailIntact"))
        risk = data["riskEvidence"]
        assert all(k in risk for k in ("totalScore", "riskLevel", "verificationLevel", "reasons", "anomalies"))

    def test_verification_scan_persisted(self, client, db_session):
        """Each verification call saves a VerificationScan to the DB."""
        from app.models.verification import VerificationScan
        from app.models.product import Product
        self._seed(db_session)
        with patch(
            "app.services.unified_verification_service.check_blockchain_verification",
            return_value={"status": "VERIFIED", "message": "OK"},
        ):
            client.post("/api/products/VC-NIKE-001/verify")
        product = db_session.query(Product).filter_by(product_id="VC-NIKE-001").first()
        scans = db_session.query(VerificationScan).filter_by(product_id=product.id).all()
        assert len(scans) >= 1

    def test_risk_assessment_persisted(self, client, db_session):
        """Each verification call saves a RiskAssessment to the DB."""
        from app.models.risk import RiskAssessment
        from app.models.product import Product
        self._seed(db_session)
        with patch(
            "app.services.unified_verification_service.check_blockchain_verification",
            return_value={"status": "VERIFIED", "message": "OK"},
        ):
            client.post("/api/products/VC-NIKE-001/verify")
        product = db_session.query(Product).filter_by(product_id="VC-NIKE-001").first()
        assessments = db_session.query(RiskAssessment).filter_by(product_id=product.id).all()
        assert len(assessments) >= 1
