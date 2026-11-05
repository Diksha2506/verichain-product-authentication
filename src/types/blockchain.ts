/**
 * Blockchain domain types for VeriChain.
 *
 * Values rendered from these types must come from a real backend response.
 * When the backend cannot observe a value, the corresponding field is null and
 * the UI renders "Unavailable" instead of inventing data.
 */

export type TxStatus = "CONFIRMED" | "PENDING" | "FAILED";

/** A single on-chain transaction record recorded by the backend. */
export interface BlockchainTransaction {
  /** Backend row id (absent on legacy sample records). */
  id?: number;
  /** Block number as a formatted string, or "Unavailable" when unset. */
  blockNumber: string;
  /** Full transaction hash (never a fabricated value). */
  hash: string;
  /** Human-readable relative time derived from `timestamp`. */
  timeAgo: string;
  /** ISO-8601 timestamp for sorting. */
  timestamp: string;
  /** Descriptive event label, e.g. "REGISTRATION". */
  event: string;
  productId: string;
  status: TxStatus;
  /** Contract address that emitted the transaction. */
  contractAddress?: string;
  /** Network label recorded with the transaction. */
  network?: string;
  /** Canonical metadata hash registered on-chain. */
  metadataHash?: string;
}

/**
 * Network status returned by `GET /api/blockchain/status`.
 *
 * `chainId` and `blockNumber` are null whenever the node cannot be read.
 */
export interface NetworkStatus {
  connected: boolean;
  chainId: number | null;
  expectedChainId: number;
  chainIdMatches: boolean;
  /** "Hardhat Local", "Unexpected network" or "Unavailable". */
  networkName: string;
  contractAddress: string;
  contractDeployed: boolean;
  blockNumber: number | null;
}
