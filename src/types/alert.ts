/**
 * Alert domain types for VeriChain Phase 1.
 */

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AlertCategory =
  | "CLONE_DETECTED"
  | "IMPOSSIBLE_LOCATION"
  | "SCAN_FREQUENCY"
  | "SUPPLY_CHAIN_MISMATCH"
  | "VERIFICATION_COMPLETE";

/** A single alert entry in the alert center. */
export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  /** Product ID this alert is linked to. */
  productId: string;
  /** Human-readable relative time, e.g. "3 min ago". */
  timeAgo: string;
  /** ISO-8601 timestamp for future backend sorting. */
  timestamp: string;
  /** Whether the alert has been acknowledged. */
  acknowledged: boolean;
}
