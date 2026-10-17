import pytest
from datetime import datetime, timezone, timedelta
from app.services.risk_engine import haversine_distance, calculate_risk
from app.models.product import Product
from app.models.verification import VerificationScan
from app.models.supply_chain import SupplyChainEvent

def test_haversine():
    # New York to London ~ 5570 km
    lat1, lon1 = 40.7128, -74.0060
    lat2, lon2 = 51.5074, -0.1278
    dist = haversine_distance(lat1, lon1, lat2, lon2)
    assert 5500 < dist < 5600

def test_zero_distance():
    dist = haversine_distance(40.7128, -74.0060, 40.7128, -74.0060)
    assert dist == 0.0

def test_normal_travel():
    # NY to London in 10 hours (approx 550 km/h)
    p = Product(id=1, product_id="VC-TEST", name="Test")
    now = datetime.now(timezone.utc)
    scans = [
        VerificationScan(id=1, product_id=1, latitude=40.7128, longitude=-74.0060, timestamp=now - timedelta(hours=10)),
        VerificationScan(id=2, product_id=1, latitude=51.5074, longitude=-0.1278, timestamp=now)
    ]
    res = calculate_risk(p, scans, [])
    assert res.travel_anomaly == 0
    assert res.location_anomaly == 0
    assert res.duplicate_scan_risk == 0

def test_impossible_travel():
    # NY to London in 2 hours (approx 2780 km/h) -> exceeds 900
    p = Product(id=1, product_id="VC-TEST", name="Test")
    now = datetime.now(timezone.utc)
    scans = [
        VerificationScan(id=1, product_id=1, latitude=40.7128, longitude=-74.0060, timestamp=now - timedelta(hours=2)),
        VerificationScan(id=2, product_id=1, latitude=51.5074, longitude=-0.1278, timestamp=now)
    ]
    res = calculate_risk(p, scans, [])
    assert res.travel_anomaly > 0
    assert res.location_anomaly > 0
    assert "Impossible geographic movement" in res.reasons[0]

def test_duplicate_scan_detection():
    # Same time, different locations
    p = Product(id=1, product_id="VC-TEST", name="Test")
    now = datetime.now(timezone.utc)
    scans = [
        VerificationScan(id=1, product_id=1, latitude=40.7128, longitude=-74.0060, timestamp=now),
        VerificationScan(id=2, product_id=1, latitude=51.5074, longitude=-0.1278, timestamp=now)
    ]
    res = calculate_risk(p, scans, [])
    assert res.duplicate_scan_risk > 0
    assert res.travel_anomaly > 0

def test_scan_frequency():
    # 25 scans in 1 hour
    p = Product(id=1, product_id="VC-TEST", name="Test")
    now = datetime.now(timezone.utc)
    scans = [
        VerificationScan(id=i, product_id=1, latitude=40.7, longitude=-74.0, timestamp=now + timedelta(minutes=i*2))
        for i in range(25)
    ]
    res = calculate_risk(p, scans, [])
    assert res.scan_frequency == 10
    assert any("abnormal scan frequency" in r for r in res.reasons)

def test_supply_chain_mismatch():
    # Mismatch location vs manufacture origin
    p = Product(id=1, product_id="VC-TEST", name="Test")
    now = datetime.now(timezone.utc)
    events = [
        SupplyChainEvent(id=1, product_id=1, event_type="MANUFACTURED", latitude=40.7128, longitude=-74.0060, timestamp=now - timedelta(days=1))
    ]
    scans = [
        # Scanned in London without shipping event
        VerificationScan(id=1, product_id=1, latitude=51.5074, longitude=-0.1278, timestamp=now)
    ]
    res = calculate_risk(p, scans, events)
    assert res.supply_chain_mismatch > 0
    assert any("without shipping record" in r for r in res.reasons)

def test_risk_score_boundaries():
    # Check boundaries for LOW, MEDIUM, HIGH, CRITICAL
    p = Product(id=1, product_id="VC-TEST", name="Test")
    
    # 0 score -> LOW
    res = calculate_risk(p, [], [])
    assert res.risk_level == "LOW"
    assert res.verification_level == 1
    
    # Force CRITICAL with impossible travel + mismatch
    now = datetime.now(timezone.utc)
    scans = [
        VerificationScan(id=1, product_id=1, latitude=40.7128, longitude=-74.0060, timestamp=now - timedelta(minutes=10)),
        VerificationScan(id=2, product_id=1, latitude=51.5074, longitude=-0.1278, timestamp=now)
    ]
    res = calculate_risk(p, scans, [])
    assert res.total_score >= 60  # At least HIGH depending on other factors
