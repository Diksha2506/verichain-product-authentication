"""
Tests for blockchain_service.py

These tests run OFFLINE (no real node needed).
They validate:
  - generate_metadata_hash() is deterministic
  - Hash changes when metadata changes (HASH_MISMATCH scenario)
  - check_blockchain_verification() returns BLOCKCHAIN_ERROR when node is down
"""

import hashlib
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.blockchain_service import generate_metadata_hash, check_blockchain_verification


def make_product(product_id, manufacturer_id, batch_id, serial_number, manufactured_at_str):
    """Build a mock product that matches blockchain_service expectations."""
    p = MagicMock()
    p.product_id = product_id
    p.batch_id = batch_id
    p.serial_number = serial_number
    if manufactured_at_str:
        # Use a datetime that produces the expected ISO string
        dt = datetime.fromisoformat(manufactured_at_str.replace("+00:00", "+00:00"))
        p.manufactured_at = dt
    else:
        p.manufactured_at = None
    
    mfg = MagicMock()
    mfg.manufacturer_id = manufacturer_id
    p.manufacturer = mfg
    return p


class TestGenerateMetadataHash:
    """Validates the Python hash implementation."""

    def test_hash_is_deterministic(self):
        """Same input must always produce the same hash."""
        p = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00")
        h1 = generate_metadata_hash(p)
        h2 = generate_metadata_hash(p)
        assert h1 == h2

    def test_hash_starts_with_0x(self):
        p = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00")
        h = generate_metadata_hash(p)
        assert h.startswith("0x")
        assert len(h) == 66  # 0x + 64 hex chars

    def test_hash_changes_when_serial_changes(self):
        """HASH_MISMATCH scenario: serial number altered."""
        p_original = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00")
        p_tampered = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "SN-99999", "2026-09-05T00:00:00+00:00")
        
        h_original = generate_metadata_hash(p_original)
        h_tampered = generate_metadata_hash(p_tampered)
        
        assert h_original != h_tampered, "Hash must differ when serial number changes"

    def test_hash_changes_when_batch_changes(self):
        p1 = make_product("VC-NIKE-001", "MFG-NIKE-US", "BATCH-A", "NK-001", "2026-09-05T00:00:00+00:00")
        p2 = make_product("VC-NIKE-001", "MFG-NIKE-US", "BATCH-B", "NK-001", "2026-09-05T00:00:00+00:00")
        assert generate_metadata_hash(p1) != generate_metadata_hash(p2)

    def test_hash_for_unregistered_product(self):
        """Product with manufactured_at=None uses 'None' string."""
        p = make_product("VC-FAKE-999", "MFG-NIKE-US", "UNREGISTERED", "XX-000-9999", None)
        p.manufactured_at = None
        h = generate_metadata_hash(p)
        assert h.startswith("0x")
        assert len(h) == 66

    def test_matches_expected_sha256(self):
        """Verify the hash matches a manually computed SHA-256."""
        canonical = "VC-NIKE-001|MFG-NIKE-US|B2026-091|NK-A26-0091842|2026-09-05T00:00:00+00:00"
        expected = "0x" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        
        p = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00")
        actual = generate_metadata_hash(p)
        assert actual == expected

    def test_hash_handles_unicode(self):
        """Metadata containing Unicode characters hashes deterministically."""
        p1 = make_product("VC-UNI-001", "MFG-TÖKYO-JP", "B-2026-α", "SN-9988-é", "2026-09-05T00:00:00+00:00")
        p2 = make_product("VC-UNI-001", "MFG-TÖKYO-JP", "B-2026-α", "SN-9988-é", "2026-09-05T00:00:00+00:00")
        assert generate_metadata_hash(p1) == generate_metadata_hash(p2)
        assert len(generate_metadata_hash(p1)) == 66

    def test_hash_distinguishes_empty_and_none(self):
        """Ensure empty strings or None produce distinct, deterministic hashes."""
        p_none = make_product("VC-1", "MFG-1", "B-1", "SN-1", None)
        p_str = make_product("VC-1", "MFG-1", "B-1", "SN-1", "2026-01-01T00:00:00+00:00")
        assert generate_metadata_hash(p_none) != generate_metadata_hash(p_str)


