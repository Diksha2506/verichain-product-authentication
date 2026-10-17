/**
 * Verification domain types for VeriChain Phase 1.
 * Compatible with a future FastAPI verification endpoint.
 */
import type { Product } from "./product";
import type { RiskAssessment } from "./risk";
import type { BlockchainTransaction } from "./blockchain";

// ─── Verification state machine ─────────────────────────────────────────────

/**
 * All possible states of the verification UI flow.
 * The UI renders exclusively based on this enum — no scattered booleans.
 */
export type VerificationState =
  | "idle"               // Nothing entered yet
  | "input"              // User is typing a product ID
  | "verifying_identity" // Step 1 — reading product identity
  | "checking_blockchain"// Step 2 — checking blockchain record
  | "checking_provenance"// Step 3 — validating provenance
  | "checking_clone"     // Step 4 — analyzing scan behaviour
  | "calculating_risk"   // Step 5 — calculating risk score
  | "success"            // Result: AUTHENTIC
  | "suspicious"         // Result: SUSPICIOUS
  | "clone_detected"     // Result: CLONE SUSPECTED
  | "not_found"          // Product ID not in registry
  | "error";             // Unexpected failure

/** Maps a verification state to its sequential 0-based step index (or -1). */
export const VERIFICATION_STEP_INDEX: Record<VerificationState, number> = {
  idle: -1,
  input: -1,
  verifying_identity: 0,
  checking_blockchain: 1,
  checking_provenance: 2,
  checking_clone: 3,
  calculating_risk: 4,
  success: 5,
  suspicious: 5,
  clone_detected: 5,
  not_found: 5,
  error: -1,
};

/** Step labels shown in the verification UI panel. */
export const VERIFICATION_STEP_LABELS = [
  "Reading product identity",
  "Checking blockchain record",
  "Validating product provenance",
  "Analyzing scan behavior",
  "Calculating risk score",
] as const;

// ─── Outcome types ────────────────────────────────────────────────────────────

export type VerificationOutcome =
  | "AUTHENTIC"
  | "SUSPICIOUS"
  | "CLONE SUSPECTED"
  | "NOT FOUND"
  | "INDETERMINATE";

// ─── Request / Response ───────────────────────────────────────────────────────

/** Input validated by Zod before being sent to the service layer. */
export interface VerificationRequest {
  productId: string;
}

export interface BlockchainEvidence {
  status: string;
  message: string;
  verified: boolean;
  onChainActive?: boolean | null;
  expectedHash?: string | null;
  contractAddress?: string | null;
  latestTxHash?: string | null;
}

export interface ProvenanceEvidence {
  eventCount: number;
  trailIntact: boolean;
  lastEvent?: string | null;
  lastLocation?: string | null;
  lastTimestamp?: string | null;
}

export interface RiskEvidence {
  totalScore: number;
  riskLevel: string;
  verificationLevel: number;
  reasons: string[];
  anomalies: Record<string, number>;
}

/** Full structured response from the verification service. */
export interface VerificationResponse {
  requestId: string;
  productId: string;
  outcome: VerificationOutcome;
  decisionReason?: string;
  /** Null when outcome is NOT_FOUND. */
  product: Product | null;
  riskAssessment: RiskAssessment;
  /** Adaptive verification depth triggered by this result. */
  verificationLevel: 1 | 2 | 3;
  /** Whether the product hash was confirmed on-chain. */
  blockchainVerified: boolean;
  /** Whether the supply-chain custody trail is intact. */
  provenanceVerified: boolean;
  /** Whether a clone was positively detected. */
  cloneDetected: boolean;
  /** Human-readable timestamp for display. */
  verifiedAt: string;
  /** ISO-8601 for sorting / backend storage. */
  verifiedAtIso: string;
  blockchainEvidence?: BlockchainEvidence;
  provenanceEvidence?: ProvenanceEvidence;
  riskEvidence?: RiskEvidence;
}

// ─── History / scan records ───────────────────────────────────────────────────

/** A single entry in the verification history log. */
export interface VerificationHistoryEntry {
  /** Links back to the product. */
  productId: string;
  /** Human-readable relative time. */
  timeAgo: string;
  /** City, Country string. */
  place: string;
  outcome: VerificationOutcome;
  /** ISO-8601 for sorting. */
  timestamp: string;
}

/** A block-explorer-style scan event linked to a blockchain transaction. */
export interface VerificationScan {
  scanId: string;
  productId: string;
  location: string;
  timeAgo: string;
  timestamp: string;
  transaction: BlockchainTransaction;
  outcome: VerificationOutcome;
}