/**
 * Supply-chain domain types for VeriChain Phase 1.
 */

/** A single custody handoff event in the product journey. */
export interface SupplyChainEvent {
  /** Sequential position (0 = manufacturer). */
  order: number;
  /** UI label, e.g. "Manufacturer", "Distribution". */
  title: string;
  /** Company / entity name. */
  entityName: string;
  /** City, Country. */
  location: string;
  /** ISO-8601 datetime string. */
  timestamp: string;
  /** Blockchain transaction reference hash. */
  transactionHash: string;
  /** Human-readable custody note. */
  detail: string;
  /** Whether this step has been cryptographically confirmed. */
  confirmed: boolean;
}

/** Full provenance record returned by the supply-chain service. */
export interface ProvenanceRecord {
  productId: string;
  productName: string;
  batchId: string;
  events: SupplyChainEvent[];
  /** True if every step has been confirmed on-chain. */
  integrityVerified: boolean;
}