class TestCheckBlockchainVerification:
    """Tests for the blockchain verification function (mocked network)."""

    def test_returns_blockchain_error_when_node_down(self):
        """When node is unreachable, should return BLOCKCHAIN_ERROR not crash."""
        p = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00")
        db = MagicMock()

        # Patch w3.is_connected() to return False
        with patch("app.services.blockchain_service.w3") as mock_w3:
            mock_w3.is_connected.return_value = False
            result = check_blockchain_verification(db, p)

        assert result["status"] == "BLOCKCHAIN_ERROR"
        assert "connect" in result["message"].lower() or "blockchain" in result["message"].lower()

    def test_returns_not_registered_when_reverted(self):
        """Simulates contract revert = product not registered."""
        p = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00")
        db = MagicMock()

        with patch("app.services.blockchain_service.w3") as mock_w3:
            mock_w3.is_connected.return_value = True
            mock_contract = MagicMock()
            mock_contract.functions.getProduct.return_value.call.side_effect = Exception("execution reverted: Product does not exist")
            mock_w3.eth.contract.return_value = mock_contract
            mock_w3.to_checksum_address.return_value = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

            result = check_blockchain_verification(db, p)

        assert result["status"] == "NOT_REGISTERED"

    def test_returns_verified_when_hash_matches(self):
        """Simulates a valid on-chain record with matching hash."""
        p = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00")
        db = MagicMock()
        
        expected_hash = generate_metadata_hash(p)
        hash_bytes = bytes.fromhex(expected_hash[2:])  # strip 0x
        
        # Mock record: (productId, manufacturer, metadataHash, registeredAt, status, active)
        mock_record = ("VC-NIKE-001", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", hash_bytes, 1234567890, 0, True)

        with patch("app.services.blockchain_service.w3") as mock_w3:
            mock_w3.is_connected.return_value = True
            mock_contract = MagicMock()
            mock_contract.functions.getProduct.return_value.call.return_value = mock_record
            mock_w3.eth.contract.return_value = mock_contract
            mock_w3.to_checksum_address.return_value = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

            result = check_blockchain_verification(db, p)

        assert result["status"] == "VERIFIED"

    def test_returns_hash_mismatch_when_data_altered(self):
        """HASH_MISMATCH: on-chain hash differs from recomputed hash."""
        # Product with current (altered) serial number
        p = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "SN-99999", "2026-09-05T00:00:00+00:00")
        db = MagicMock()

        # On-chain still has original hash
        original_canonical = "VC-NIKE-001|MFG-NIKE-US|B2026-091|NK-A26-0091842|2026-09-05T00:00:00+00:00"
        original_hash_bytes = bytes.fromhex(hashlib.sha256(original_canonical.encode()).hexdigest())

        mock_record = ("VC-NIKE-001", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", original_hash_bytes, 1234567890, 0, True)

        with patch("app.services.blockchain_service.w3") as mock_w3:
            mock_w3.is_connected.return_value = True
            mock_contract = MagicMock()
            mock_contract.functions.getProduct.return_value.call.return_value = mock_record
            mock_w3.eth.contract.return_value = mock_contract
            mock_w3.to_checksum_address.return_value = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

            result = check_blockchain_verification(db, p)

        assert result["status"] == "HASH_MISMATCH"

    def test_returns_inactive_for_deactivated_product(self):
        """A product that was registered but deactivated."""
        p = make_product("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00")
        db = MagicMock()
        
        # active = False
        mock_record = ("VC-NIKE-001", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", b"\x00" * 32, 1234567890, 3, False)

        with patch("app.services.blockchain_service.w3") as mock_w3:
            mock_w3.is_connected.return_value = True
            mock_contract = MagicMock()
            mock_contract.functions.getProduct.return_value.call.return_value = mock_record
            mock_w3.eth.contract.return_value = mock_contract
            mock_w3.to_checksum_address.return_value = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

            result = check_blockchain_verification(db, p)

        assert result["status"] == "INACTIVE"


class TestVerificationDecisionRules:
    """Validates the combined verification rules in verification API logic."""

    def test_hash_mismatch_cannot_be_authentic(self, client, db_session):
        """Even with 0 scan anomaly, a HASH_MISMATCH must not return AUTHENTIC."""
        from seed import _seed_manufacturers, _seed_products
        _seed_manufacturers(db_session)
        _seed_products(db_session)

        with patch("app.api.verification.check_blockchain_verification") as mock_bc:
            mock_bc.return_value = {
                "status": "HASH_MISMATCH",
                "message": "Data integrity error. Blockchain hash does not match database hash."
            }
            resp = client.post("/api/products/VC-NIKE-001/verify")
            assert resp.status_code == 200
            data = resp.json()
            assert data["outcome"] != "AUTHENTIC"
            assert data["outcome"] in ["SUSPICIOUS", "CLONE SUSPECTED"]
            assert data["blockchainVerified"] is False

    def test_inactive_cannot_be_authentic(self, client, db_session):
        """An inactive blockchain record must never return AUTHENTIC."""
        from seed import _seed_manufacturers, _seed_products
        _seed_manufacturers(db_session)
        _seed_products(db_session)

        with patch("app.api.verification.check_blockchain_verification") as mock_bc:
            mock_bc.return_value = {
                "status": "INACTIVE",
                "message": "Product is registered but marked inactive."
            }
            resp = client.post("/api/products/VC-NIKE-001/verify")
            assert resp.status_code == 200
            data = resp.json()
            assert data["outcome"] == "SUSPICIOUS"
            assert data["blockchainVerified"] is False

    def test_blockchain_error_cannot_be_authentic(self, client, db_session):
        """RPC or node failure must be treated as indeterminate, never assumed AUTHENTIC."""
        from seed import _seed_manufacturers, _seed_products
        _seed_manufacturers(db_session)
        _seed_products(db_session)

        with patch("app.api.verification.check_blockchain_verification") as mock_bc:
            mock_bc.return_value = {
                "status": "BLOCKCHAIN_ERROR",
                "message": "Could not connect to blockchain node."
            }
            resp = client.post("/api/products/VC-NIKE-001/verify")
            assert resp.status_code == 200
            data = resp.json()
            assert data["outcome"] != "AUTHENTIC"
            assert data["blockchainVerified"] is False

    def test_verified_blockchain_can_still_be_clone_suspected(self, client, db_session):
        """A valid blockchain record for a cloned product (VC-FAKE-999) must still yield CLONE SUSPECTED from behavioral risk."""
        from seed import _seed_manufacturers, _seed_products, _seed_verification_scans
        _seed_manufacturers(db_session)
        _seed_products(db_session)
        _seed_verification_scans(db_session)

        with patch("app.api.verification.check_blockchain_verification") as mock_bc:
            mock_bc.return_value = {
                "status": "VERIFIED",
                "message": "Product identity matches blockchain record."
            }
            resp = client.post("/api/products/VC-FAKE-999/verify")
            assert resp.status_code == 200
            data = resp.json()
            assert data["outcome"] == "CLONE SUSPECTED"
            assert data["blockchainVerified"] is True
            assert data["cloneDetected"] is True
