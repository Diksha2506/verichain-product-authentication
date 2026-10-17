/**
 * Risk domain types for VeriChain Phase 1.
 * Designed to be compatible with a future FastAPI + ML risk engine.
 */

/** Five risk signal categories, each with a defined maximum contribution. */
export interface RiskFactors {
  /** Unexpected or impossible geographic jump. Max 30. */
  location: number;
  /** Same product ID scanned at multiple places concurrently. Max 25. */
  duplicateScans: number;
  /** Geographic travel physically impossible in elapsed time. Max 20. */
  travel: number;
  /** Recorded custody chain does not match manufacturer data. Max 15. */
  supplyChain: number;
  /** Unusually high scan rate for a single identity. Max 10. */
  frequency: number;
}

/** One computed row in the risk-score breakdown table. */
export interface RiskFactorRow {
  label: string;
  value: number;
  max: number;
  /** Contribution as 0-100 percentage of its own maximum. */
  contributionPct: number;
}

/** Four-tier risk classification. */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Thresholds (inclusive lower bound):
 *  0–29   → LOW
 * 30–59   → MEDIUM
 * 60–79   → HIGH
 * 80–100  → CRITICAL
 */
export const RISK_THRESHOLDS = {
  MEDIUM: 30,
  HIGH: 60,
  CRITICAL: 80,
} as const;

/** Maximum points each factor can contribute (must sum to 100). */
export const RISK_FACTOR_MAXIMA: Readonly<RiskFactors> = {
  location: 30,
  duplicateScans: 25,
  travel: 20,
  supplyChain: 15,
  frequency: 10,
} as const;

/**
 * Verification depth that the risk level recommends.
 * Maps directly to the three-level adaptive system shown in the UI.
 */
export type VerificationLevel = 1 | 2 | 3;

/** Full structured result returned by the risk engine. */
export interface RiskAssessment {
  /** Clamped 0-100 composite score. */
  totalScore: number;
  level: RiskLevel;
  factors: RiskFactorRow[];
  /** One-sentence human-readable explanation. */
  explanation: string;
  /** Recommended adaptive verification depth. */
  recommendedVerificationLevel: VerificationLevel;
}
