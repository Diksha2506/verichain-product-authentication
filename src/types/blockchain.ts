/**
 * Blockchain domain types for VeriChain Phase 1.
 */

export type TxStatus = "CONFIRMED" | "PENDING" | "FAILED";

/** A single on-chain transaction record. */
export interface BlockchainTransaction {
  /** Block number (formatted string for display). */
  blockNumber: string;
  /** Short transaction hash for display, e.g. "0x7a91…e82c". */
  hash: string;
  /** Human-readable relative time. */
  timeAgo: string;
  /** ISO-8601 timestamp for sorting. */
  timestamp: string;
  /** Descriptive event label, e.g. "Product verified". */
  event: string;
  productId: string;
  status: TxStatus;
  /** Gas used (placeholder — populated by real backend in Phase 3). */
  gasUsed?: number;
}

/** Network status returned by the blockchain service. */
export interface NetworkStatus {
  connected: boolean;
  latestBlock: string;
  finalitySeconds: number;
  networkName: string;
}