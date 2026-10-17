/**
 * Supply-chain service — Phase 1 (mock implementation)
 */
import { provenanceRecords } from "@/lib/mockData";
import type { ApiResult } from "@/types/api";
import type { ProvenanceRecord } from "@/types/supplyChain";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Get the full provenance record for a product. */
export async function getProductProvenance(
  productId: string
): Promise<ApiResult<ProvenanceRecord>> {
  await delay(110);

  const record = provenanceRecords[productId.toUpperCase()];

  if (!record) {
    return {
      ok: false,
      error: `No provenance record found for "${productId}".`,
      code: 404,
    };
  }

  return { ok: true, data: record };
}
