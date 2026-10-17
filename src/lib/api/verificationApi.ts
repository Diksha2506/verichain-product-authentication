/**
 * Verification service — Phase 1 (mock implementation)
 *
 * Implements the 5-step verification flow as async functions that
 * return fully-typed VerificationResponse objects.
 *
 * The verification state machine is driven by VerificationState from
 * src/types/verification.ts — no scattered booleans.
 */
import { z } from "zod";
import { products, verificationHistory } from "@/lib/mockData";
import { assessRisk } from "@/lib/riskEngine";
import { API_CONFIG, API_BASE, API_ENDPOINTS } from "./config";
import type { ApiResult } from "@/types/api";
import type {
  VerificationRequest,
  VerificationResponse,
  VerificationHistoryEntry,
} from "@/types/verification";

// ─── Validation ───────────────────────────────────────────────────────────────

export const VerificationRequestSchema = z.object({
  productId: z
    .string()
    .trim()
    .min(1, "Enter a product ID to begin verification.")
    .max(64, "Product ID is too long.")
    .regex(
      /^[A-Za-z0-9\-_]+$/,
      "Product ID may only contain letters, digits, hyphens, or underscores."
    ),
});

// ─── Deterministic outcome mapping ────────────────────────────────────────────

/**
 * Every known product always returns the same result.
 * New products default to NOT_FOUND.
 */
function resolveOutcome(
  product: (typeof products)[0] | undefined
): VerificationResponse["outcome"] {
  if (!product) return "NOT FOUND";
  return product.status;
}

// ─── Mock delay helper ────────────────────────────────────────────────────────

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Run the full 5-step verification flow and return a structured result.
 * In Phase 1 the "delay" simulates network + blockchain lookup latency.
 * In Phase 2 replace this with a real fetch() to the FastAPI endpoint.
 */
