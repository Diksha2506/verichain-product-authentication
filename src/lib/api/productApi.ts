/**
 * Product service — Phase 1 + Phase 2
 *
 * When USE_MOCK=true (default): resolves against mock data.
 * When USE_MOCK=false: calls the real FastAPI backend.
 *
 * Components import from "@/lib/api" — never this file directly.
 */
import { z } from "zod";
import { products } from "@/lib/mockData";
import { assessRisk } from "@/lib/riskEngine";
import { API_CONFIG, API_BASE, API_ENDPOINTS } from "./config";
import type { Product } from "@/types/product";
import type { ApiResult } from "@/types/api";

// ─── Validation ───────────────────────────────────────────────────────────────

/** Zod schema for a product ID supplied by the user. */
export const ProductIdSchema = z
  .string()
  .trim()
  .min(1, "Product ID cannot be empty.")
  .max(64, "Product ID is too long.")
  .regex(
    /^[A-Za-z0-9\-_]+$/,
    "Product ID may only contain letters, digits, hyphens, or underscores."
  );

// ─── Mock delay helper ────────────────────────────────────────────────────────

/** Simulate a realistic (non-annoying) API round-trip. */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Service functions ────────────────────────────────────────────────────────

/** List all registered products. */
export async function getProducts(): Promise<ApiResult<Product[]>> {
  if (API_CONFIG.USE_MOCK) {
    await delay(120);
    return { ok: true, data: products };
  }
  try {
    const resp = await fetch(`${API_BASE}${API_ENDPOINTS.products.list}`);
    if (!resp.ok) return { ok: false, error: `Server error ${resp.status}`, code: resp.status };
    return { ok: true, data: await resp.json() };
  } catch {
    return { ok: false, error: "Backend unavailable — falling back to mock data" };
  }
}

/** Look up a single product by ID (case-insensitive). */
export async function getProduct(
  productId: string
): Promise<ApiResult<Product>> {
  const parsed = ProductIdSchema.safeParse(productId);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };

  if (API_CONFIG.USE_MOCK) {
    await delay(80);
    const product = products.find(
      (p) => p.id.toLowerCase() === parsed.data.toLowerCase()
    );
    if (!product) {
      return {
        ok: false,
        error: `Product "${parsed.data}" is not in the demonstration registry.`,
        code: 404,
      };
    }
    return { ok: true, data: product };
  }

  // Real backend
  try {
    const resp = await fetch(`${API_BASE}${API_ENDPOINTS.products.detail(parsed.data)}`);
    if (resp.status === 404) return { ok: false, error: "Product not found", code: 404 };
    if (!resp.ok) return { ok: false, error: `Server error ${resp.status}`, code: resp.status };
    const backendProduct = await resp.json();
    // Map backend response to frontend Product type
    return {
      ok: true,
      data: {
        id: backendProduct.product_id,
        name: backendProduct.name,
        manufacturer: backendProduct.manufacturer_id?.toString() ?? "Unknown",
        batchId: backendProduct.batch_id ?? "",
        serialNumber: backendProduct.serial_number ?? "",
        metadataHash: backendProduct.metadata_hash ?? "",
        status: backendProduct.status,
        manufacturedAt: backendProduct.manufactured_at ?? "Unknown",
        manufacturedDisplay: backendProduct.manufactured_at
          ? new Date(backendProduct.manufactured_at).toLocaleDateString()
          : "Unknown",
        riskFactors: { location: 0, duplicateScans: 0, travel: 0, supplyChain: 0, frequency: 0 },
        recentScans: [],
      } satisfies Product,
    };
  } catch {
    // Graceful degradation: fall back to mock if backend is down
    const product = products.find(
      (p) => p.id.toLowerCase() === parsed.data.toLowerCase()
    );
    if (!product) return { ok: false, error: "Backend unavailable and product not in mock data", code: 503 };
    return { ok: true, data: product };
  }
}

/** Return the risk assessment for a specific product. */
export async function getProductRisk(
  productId: string
): Promise<ApiResult<{ product: Product; riskAssessment: ReturnType<typeof assessRisk> }>> {
  await delay(100);

  const result = await getProduct(productId);
  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      product: result.data,
      riskAssessment: assessRisk(result.data.riskFactors),
    },
  };
}

/** Search products by name, ID, manufacturer, or batch (case-insensitive). */
export async function searchProducts(
  query: string
): Promise<ApiResult<Product[]>> {
  await delay(60);

  const q = query.toLowerCase().trim();
  if (!q) return { ok: true, data: [] };

  const matches = products.filter((p) =>
    `${p.name} ${p.id} ${p.manufacturer} ${p.batchId}`
      .toLowerCase()
      .includes(q)
  );

  return { ok: true, data: matches };
}
