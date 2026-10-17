/**
 * Alert service — Phase 1 (mock implementation)
 */
import { alerts } from "@/lib/mockData";
import type { ApiResult } from "@/types/api";
import type { Alert } from "@/types/alert";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Get all alerts (unacknowledged first). */
export async function getAlerts(): Promise<ApiResult<Alert[]>> {
  await delay(70);
  return { ok: true, data: [...alerts].sort((a, b) =>
    Number(a.acknowledged) - Number(b.acknowledged)
  )};
}

/** Get the count of unacknowledged alerts. */
export async function getUnacknowledgedAlertCount(): Promise<ApiResult<number>> {
  await delay(40);
  return { ok: true, data: alerts.filter((a) => !a.acknowledged).length };
}
