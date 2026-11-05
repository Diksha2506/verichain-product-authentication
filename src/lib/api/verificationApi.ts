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
import { mapBackendProduct, type BackendProduct } from "./productApi";
import type { ApiResult } from "@/types/api";
import type { RiskFactors, RiskLevel } from "@/types/risk";
import type {
  VerificationRequest,
  VerificationResponse,
  VerificationHistoryEntry,
} from "@/types/verification";

/** Shape returned by `GET /api/products/{id}/verification-history`. */
interface BackendVerificationScan {
  timestamp: string;
  scan_location?: string | null;
  result: string;
}

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
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid verification request." };
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
    if (!resp.ok) {
      return {
        ok: false,
        error: `Backend request failed (HTTP ${resp.status}).`,
        code: resp.status,
      };
    }

    const data = await resp.json();

    // ─── Canonical QR hash alignment ────────────────────────────────────────
    // The backend recomputes the canonical metadata hash for the verified
    // product and returns it in blockchainEvidence.expectedHash. It is the QR
    // hash source only when it is complete (exactly 64 hex characters) and
    // belongs to the product announced by this verification response. When it
    // is absent or invalid, the mapped product's metadataHash becomes "" — QR
    // generation then refuses to fabricate a seal, and the hint comparison
    // reports "unknown" — instead of silently presenting the potentially
    // noncanonical stored database hash as canonical.
    const backendProduct = data.product as BackendProduct | null | undefined;
    const rawExpectedHash = data.blockchainEvidence?.expectedHash;
    const expectedHex =
      typeof rawExpectedHash === "string"
        ? rawExpectedHash.replace(/^0[xX]/, "") // strip one optional prefix
        : "";
    const sameProduct =
      backendProduct != null &&
      typeof backendProduct.product_id === "string" &&
      typeof data.productId === "string" &&
      backendProduct.product_id.toUpperCase() === data.productId.toUpperCase();
    const canonicalExpectedHex =
      sameProduct && /^[0-9a-f]{64}$/.test(expectedHex) ? expectedHex : "";

    // The verified product's metadata hash is the canonical hash, or "" when
    // no canonical hash is available. The verification boundary never falls
    // back to the stored column — a possibly noncanonical database value must
    // not masquerade as the canonical identity on a live verification result.
    const verifiedProduct = mapBackendProduct(
      backendProduct as BackendProduct,
      data.blockchainEvidence?.latestTxHash ?? ""
    );
    verifiedProduct.metadataHash = canonicalExpectedHex;

    // The backend returns snake_case risk columns; derive the frontend
    // RiskAssessment shape from them instead of inventing a second scoring path.
    const backendRisk = data.riskAssessment;
    const backendFactors: RiskFactors = backendRisk
      ? {
          location: backendRisk.location_anomaly,
          duplicateScans: backendRisk.duplicate_scan_risk,
          travel: backendRisk.travel_anomaly,
          supplyChain: backendRisk.supply_chain_mismatch,
          frequency: backendRisk.scan_frequency,
        }
      : { location: 0, duplicateScans: 0, travel: 0, supplyChain: 0, frequency: 0 };
    const riskAssessment = backendRisk
      ? {
          ...assessRisk(backendFactors),
          totalScore: backendRisk.total_score,
          level: backendRisk.risk_level as RiskLevel,
        }
      : assessRisk(backendFactors);

    return {
      ok: true,
      data: {
        requestId: data.requestId,
        productId: data.productId,
        outcome: data.outcome as VerificationResponse["outcome"],
        product: verifiedProduct,
        riskAssessment,
        verificationLevel: data.verificationLevel as 1 | 2 | 3,
        blockchainVerified: data.blockchainVerified,
        provenanceVerified: data.provenanceVerified,
        cloneDetected: data.cloneDetected,
        verifiedAt: data.verifiedAt,
        verifiedAtIso: data.verifiedAtIso,
        decisionReason: data.decisionReason,
        ...(data.blockchainEvidence
          ? {
              blockchainEvidence: {
                status: data.blockchainEvidence.status,
                message: data.blockchainEvidence.message,
                verified: data.blockchainEvidence.verified,
                onChainActive: data.blockchainEvidence.onChainActive,
                expectedHash: data.blockchainEvidence.expectedHash,
                contractAddress: data.blockchainEvidence.contractAddress,
                latestTxHash: data.blockchainEvidence.latestTxHash,
              },
            }
          : {}),
        ...(data.provenanceEvidence
          ? {
              provenanceEvidence: {
                eventCount: data.provenanceEvidence.eventCount,
                trailIntact: data.provenanceEvidence.trailIntact,
                lastEvent: data.provenanceEvidence.lastEvent,
                lastLocation: data.provenanceEvidence.lastLocation,
                lastTimestamp: data.provenanceEvidence.lastTimestamp,
              },
            }
          : {}),
        ...(data.riskEvidence
          ? {
              riskEvidence: {
                totalScore: data.riskEvidence.totalScore,
                riskLevel: data.riskEvidence.riskLevel,
                verificationLevel: data.riskEvidence.verificationLevel,
                reasons: data.riskEvidence.reasons,
                anomalies: data.riskEvidence.anomalies,
              },
            }
          : {}),
      }
    };
  } catch {
    return {
      ok: false,
      error:
        "Backend unavailable. Start the VeriChain API or enable mock mode (VITE_USE_MOCK).",
      code: 503,
    };
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
    if (!resp.ok) {
      return {
        ok: false,
        error: `Backend request failed (HTTP ${resp.status}).`,
        code: resp.status,
      };
    }

    const scans = (await resp.json()) as BackendVerificationScan[];
    return {
      ok: true,
      data: scans.map((scan) => ({
        productId: productId.toUpperCase(),
        timeAgo: new Date(scan.timestamp).toLocaleDateString(),
        place: scan.scan_location ?? "Unknown Location",
        outcome: scan.result as VerificationResponse["outcome"],
        timestamp: scan.timestamp,
      })),
    };
  } catch {
    return {
      ok: false,
      error:
        "Backend unavailable. Start the VeriChain API or enable mock mode (VITE_USE_MOCK).",
      code: 503,
    };
  }
}
