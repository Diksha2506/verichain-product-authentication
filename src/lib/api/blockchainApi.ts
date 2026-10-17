/**
 * Blockchain service — Phase 1 (mock implementation)
 */
import { blockchainTransactions } from "@/lib/mockData";
import type { ApiResult } from "@/types/api";
import type { BlockchainTransaction, NetworkStatus } from "@/types/blockchain";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Get all recent blockchain transactions, optionally filtered by product ID. */
export async function getBlockchainTransactions(
  productId?: string
): Promise<ApiResult<BlockchainTransaction[]>> {
  await delay(90);

  const txs = productId
    ? blockchainTransactions.filter(
        (tx) => tx.productId.toLowerCase() === productId.toLowerCase()
      )
    : blockchainTransactions;

  return { ok: true, data: txs };
}

/** Get the current network status (mocked for Phase 1). */
export async function getNetworkStatus(): Promise<ApiResult<NetworkStatus>> {
  await delay(50);

  return {
    ok: true,
    data: {
      connected: true,
      latestBlock: "18,429,703",
      finalitySeconds: 2.4,
      networkName: "VeriChain Testnet",
    },
  };
}
