/**
 * VeriChain Risk Engine — Phase 1
 *
 * Deterministic, structured risk scoring.
 * Accepts a typed RiskFactors object and returns a full RiskAssessment.
 * Ready to be replaced by a ML-backed service call in Phase 3.
 */
import type { RiskFactors } from "@/types/risk";
import {
  RISK_FACTOR_MAXIMA,
  RISK_THRESHOLDS,
  type RiskAssessment,
  type RiskFactorRow,
  type RiskLevel,
  type VerificationLevel,
} from "@/types/risk";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the composite risk score (clamped 0-100) from raw risk factors.
 * The score is the sum of all factor values, clamped to 100.
 */
export function calculateRiskScore(factors: RiskFactors): number {
  const raw = Object.values(factors).reduce((sum, v) => sum + v, 0);
  return Math.min(100, Math.max(0, raw));
}

/**
 * Classify a numeric score into a named risk level.
 *
 * Thresholds (inclusive lower bound):
 *  0–29   → LOW
 * 30–59   → MEDIUM
 * 60–79   → HIGH
 * 80–100  → CRITICAL
 */
export function classifyRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.CRITICAL) return "CRITICAL";
  if (score >= RISK_THRESHOLDS.HIGH) return "HIGH";
  if (score >= RISK_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

/**
 * Determine the adaptive verification level from a risk level.
 *
 * LOW    → Level 1 (product ID + blockchain record + metadata hash)
 * MEDIUM → Level 2 (+ location, scan history, purchase evidence)
 * HIGH / CRITICAL → Level 3 (+ supply chain, behaviour, identity evidence)
 */
export function recommendVerificationLevel(
  level: RiskLevel
): VerificationLevel {
  if (level === "LOW") return 1;
  if (level === "MEDIUM") return 2;
  return 3;
}

/**
 * Build the breakdown table shown in the Risk Intelligence panel.
 */
export function buildRiskFactorRows(factors: RiskFactors): RiskFactorRow[] {
  return [
    {
      label: "Location anomaly",
      value: factors.location,
      max: RISK_FACTOR_MAXIMA.location,
      contributionPct: pct(factors.location, RISK_FACTOR_MAXIMA.location),
    },
    {
      label: "Duplicate scans",
      value: factors.duplicateScans,
      max: RISK_FACTOR_MAXIMA.duplicateScans,
      contributionPct: pct(
        factors.duplicateScans,
        RISK_FACTOR_MAXIMA.duplicateScans
      ),
    },
    {
      label: "Travel anomaly",
      value: factors.travel,
      max: RISK_FACTOR_MAXIMA.travel,
      contributionPct: pct(factors.travel, RISK_FACTOR_MAXIMA.travel),
    },
    {
      label: "Supply-chain mismatch",
      value: factors.supplyChain,
      max: RISK_FACTOR_MAXIMA.supplyChain,
      contributionPct: pct(factors.supplyChain, RISK_FACTOR_MAXIMA.supplyChain),
    },
    {
      label: "Scan frequency",
      value: factors.frequency,
      max: RISK_FACTOR_MAXIMA.frequency,
      contributionPct: pct(factors.frequency, RISK_FACTOR_MAXIMA.frequency),
    },
  ];
}

/**
 * One-line explanation sentences per risk level.
 * Kept deterministic — the same level always produces the same text.
 */
const EXPLANATIONS: Record<RiskLevel, string> = {
  LOW: "All risk signals are within expected ranges. No anomalies detected.",
  MEDIUM:
    "Moderate anomalies detected. Enhanced verification is recommended before release.",
  HIGH:
    "Significant risk signals observed. Immediate enhanced inspection required.",
  CRITICAL:
    "Critical fraud indicators detected. Treat this item as potentially counterfeit.",
};

/**
 * Compute a full RiskAssessment from a raw factors object.
 * This is the primary entry point for the service layer and tests.
 */
export function assessRisk(factors: RiskFactors): RiskAssessment {
  const totalScore = calculateRiskScore(factors);
  const level = classifyRiskLevel(totalScore);
  return {
    totalScore,
    level,
    factors: buildRiskFactorRows(factors),
    explanation: EXPLANATIONS[level],
    recommendedVerificationLevel: recommendVerificationLevel(level),
  };
}

// ─── Legacy shims (keeps existing UI imports working) ─────────────────────────

/** @deprecated Use calculateRiskScore(product.riskFactors) instead. */
export const calculateRisk = (product: { riskFactors: RiskFactors }): number =>
  calculateRiskScore(product.riskFactors);

/** @deprecated Use classifyRiskLevel(score) instead. */
export const describeRisk = (score: number): string =>
  classifyRiskLevel(score);

/** @deprecated Use buildRiskFactorRows(product.riskFactors) instead. */
export const riskFactorRows = (
  factors: RiskFactors
): Array<{ label: string; value: number; max: number }> =>
  buildRiskFactorRows(factors);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((value / max) * 100);
}