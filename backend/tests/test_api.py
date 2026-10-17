"""
VeriChain backend tests — Phase 2.
All fixtures come from conftest.py.
"""
import pytest
from datetime import datetime, timezone


# ─── Health ───────────────────────────────────────────────────────────────────

def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "service": "verichain-backend"}


# ─── Product list ─────────────────────────────────────────────────────────────

def test_list_products_empty(client):
    resp = client.get("/api/products")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_products_returns_seeded(client, db_session):
    _seed_nike(db_session)
    resp = client.get("/api/products")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["product_id"] == "VC-NIKE-001"


# ─── Product creation ─────────────────────────────────────────────────────────

def test_create_product(client, db_session):
    from app.models.manufacturer import Manufacturer
    mfg = Manufacturer(manufacturer_id="MFG-T", name="TestMfg", country="US")
    db_session.add(mfg)
    db_session.flush()

    resp = client.post("/api/products", json={
        "product_id": "VC-TEST-001",
        "name": "Test Product",
        "status": "AUTHENTIC",
        "manufacturer_id": mfg.id,
        "batch_id": "B001",
    })
    assert resp.status_code == 201
    assert resp.json()["product_id"] == "VC-TEST-001"


def test_create_duplicate_product_fails(client, db_session):
    mfg, _ = _seed_nike(db_session)
    resp = client.post("/api/products", json={
        "product_id": "VC-NIKE-001",
        "name": "Duplicate",
        "status": "AUTHENTIC",
        "manufacturer_id": mfg.id,
    })
    assert resp.status_code == 409


# ─── Product retrieval ────────────────────────────────────────────────────────

def test_get_product_by_id(client, db_session):
    _seed_nike(db_session)
    resp = client.get("/api/products/VC-NIKE-001")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Nike Air Max 2026"
    assert resp.json()["status"] == "AUTHENTIC"


def test_get_unknown_product_returns_404(client):
    resp = client.get("/api/products/UNKNOWN-999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_invalid_product_id_returns_400(client):
    resp = client.get("/api/products/!invalid!")
    assert resp.status_code == 400


# ─── Provenance ───────────────────────────────────────────────────────────────

def test_get_provenance_empty(client, db_session):
    _seed_nike(db_session)
    resp = client.get("/api/products/VC-NIKE-001/provenance")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_provenance_with_events(client, db_session):
    from app.models.supply_chain import SupplyChainEvent
    _, product = _seed_nike(db_session)
    event = SupplyChainEvent(
        product_id=product.id,
        event_type="MANUFACTURED",
        location="Beaverton, OR",
        timestamp=datetime(2026, 9, 5, tzinfo=timezone.utc),
    )
    db_session.add(event)
    db_session.flush()
    resp = client.get("/api/products/VC-NIKE-001/provenance")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["event_type"] == "MANUFACTURED"


# ─── Verification history ─────────────────────────────────────────────────────

def test_get_verification_history_empty(client, db_session):
    _seed_nike(db_session)
    resp = client.get("/api/products/VC-NIKE-001/verification-history")
    assert resp.status_code == 200
    assert resp.json() == []


# ─── Risk ─────────────────────────────────────────────────────────────────────

def test_get_risk_empty(client, db_session):
    _seed_nike(db_session)
    resp = client.get("/api/products/VC-NIKE-001/risk")
    assert resp.status_code == 200
    assert resp.json() == []


# ─── Alerts ───────────────────────────────────────────────────────────────────

def test_list_all_alerts_empty(client):
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_product_alerts_empty(client, db_session):
    _seed_nike(db_session)
    resp = client.get("/api/products/VC-NIKE-001/alerts")
    assert resp.status_code == 200
    assert resp.json() == []


# ─── DB relationship ──────────────────────────────────────────────────────────

def test_database_relationship(db_session):
    from app.models.supply_chain import SupplyChainEvent
    from app.models.product import Product as DBProduct

    _, product = _seed_nike(db_session)
    event = SupplyChainEvent(
        product_id=product.id,
        event_type="SHIPPED",
        location="Oakland, CA",
        timestamp=datetime(2026, 9, 8, tzinfo=timezone.utc),
    )
    db_session.add(event)
    db_session.flush()

    p = db_session.query(DBProduct).filter_by(product_id="VC-NIKE-001").first()
    assert p is not None
    assert len(p.supply_chain_events) == 1
    assert p.supply_chain_events[0].event_type == "SHIPPED"


# ─── Validation failures ──────────────────────────────────────────────────────

def test_create_product_missing_required_fields(client):
    resp = client.post("/api/products", json={"product_id": "VC-X-001"})
    assert resp.status_code == 422


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _seed_nike(db_session):
    from app.models.manufacturer import Manufacturer
    from app.models.product import Product

    mfg = Manufacturer(manufacturer_id="MFG-NIKE-US", name="Nike", country="US")
    db_session.add(mfg)
    db_session.flush()

    product = Product(
        product_id="VC-NIKE-001",
        serial_number="NK-001",
        manufacturer_id=mfg.id,
        batch_id="B2026-001",
        name="Nike Air Max 2026",
        category="Footwear",
        status="AUTHENTIC",
        metadata_hash="abc123",
        manufactured_at=datetime(2026, 9, 5, tzinfo=timezone.utc),
    )
    db_session.add(product)
    db_session.flush()
    return mfg, product
