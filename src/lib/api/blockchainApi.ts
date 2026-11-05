/**
 * Blockchain service — live backend integration.
 *
 * These functions never fabricate chain data. They call the FastAPI backend,
 * which in turn reads the local Hardhat node. When the backend or the node is
 * unreachable the result is an error, and the UI shows "Unavailable" rather
 * than a made-up network name, block number or transaction hash.
 */
import { API_BASE, API_ENDPOINTS } from "./config";
import type { ApiResult } from "@/types/api";
import type {
  BlockchainTransaction,
  NetworkStatus,
  TxStatus,
} from "@/types/blockchain";

/** Raw transaction shape returned by the backend (snake_case). */
interface BackendTransaction {
  id: number;
  product_id: string;
  transaction_hash: string;
  block_number: number | null;
  transaction_type: string;
  metadata_hash: string;
  contract_address: string;
  network: string;
  status: string;
  timestamp: string;
}

const TX_STATUSES: readonly TxStatus[] = ["CONFIRMED", "PENDING", "FAILED"];

function toTxStatus(raw: string): TxStatus {
  const upper = String(raw ?? "").toUpperCase();
  return (TX_STATUSES as readonly string[]).includes(upper)
    ? (upper as TxStatus)
    : "PENDING";
}

/** "3 min ago" style label derived from a real timestamp. */
function formatTimeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "Unknown";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function mapTransaction(raw: BackendTransaction): BlockchainTransaction {
  return {
    id: raw.id,
    blockNumber:
      raw.block_number === null || raw.block_number === undefined
        ? "Unavailable"
        : raw.block_number.toLocaleString("en-US"),
    hash: raw.transaction_hash,
    timeAgo: formatTimeAgo(raw.timestamp),
    timestamp: raw.timestamp,
    event: raw.transaction_type,
    productId: raw.product_id,
    status: toTxStatus(raw.status),
    contractAddress: raw.contract_address,
    network: raw.network,
    metadataHash: raw.metadata_hash,
  };
}

async function readJson<T>(url: string): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      return {
        ok: false,
        error: `Backend request failed (HTTP ${resp.status}).`,
        code: resp.status,
      };
    }
    return { ok: true, data: (await resp.json()) as T };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Blockchain backend unreachable: ${error.message}`
          : "Blockchain backend unreachable.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Get recorded blockchain transactions, optionally filtered by product ID.
 *
 * With a product ID this reads that product's ledger history; without one it
 * reads the backend-wide ledger. Both are read-only database queries.
 */
export async function getBlockchainTransactions(
  productId?: string
): Promise<ApiResult<BlockchainTransaction[]>> {
  const path = productId
    ? API_ENDPOINTS.products.blockchain(productId)
    : API_ENDPOINTS.blockchain.transactions;
  const result = await readJson<BackendTransaction[]>(`${API_BASE}${path}`);
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(mapTransaction) };
}

/** Get the live network status of the configured chain. */
export async function getNetworkStatus(): Promise<ApiResult<NetworkStatus>> {
  return readJson<NetworkStatus>(
    `${API_BASE}${API_ENDPOINTS.blockchain.networkStatus}`
  );
}
