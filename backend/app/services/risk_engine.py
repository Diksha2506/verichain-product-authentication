"""
Risk Engine for VeriChain Phase 3.

Calculates a deterministic risk score (0-100) based on product scan history
and supply chain events.
"""
import math
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from ..models.product import Product
from ..models.verification import VerificationScan
from ..models.supply_chain import SupplyChainEvent

MAX_SPEED_KMH = 900.0  # Commercial flight speed threshold

class RiskAssessmentResult(BaseModel):
    total_score: int
    risk_level: str
    verification_level: int
    location_anomaly: int
    duplicate_scan_risk: int
    travel_anomaly: int
    supply_chain_mismatch: int
    scan_frequency: int
    reasons: List[str]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on Earth in km."""
    R = 6371.0
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_risk(product: Product, scans: List[VerificationScan], supply_chain: List[SupplyChainEvent]) -> RiskAssessmentResult:
    reasons = []
    
    # Sort scans by time
    sorted_scans = sorted(scans, key=lambda s: s.timestamp)
    
    # Base scores
    location_score = 0
    duplicate_score = 0
    travel_score = 0
    supply_score = 0
    frequency_score = 0

    # 1. Scan frequency
    if len(sorted_scans) >= 2:
        # Time between first and latest scan in hours
        time_diff_hours = (sorted_scans[-1].timestamp - sorted_scans[0].timestamp).total_seconds() / 3600.0
        if time_diff_hours > 0:
            rate = len(sorted_scans) / time_diff_hours
            if rate > 20: # e.g. 20 scans in an hour
                frequency_score = 10
                reasons.append("Highly abnormal scan frequency detected.")
            elif rate > 10:
                frequency_score = 5

    # 2 & 3: Impossible Travel & Location Anomaly
    if len(sorted_scans) >= 2:
        for i in range(1, len(sorted_scans)):
            prev_scan = sorted_scans[i-1]
            curr_scan = sorted_scans[i]
            
            if prev_scan.latitude is not None and prev_scan.longitude is not None and curr_scan.latitude is not None and curr_scan.longitude is not None:
                dist = haversine_distance(prev_scan.latitude, prev_scan.longitude, curr_scan.latitude, curr_scan.longitude)
                time_diff_hours = (curr_scan.timestamp - prev_scan.timestamp).total_seconds() / 3600.0
                
                if time_diff_hours > 0:
                    speed = dist / time_diff_hours
                    if speed > MAX_SPEED_KMH:
                        travel_score = min(20, travel_score + 20)
                        location_score = min(30, location_score + 30)
                        duplicate_score = min(25, duplicate_score + 25)
                        reasons.append(f"Impossible geographic movement detected: {dist:.0f} km in {time_diff_hours * 60:.0f} minutes.")
                elif dist > 0:
                    # Same exact time but different location
                    travel_score = min(20, travel_score + 20)
                    location_score = min(30, location_score + 30)
                    duplicate_score = min(25, duplicate_score + 25)
                    reasons.append(f"Multiple geographic locations detected simultaneously.")

    # 4. Supply chain mismatch
    if len(sorted_scans) > 0 and len(supply_chain) > 0:
        latest_scan = sorted_scans[-1]
        sorted_events = sorted(supply_chain, key=lambda e: e.timestamp)
        latest_event = sorted_events[-1]
        
        # Simple heuristic: if it hasn't shipped, it shouldn't be scanned far away
        if latest_event.event_type == "MANUFACTURED":
            if latest_scan.latitude and latest_event.latitude:
                dist = haversine_distance(latest_event.latitude, latest_event.longitude, latest_scan.latitude, latest_scan.longitude)
                if dist > 100:
                    supply_score = min(15, supply_score + 15)
                    reasons.append("Product scanned far from origin without shipping record.")
    
    if product.manufactured_at is None:
        supply_score = min(15, supply_score + 15)
        reasons.append("Product has no manufacturing record.")

    # 5. Determine level
    total = location_score + duplicate_score + travel_score + supply_score + frequency_score
    
    # Cap total just in case
    total = max(0, min(100, total))
    
    if total < 30:
        level = "LOW"
        v_level = 1
    elif total < 60:
        level = "MEDIUM"
        v_level = 2
    elif total < 80:
        level = "HIGH"
        v_level = 3
    else:
        level = "CRITICAL"
        v_level = 3
        
    return RiskAssessmentResult(
        total_score=total,
        risk_level=level,
        verification_level=v_level,
        location_anomaly=location_score,
        duplicate_scan_risk=duplicate_score,
        travel_anomaly=travel_score,
        supply_chain_mismatch=supply_score,
        scan_frequency=frequency_score,
        reasons=reasons
    )