export async function verifyProduct(
  request: VerificationRequest
): Promise<ApiResult<VerificationResponse>> {
  const parsed = VerificationRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const { productId } = parsed.data;

  if (API_CONFIG.USE_MOCK) {
    // Simulate the 5 verification steps (each ~650 ms in the UI state machine)
    await delay(150);

    const product = products.find(
      (p) => p.id.toLowerCase() === productId.toLowerCase()
    );
    const outcome = resolveOutcome(product);
    const riskAssessment = product
      ? assessRisk(product.riskFactors)
      : assessRisk({ location: 0, duplicateScans: 0, travel: 0, supplyChain: 0, frequency: 0 });

    const verificationLevel =
      riskAssessment.totalScore < 30
        ? 1
        : riskAssessment.totalScore < 60
        ? 2
        : 3;

    const now = new Date();

    return {
      ok: true,
      data: {
        requestId: `REQ-${Date.now()}`,
        productId: productId.toUpperCase(),
        outcome,
        product: product ?? null,
        riskAssessment,
        verificationLevel: verificationLevel as 1 | 2 | 3,
        blockchainVerified: outcome !== "NOT FOUND",
        provenanceVerified: outcome === "AUTHENTIC",
        cloneDetected: outcome === "CLONE SUSPECTED",
        verifiedAt: "Just now",
        verifiedAtIso: now.toISOString(),
      },
    };
  }

  // Real backend
  try {
    const resp = await fetch(`${API_BASE}${API_ENDPOINTS.products.verify(productId)}`, {
      method: "POST",
    });
    if (resp.status === 404) return { ok: false, error: "Product not found", code: 404 };
    if (!resp.ok) return { ok: false, error: `Server error ${resp.status}`, code: resp.status };
    
    const data = await resp.json();
    return {
      ok: true,
      data: {
        requestId: data.requestId,
        productId: data.productId,
        outcome: data.outcome as VerificationResponse["outcome"],
        product: {
          id: data.product.product_id,
          name: data.product.name,
          manufacturer: data.product.manufacturer_id?.toString() ?? "Unknown",
          batchId: data.product.batch_id ?? "",
          serialNumber: data.product.serial_number ?? "",
          metadataHash: data.product.metadata_hash ?? "",
          status: data.product.status,
          manufacturedAt: data.product.manufactured_at ?? "Unknown",
          manufacturedDisplay: data.product.manufactured_at
            ? new Date(data.product.manufactured_at).toLocaleDateString()
            : "Unknown",
          riskFactors: { location: 0, duplicateScans: 0, travel: 0, supplyChain: 0, frequency: 0 },
          recentScans: [],
        },
        riskAssessment: {
          totalScore: data.riskAssessment.total_score,
          riskLevel: data.riskAssessment.risk_level,
          factors: {
            location: data.riskAssessment.location_anomaly,
            duplicateScans: data.riskAssessment.duplicate_scan_risk,
            travel: data.riskAssessment.travel_anomaly,
            supplyChain: data.riskAssessment.supply_chain_mismatch,
            frequency: data.riskAssessment.scan_frequency,
          },
          reasons: data.reasons,
        },
        verificationLevel: data.verificationLevel as 1 | 2 | 3,
        blockchainVerified: data.blockchainVerified,
        provenanceVerified: data.provenanceVerified,
        cloneDetected: data.cloneDetected,
        verifiedAt: data.verifiedAt,
        verifiedAtIso: data.verifiedAtIso,
        decisionReason: data.decisionReason,
        blockchainEvidence: data.blockchainEvidence
          ? {
              status: data.blockchainEvidence.status,
              message: data.blockchainEvidence.message,
              verified: data.blockchainEvidence.verified,
              onChainActive: data.blockchainEvidence.on_chain_active,
              expectedHash: data.blockchainEvidence.expected_hash,
              contractAddress: data.blockchainEvidence.contract_address,
              latestTxHash: data.blockchainEvidence.latest_tx_hash,
            }
          : undefined,
        provenanceEvidence: data.provenanceEvidence
          ? {
              eventCount: data.provenanceEvidence.event_count,
              trailIntact: data.provenanceEvidence.trail_intact,
              lastEvent: data.provenanceEvidence.last_event,
              lastLocation: data.provenanceEvidence.last_location,
              lastTimestamp: data.provenanceEvidence.last_timestamp,
            }
          : undefined,
        riskEvidence: data.riskEvidence
          ? {
              totalScore: data.riskEvidence.total_score,
              riskLevel: data.riskEvidence.risk_level,
              verificationLevel: data.riskEvidence.verification_level,
              reasons: data.riskEvidence.reasons,
              anomalies: data.riskEvidence.anomalies,
            }
          : undefined,
      }
    };
  } catch (err) {
    return { ok: false, error: "Backend unavailable" };
  }
}

/** Retrieve the verification history log, optionally filtered by product ID. */
export async function getVerificationHistory(
  productId?: string
): Promise<ApiResult<VerificationHistoryEntry[]>> {
  if (API_CONFIG.USE_MOCK) {
    await delay(80);

    const entries = productId
      ? verificationHistory.filter(
          (e) => e.productId.toLowerCase() === productId.toLowerCase()
        )
      : verificationHistory;

    return { ok: true, data: entries };
  }

  // Real backend
  if (!productId) return { ok: true, data: [] }; // Global history not supported yet in backend
  
  try {
    const resp = await fetch(`${API_BASE}${API_ENDPOINTS.products.history(productId)}`);
    if (!resp.ok) return { ok: false, error: `Server error ${resp.status}`, code: resp.status };
    
    const scans = await resp.json();
    return {
      ok: true,
      data: scans.map((scan: any) => ({
        productId: productId.toUpperCase(),
        timeAgo: new Date(scan.timestamp).toLocaleDateString(),
        place: scan.scan_location ?? "Unknown Location",
        outcome: scan.result,
        timestamp: scan.timestamp,
      })),
    };
  } catch (err) {
    return { ok: false, error: "Backend unavailable" };
  }
}
