"""
Seed script — populates the database with the four canonical demo products.

Usage (from backend/ directory, with venv activated):
    python seed.py

This is idempotent: running it twice will not create duplicates.
It will NOT drop or truncate any table.
"""
import os
import sys
from datetime import datetime, timezone

# Add app to path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.models.manufacturer import Manufacturer
from app.models.product import Product
from app.models.supply_chain import SupplyChainEvent
from app.models.verification import VerificationScan
from app.models.risk import RiskAssessment
from app.models.alert import Alert


def seed():
    db = SessionLocal()
    try:
        print("Seeding database …")
        _seed_manufacturers(db)
        _seed_products(db)
        _seed_supply_chain(db)
        _seed_verification_scans(db)
        _seed_risk_assessments(db)
        _seed_alerts(db)
        print("✓ Seed complete.")
    finally:
        db.close()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_or_create_manufacturer(db, manufacturer_id: str, name: str, country: str) -> Manufacturer:
    m = db.query(Manufacturer).filter_by(manufacturer_id=manufacturer_id).first()
    if not m:
        m = Manufacturer(manufacturer_id=manufacturer_id, name=name, country=country)
        db.add(m)
        db.commit()
        db.refresh(m)
    return m


def _get_or_create_product(db, product_id: str, **kwargs) -> Product:
    p = db.query(Product).filter_by(product_id=product_id).first()
    if not p:
        p = Product(product_id=product_id, **kwargs)
        db.add(p)
        db.commit()
        db.refresh(p)
    return p


