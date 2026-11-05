/**
 * Phase 7B.2 — Canonical QR hash alignment tests.
 *
 * Verifies that QR hash sources come from the canonical metadata hash the
 * backend recomputes for a verified product, never from a possibly
 * noncanonical stored database hash, and that mock-mode behavior is
 * unchanged.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { mapBackendProduct, type BackendProduct } from "@/lib/api/productApi";
import { encodeQrPayload, parseQrPayload, QR_HASH_PREFIX_LENGTH } from "@/lib/qr";
import type { Product } from "@/types/product";

/** Reusable guard: fail loudly instead of assuming the verification product is present. */
function verifiedProductOf(product: Product | null): Product {
  if (!product) throw new Error("expected a non-null product in the verification response");
  return product;
}


// Demo (stored-column) hash used by seed.py and mockData.ts — NOT the canonical
// hash the backend computes for VC-NIKE-001.
const DEMO_HASH =
  "a3f9d2e1b8c7f4a0e6d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0";
// Canonical hash for VC-NIKE-001 derived from the backend canonical builder
// (verified by computation in the Phase 7B preflight).
const CANONICAL_HASH =
  "c7ff538e0104ba9d1c60f12e3b55e96195d4e326b8f6e580d67d6ced74ceac89";

const baseProduct: BackendProduct = {
  product_id: "VC-NIKE-001",
  name: "Nike Air Max 2026",
  status: "AUTHENTIC",
  metadata_hash: DEMO_HASH,
  batch_id: "B2026-091",
  serial_number: "NK-A26-0091842",
  manufacturer_id: 1,
  manufactured_at: "2026-09-05T00:00:00Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadApi(useMock: boolean) {
  vi.stubEnv("VITE_USE_MOCK", useMock ? "true" : "false");
  vi.resetModules();
  return await import("@/lib/api");
}

function stubVerifyResponse(payload: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    }))
  );
}

function verifyPayload(overrides: {
  expectedHash?: unknown;
  productId?: string;
  productProductId?: string;
}): Record<string, unknown> {
  const { expectedHash, productId = "VC-NIKE-001", productProductId = "VC-NIKE-001" } = overrides;
  const evidence = {
    status: "VERIFIED",
    message: "Product identity matches blockchain record.",
    verified: true,
    onChainActive: true,
    ...(expectedHash === undefined ? {} : { expectedHash }),
  };
  return {
    requestId: "req_test_1",
    productId,
    outcome: "AUTHENTIC",
    product: {
      ...baseProduct,
      product_id: productProductId,
    },
    riskAssessment: {
      location_anomaly: 3,
      duplicate_scan_risk: 2,
      travel_anomaly: 1,
      supply_chain_mismatch: 2,
      scan_frequency: 4,
      total_score: 12,
      risk_level: "LOW",
      verification_level: 1,
    },
    verificationLevel: 1,
    blockchainVerified: true,
    provenanceVerified: true,
    cloneDetected: false,
    verifiedAt: "Just now",
    verifiedAtIso: "2026-10-26T00:00:00Z",
    reasons: [],
    blockchainEvidence: evidence,
    provenanceEvidence: { eventCount: 4, trailIntact: true },
    riskEvidence: {
      totalScore: 12,
      riskLevel: "LOW",
      verificationLevel: 1,
      reasons: [],
      anomalies: {},
    },
  };
}

describe("Stored metadata_hash mapping normalization (Change A)", () => {
  it("passes a raw 64-hex stored hash through unchanged", () => {
    const mapped = mapBackendProduct(baseProduct);
    expect(mapped.metadataHash).toBe(DEMO_HASH);
  });

  it("strips a single leading 0x or 0X prefix", () => {
    expect(mapBackendProduct({ ...baseProduct, metadata_hash: `0x${DEMO_HASH}` }).metadataHash).toBe(DEMO_HASH);
    expect(mapBackendProduct({ ...baseProduct, metadata_hash: `0X${DEMO_HASH}` }).metadataHash).toBe(DEMO_HASH);
    // Only one prefix is stripped; a malformed inner value must not be repaired.
    expect(mapBackendProduct({ ...baseProduct, metadata_hash: `0x0x${DEMO_HASH}` }).metadataHash).toBe(
      `0x${DEMO_HASH}`
    );
  });

  it("never fabricates, truncates, or repairs invalid content", () => {
    expect(mapBackendProduct({ ...baseProduct, metadata_hash: null }).metadataHash).toBe("");
    expect(mapBackendProduct({ ...baseProduct, metadata_hash: "" }).metadataHash).toBe("");
    expect(mapBackendProduct({ ...baseProduct, metadata_hash: "not-a-hash" }).metadataHash).toBe(
      "not-a-hash"
    );
    expect(mapBackendProduct({ ...baseProduct, metadata_hash: "a1b2c3" }).metadataHash).toBe(
      "a1b2c3"
    );
  });
});

