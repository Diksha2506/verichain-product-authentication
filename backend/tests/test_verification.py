import pytest
from app.models.risk import RiskAssessment
from app.models.alert import Alert

def test_verification_nike(client, db_session):
    # Relies on seed data from seed.py being in the DB or created by a fixture.
    # Since tests run on a fresh SQLite DB, we need to seed it.
    from seed import _seed_manufacturers, _seed_products, _seed_supply_chain, _seed_verification_scans
    _seed_manufacturers(db_session)
    _seed_products(db_session)
    _seed_supply_chain(db_session)
    _seed_verification_scans(db_session)
    
    from unittest.mock import patch
    with patch("app.api.verification.check_blockchain_verification") as mock_bc:
        mock_bc.return_value = {"status": "VERIFIED", "message": "Product identity matches blockchain record."}
        resp = client.post("/api/products/VC-NIKE-001/verify")
    assert resp.status_code == 200
    data = resp.json()
    assert data["outcome"] == "AUTHENTIC"
    assert data["riskAssessment"]["risk_level"] == "LOW"
    assert data["verificationLevel"] == 1
    
    # Verify risk assessment is persisted
    assessments = db_session.query(RiskAssessment).filter(RiskAssessment.product_id == data["product"]["id"]).all()
    assert len(assessments) >= 1

def test_verification_sony(client, db_session):
    from seed import _seed_manufacturers, _seed_products, _seed_verification_scans
    _seed_manufacturers(db_session)
    _seed_products(db_session)
    _seed_verification_scans(db_session)
    
    resp = client.post("/api/products/VC-SONY-003/verify")
    assert resp.status_code == 200
    data = resp.json()
    assert data["outcome"] == "SUSPICIOUS"
    assert data["riskAssessment"]["risk_level"] == "HIGH"
    assert any("Impossible geographic movement" in r for r in data["reasons"])

def test_verification_fake(client, db_session):
    from seed import _seed_manufacturers, _seed_products, _seed_verification_scans
    _seed_manufacturers(db_session)
    _seed_products(db_session)
    _seed_verification_scans(db_session)
    
    resp = client.post("/api/products/VC-FAKE-999/verify")
    assert resp.status_code == 200
    data = resp.json()
    assert data["outcome"] == "CLONE SUSPECTED"
    assert data["riskAssessment"]["risk_level"] == "CRITICAL"

def test_unknown_product(client):
    resp = client.post("/api/products/VC-UNKNOWN-999/verify")
    assert resp.status_code == 404

def test_historical_assessments(client, db_session):
    from seed import _seed_manufacturers, _seed_products
    _seed_manufacturers(db_session)
    _seed_products(db_session)
    
    # Hit verify 3 times
    client.post("/api/products/VC-NIKE-001/verify")
    client.post("/api/products/VC-NIKE-001/verify")
    client.post("/api/products/VC-NIKE-001/verify")
    
    # Check DB
    from app.models.product import Product
    p = db_session.query(Product).filter_by(product_id="VC-NIKE-001").first()
    assessments = db_session.query(RiskAssessment).filter_by(product_id=p.id).all()
    assert len(assessments) == 3

def test_alert_generation(client, db_session):
    from seed import _seed_manufacturers, _seed_products, _seed_verification_scans
    _seed_manufacturers(db_session)
    _seed_products(db_session)
    _seed_verification_scans(db_session)
    
    # Initial verify should create alert
    client.post("/api/products/VC-FAKE-999/verify")
    
    from app.models.product import Product
    p = db_session.query(Product).filter_by(product_id="VC-FAKE-999").first()
    alerts = db_session.query(Alert).filter_by(product_id=p.id).all()
    assert len(alerts) == 1
    
    # Second verify shouldn't duplicate the same active alert
    client.post("/api/products/VC-FAKE-999/verify")
    alerts2 = db_session.query(Alert).filter_by(product_id=p.id).all()
    assert len(alerts2) == 1