def _utc(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


# ─── Manufacturers ────────────────────────────────────────────────────────────

def _seed_manufacturers(db):
    _get_or_create_manufacturer(db, "MFG-NIKE-US", "Nike Manufacturing", "US")
    _get_or_create_manufacturer(db, "MFG-APPLE-US", "Apple Inc.", "US")
    _get_or_create_manufacturer(db, "MFG-SONY-JP", "Sony Corporation", "JP")
    print("  ✓ Manufacturers")


# ─── Products ────────────────────────────────────────────────────────────────

def _seed_products(db):
    nike = db.query(Manufacturer).filter_by(manufacturer_id="MFG-NIKE-US").first()
    apple = db.query(Manufacturer).filter_by(manufacturer_id="MFG-APPLE-US").first()
    sony = db.query(Manufacturer).filter_by(manufacturer_id="MFG-SONY-JP").first()

    _get_or_create_product(db, "VC-NIKE-001",
        serial_number="NK-A26-0091842",
        manufacturer_id=nike.id,
        batch_id="B2026-091",
        name="Nike Air Max 2026",
        category="Footwear",
        status="AUTHENTIC",
        metadata_hash="a3f9d2e1b8c7f4a0e6d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0",
        manufactured_at=_utc("2026-09-05T00:00:00Z"),
    )
    _get_or_create_product(db, "VC-APPLE-002",
        serial_number="AW11-4209816",
        manufacturer_id=apple.id,
        batch_id="AW-S11-204",
        name="Apple Watch Series 11",
        category="Wearables",
        status="AUTHENTIC",
        metadata_hash="b4e0d3c2a1f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3",
        manufactured_at=_utc("2026-08-18T00:00:00Z"),
    )
    _get_or_create_product(db, "VC-SONY-003",
        serial_number="SN-WH6-779203",
        manufacturer_id=sony.id,
        batch_id="WH6-77A",
        name="Sony WH-1000XM6",
        category="Audio",
        status="SUSPICIOUS",
        metadata_hash="c5f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1",
        manufactured_at=_utc("2026-07-22T00:00:00Z"),
    )
    _get_or_create_product(db, "VC-FAKE-999",
        serial_number="XX-000-9999",
        manufacturer_id=nike.id,  # Claims to be Nike
        batch_id="UNREGISTERED",
        name="Air Max 2026 (unverified unit)",
        category="Footwear",
        status="CLONE SUSPECTED",
        metadata_hash="0000000000000000000000000000000000000000000000000000000000000000",
        manufactured_at=None,
    )
    print("  ✓ Products")


# ─── Supply-chain events ──────────────────────────────────────────────────────

def _seed_supply_chain(db):
    nike = db.query(Product).filter_by(product_id="VC-NIKE-001").first()
    # Only seed if events don't exist
    if db.query(SupplyChainEvent).filter_by(product_id=nike.id).first():
        print("  ✓ Supply chain (already seeded)")
        return

    events = [
        SupplyChainEvent(product_id=nike.id, event_type="MANUFACTURED",
            actor_id="MFG-NIKE-US", location="Beaverton, Oregon, US",
            latitude=45.5231, longitude=-122.6765,
            timestamp=_utc("2026-09-05T08:14:00Z"),
            transaction_reference="0x7a91e82c"),
        SupplyChainEvent(product_id=nike.id, event_type="SHIPPED",
            actor_id="DIST-WESTCOAST", location="Oakland, California, US",
            latitude=37.8044, longitude=-122.2712,
            timestamp=_utc("2026-09-08T16:32:00Z"),
            transaction_reference="0x23d8901b"),
        SupplyChainEvent(product_id=nike.id, event_type="RECEIVED_RETAIL",
            actor_id="RETAIL-UNION-SF", location="San Francisco, California, US",
            latitude=37.7749, longitude=-122.4194,
            timestamp=_utc("2026-09-12T10:06:00Z"),
            transaction_reference="0x99a210df"),
        SupplyChainEvent(product_id=nike.id, event_type="SOLD",
            actor_id="CONSUMER", location="Portland, Oregon, US",
            latitude=45.5231, longitude=-122.6765,
            timestamp=_utc("2026-09-18T13:42:00Z"),
            transaction_reference="0x61ce13ae"),
    ]
    db.bulk_save_objects(events)
    db.commit()
    print("  ✓ Supply chain events")


# ─── Verification scans ───────────────────────────────────────────────────────

def _seed_verification_scans(db):
    products = {p.product_id: p for p in db.query(Product).all()}

    scans_data = [
        # VC-NIKE-001 — clean authentic scans
        dict(product_id=products["VC-NIKE-001"].id, scan_location="Portland, OR, US",
             latitude=45.5231, longitude=-122.6765,
             timestamp=_utc("2026-10-05T17:37:00Z"), result="AUTHENTIC", risk_score=12),
        dict(product_id=products["VC-NIKE-001"].id, scan_location="San Francisco, CA, US",
             latitude=37.7749, longitude=-122.4194,
             timestamp=_utc("2026-10-05T15:49:00Z"), result="AUTHENTIC", risk_score=8),

        # VC-APPLE-002 — moderate scans
        dict(product_id=products["VC-APPLE-002"].id, scan_location="Cupertino, CA, US",
             latitude=37.3230, longitude=-122.0322,
             timestamp=_utc("2026-10-05T17:11:00Z"), result="AUTHENTIC", risk_score=18),

        # VC-SONY-003 — impossible location jump (Singapore → London in 17 min)
        dict(product_id=products["VC-SONY-003"].id, scan_location="Singapore",
             latitude=1.3521, longitude=103.8198,
             timestamp=_utc("2026-10-05T17:45:00Z"), result="SUSPICIOUS", risk_score=67),
        dict(product_id=products["VC-SONY-003"].id, scan_location="London, UK",
             latitude=51.5074, longitude=-0.1278,
             timestamp=_utc("2026-10-05T17:28:00Z"), result="SUSPICIOUS", risk_score=67),

        # VC-FAKE-999 — impossible Indian city jumps
        # Pune at 09:12, Mumbai at 09:27 (15 min gap, 3 hr drive)
        # Mumbai at 09:27, Delhi at 09:34 (7 min gap, 2 hr flight)
        dict(product_id=products["VC-FAKE-999"].id, scan_location="Pune, Maharashtra, IN",
             latitude=18.5204, longitude=73.8567,
             timestamp=_utc("2026-10-05T03:42:00Z"), result="CLONE SUSPECTED", risk_score=94),
        dict(product_id=products["VC-FAKE-999"].id, scan_location="Mumbai, Maharashtra, IN",
             latitude=19.0760, longitude=72.8777,
             timestamp=_utc("2026-10-05T03:57:00Z"), result="CLONE SUSPECTED", risk_score=94),
        dict(product_id=products["VC-FAKE-999"].id, scan_location="Delhi, IN",
             latitude=28.6139, longitude=77.2090,
             timestamp=_utc("2026-10-05T04:04:00Z"), result="CLONE SUSPECTED", risk_score=94),
    ]

    # Only insert if not already seeded
    if not db.query(VerificationScan).first():
        db.bulk_save_objects([VerificationScan(**s) for s in scans_data])
        db.commit()
        print("  ✓ Verification scans")
    else:
        print("  ✓ Verification scans (already seeded)")


# ─── Risk assessments ────────────────────────────────────────────────────────

def _seed_risk_assessments(db):
    if db.query(RiskAssessment).first():
        print("  ✓ Risk assessments (already seeded)")
        return

    products = {p.product_id: p for p in db.query(Product).all()}

    assessments = [
        RiskAssessment(product_id=products["VC-NIKE-001"].id,
            location_anomaly=3, duplicate_scan_risk=2, travel_anomaly=1,
            supply_chain_mismatch=2, scan_frequency=4,
            total_score=12, risk_level="LOW", verification_level=1),
        RiskAssessment(product_id=products["VC-APPLE-002"].id,
            location_anomaly=5, duplicate_scan_risk=3, travel_anomaly=4,
            supply_chain_mismatch=2, scan_frequency=4,
            total_score=18, risk_level="LOW", verification_level=1),
        RiskAssessment(product_id=products["VC-SONY-003"].id,
            location_anomaly=20, duplicate_scan_risk=15, travel_anomaly=18,
            supply_chain_mismatch=8, scan_frequency=6,
            total_score=67, risk_level="HIGH", verification_level=3),
        RiskAssessment(product_id=products["VC-FAKE-999"].id,
            location_anomaly=30, duplicate_scan_risk=25, travel_anomaly=20,
            supply_chain_mismatch=15, scan_frequency=4,
            total_score=94, risk_level="CRITICAL", verification_level=3),
    ]
    db.bulk_save_objects(assessments)
    db.commit()
    print("  ✓ Risk assessments")


# ─── Alerts ──────────────────────────────────────────────────────────────────

def _seed_alerts(db):
    if db.query(Alert).first():
        print("  ✓ Alerts (already seeded)")
        return

    products = {p.product_id: p for p in db.query(Product).all()}

    alerts_data = [
        Alert(product_id=products["VC-FAKE-999"].id,
            severity="CRITICAL", alert_type="CLONE_DETECTED",
            message="Same product identity scanned across impossible locations within 22 minutes.",
            resolved=False),
        Alert(product_id=products["VC-SONY-003"].id,
            severity="HIGH", alert_type="IMPOSSIBLE_LOCATION",
            message="Identity scanned in Singapore and London within 17 minutes — physically impossible.",
            resolved=False),
        Alert(product_id=products["VC-SONY-003"].id,
            severity="MEDIUM", alert_type="SCAN_FREQUENCY",
            message="Repeated scan requests for the same product identity within a short period.",
            resolved=False),
        Alert(product_id=products["VC-NIKE-001"].id,
            severity="LOW", alert_type="VERIFICATION_COMPLETE",
            message="Manufacturer record and supply-chain trail matched at retail.",
            resolved=True),
    ]
    db.bulk_save_objects(alerts_data)
    db.commit()
    print("  ✓ Alerts")


if __name__ == "__main__":
    seed()