describe("Canonical expectedHash binding in real-API verification (Change B)", () => {
  it("uses a valid 0x-prefixed canonical expectedHash as the QR hash source", async () => {
    const api = await loadApi(false);
    stubVerifyResponse(verifyPayload({ expectedHash: `0x${CANONICAL_HASH}` }));
    const result = await api.verifyProduct({ productId: "VC-NIKE-001" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(verifiedProductOf(result.data.product).metadataHash).toBe(CANONICAL_HASH);
  });

  it("marks the QR hash unavailable when expectedHash is absent", async () => {
    const api = await loadApi(false);
    // blockchainEvidence present but without expectedHash — must NOT fall
    // back to the (potentially noncanonical) stored column value below.
    stubVerifyResponse(verifyPayload({}));
    const result = await api.verifyProduct({ productId: "VC-NIKE-001" });
    if (!result.ok) throw new Error("expected ok response");
    expect(verifiedProductOf(result.data.product).metadataHash).toBe("");
  });

  it("marks the QR hash unavailable for a malformed canonical hash", async () => {
    const api = await loadApi(false);
    stubVerifyResponse(verifyPayload({ expectedHash: "z".repeat(64) }));
    const result = await api.verifyProduct({ productId: "VC-NIKE-001" });
    if (!result.ok) throw new Error("expected ok response");
    expect(verifiedProductOf(result.data.product).metadataHash).toBe("");
  });

  it("marks the QR hash unavailable for a wrong-length canonical hash", async () => {
    const api = await loadApi(false);
    stubVerifyResponse(verifyPayload({ expectedHash: `0x${CANONICAL_HASH.slice(0, 63)}` }));
    const result = await api.verifyProduct({ productId: "VC-NIKE-001" });
    if (!result.ok) throw new Error("expected ok response");
    expect(verifiedProductOf(result.data.product).metadataHash).toBe("");
  });

  it("marks the QR hash unavailable when expectedHash belongs to a different product identity", async () => {
    const api = await loadApi(false);
    // Response advertises VC-NIKE-001 while product metadata belongs to another product's row.
    stubVerifyResponse(
      verifyPayload({
        expectedHash: `0x${CANONICAL_HASH}`,
        productId: "VC-NIKE-001",
        productProductId: "VC-SONY-003",
      })
    );
    const result = await api.verifyProduct({ productId: "VC-NIKE-001" });
    if (!result.ok) throw new Error("expected ok response");
    expect(verifiedProductOf(result.data.product).metadataHash).toBe("");
  });

  it("keeps the result identity intact in every case (id / outcome / risk)", async () => {
    const api = await loadApi(false);
    stubVerifyResponse(verifyPayload({}));
    const result = await api.verifyProduct({ productId: "VC-NIKE-001" });
    if (!result.ok) throw new Error("expected ok response");
    expect(result.data.productId).toBe("VC-NIKE-001");
    expect(result.data.outcome).toBe("AUTHENTIC");
    expect(result.data.riskAssessment.totalScore).toBe(12);
    expect(verifiedProductOf(result.data.product).id).toBe("VC-NIKE-001");
  });
});

describe("Mock-mode QR behavior preserved", () => {
  it("keeps the demo metadata hash and produces a scannable seal", async () => {
    const api = await loadApi(true);
    const result = await api.verifyProduct({ productId: "VC-NIKE-001" });
    if (!result.ok) throw new Error("expected ok response");
    const product = verifiedProductOf(result.data.product);
    expect(product.metadataHash).toBe(DEMO_HASH);
    const encoded = encodeQrPayload(product.id, product.metadataHash);
    const parsed = parseQrPayload(encoded);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.payload.productId).toBe(product.id);
    expect(parsed.payload.hashPrefix).toBe(DEMO_HASH.slice(0, QR_HASH_PREFIX_LENGTH).toLowerCase());
  });
});
