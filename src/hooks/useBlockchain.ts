/**
 * Live blockchain data hooks.
 *
 * These hooks surface exactly what the backend reports. There is no mock
 * fallback: if the request fails, `error` is set and `data` stays null so the
 * UI can render an explicit "Unavailable" state.
 */
import { useEffect, useState } from "react";

import { getBlockchainTransactions, getNetworkStatus } from "@/lib/api";
import type { BlockchainTransaction, NetworkStatus } from "@/types/blockchain";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: AsyncState<never> = { data: null, loading: true, error: null };

/** Poll the live chain status so the UI never shows a stale "connected". */
export function useNetworkStatus(pollMs = 15_000): AsyncState<NetworkStatus> {
  const [state, setState] = useState<AsyncState<NetworkStatus>>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await getNetworkStatus();
      if (cancelled) return;
      setState(
        result.ok
          ? { data: result.data, loading: false, error: null }
          : { data: null, loading: false, error: result.error }
      );
    };

    void load();
    const timer = setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  return state;
}

/** Read the recorded ledger (optionally for one product). Read-only. */
export function useLedgerTransactions(
  productId?: string
): AsyncState<BlockchainTransaction[]> {
  const [state, setState] = useState<AsyncState<BlockchainTransaction[]>>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    setState(INITIAL);

    const load = async () => {
      const result = await getBlockchainTransactions(productId);
      if (cancelled) return;
      setState(
        result.ok
          ? { data: result.data, loading: false, error: null }
          : { data: null, loading: false, error: result.error }
      );
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return state;
}
