"""
Integration test against a running local Hardhat node.
Runs against http://127.0.0.1:8545 if the node is online.
If the node is offline, this test cleanly skips.
"""
import pytest
from unittest.mock import patch
from datetime import datetime, timezone
from web3 import Web3
from app.services.blockchain_service import w3, generate_metadata_hash, CONTRACT_ADDRESS, REGISTRY_ABI
from app.models.product import Product
from app.models.manufacturer import Manufacturer
from app.models.blockchain import BlockchainTransaction


@pytest.fixture
def local_hardhat_connected():
    """Checks whether the local Hardhat node is running and contract is deployed."""
    if not w3.is_connected():
        pytest.skip("Local Hardhat node is not running on http://127.0.0.1:8545")
    
    code = w3.eth.get_code(w3.to_checksum_address(CONTRACT_ADDRESS))
    if not code or code == b"" or code == b"\x00":
        pytest.skip(f"No contract deployed at {CONTRACT_ADDRESS} on local node")
    return True


def test_live_blockchain_register_and_verify(client, db_session, local_hardhat_connected):
    """
    1. Register product through FastAPI endpoint.
    2. Check returned tx receipt and database transaction persistence.
    3. Verify on-chain registration via GET /api/products/{id}/blockchain.
    4. Call verify and check VERIFIED.
    5. Alter serial number in isolated test fixture and verify HASH_MISMATCH.
    """
    unique_id = f"VC-INT-{int(datetime.now(timezone.utc).timestamp())}"
    
    # Create isolated test product in test DB session
    mfg = db_session.query(Manufacturer).filter_by(manufacturer_id="MFG-NIKE-US").first()
    if not mfg:
        mfg = Manufacturer(manufacturer_id="MFG-NIKE-US", name="Nike Test", country="US")
        db_session.add(mfg)
        db_session.flush()

    prod = Product(
        product_id=unique_id,
        serial_number=f"SN-{unique_id}",
        manufacturer_id=mfg.id,
        batch_id="BATCH-INT-01",
        name="Integration Test Item",
        category="Footwear",
        status="AUTHENTIC",
        manufactured_at=datetime(2026, 9, 5, tzinfo=timezone.utc),
    )
    db_session.add(prod)
    db_session.commit()
    db_session.refresh(prod)

    # 1. Register on chain through the backend endpoint
    reg_resp = client.post(f"/api/products/{unique_id}/blockchain/register")
    assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"
    reg_data = reg_resp.json()
    assert reg_data["productId"] == unique_id
    assert reg_data["transactionHash"].startswith("0x")
    assert reg_data["blockNumber"] >= 1

    # 2. Check persistence in DB
    tx_in_db = (
        db_session.query(BlockchainTransaction)
        .filter_by(product_id=prod.id)
        .first()
    )
    assert tx_in_db is not None
    assert tx_in_db.transaction_hash == reg_data["transactionHash"]
    assert tx_in_db.status == "CONFIRMED"

    # 3. Call blockchain history endpoint
    hist_resp = client.get(f"/api/products/{unique_id}/blockchain")
    assert hist_resp.status_code == 200
    hist = hist_resp.json()
    assert len(hist) >= 1
    assert hist[0]["transaction_hash"] == reg_data["transactionHash"]

    # 4. Verification endpoint call -> should be AUTHENTIC and blockchainVerified=True
    verify_resp = client.post(f"/api/products/{unique_id}/verify")
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["outcome"] == "AUTHENTIC"
    assert v_data["blockchainVerified"] is True

    # 5. Tamper authoritative metadata in DB -> must result in HASH_MISMATCH and not AUTHENTIC
    prod.serial_number = "TAMPERED-SERIAL-999"
    db_session.commit()

    tamper_verify_resp = client.post(f"/api/products/{unique_id}/verify")
    assert tamper_verify_resp.status_code == 200
    tv_data = tamper_verify_resp.json()
    assert tv_data["outcome"] in ["SUSPICIOUS", "CLONE SUSPECTED"]
    assert tv_data["blockchainVerified"] is False
    assert any("hash" in r.lower() or "mismatch" in r.lower() or "integrity" in r.lower() for r in tv_data["reasons"])
