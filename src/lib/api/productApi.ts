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
import type { Product, ProductStatus } from "@/types/product";
import type { ApiResult } from "@/types/api";

// ─── Backend response mapping ────────────────────────────────────────────────

/**
 * Shape returned by `GET /api/products` and `GET /api/products/{id}`
 * (see backend/app/schemas/product.py).
 */
export interface BackendProduct {
  product_id: string;
  name: string;
  manufacturer_id?: number | null;
  batch_id?: string | null;
  serial_number?: string | null;
  metadata_hash?: string | null;
  status: string;
  manufactured_at?: string | null;
}

/**
 * Convert a backend product record into the frontend `Product` domain type.
 *
 * The backend uses snake_case field names; the UI uses camelCase. Keeping this
 * mapping in one place ensures list, detail, and verification responses all
 * populate the same fields (batchId / serialNumber / manufacturedAt ...).
 */
export function mapBackendProduct(
  backendProduct: BackendProduct,
  blockchainTxHash = ""
): Product {
  // Normalize an optional single leading 0x/0X prefix from the stored column
  // hash. Nothing else is repaired: invalid, empty, or short values stay as
  // they are (status quo for display; QR hash authority is decided by the
  // verification response mapping, which replaces this with the canonical
  // hash for live results).
  const metadataHash = (backendProduct.metadata_hash ?? "").replace(/^0[xX]/, "");
  return {
    id: backendProduct.product_id,
    name: backendProduct.name,
    manufacturer: backendProduct.manufacturer_id?.toString() ?? "Unknown",
    batchId: backendProduct.batch_id ?? "",
    serialNumber: backendProduct.serial_number ?? "",
    metadataHash,
    status: backendProduct.status as ProductStatus,
    manufacturedAt: backendProduct.manufactured_at ?? "Unknown",
    manufacturedDisplay: backendProduct.manufactured_at
      ? new Date(backendProduct.manufactured_at).toLocaleDateString()
      : "Unknown",
    riskFactors: {
      location: 0,
      duplicateScans: 0,
      travel: 0,
      supplyChain: 0,
      frequency: 0,
    },
    recentScans: [],
    blockchainTxHash,
  };
}

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
    if (!resp.ok) {
      return {
        ok: false,
        error: `Backend request failed (HTTP ${resp.status}).`,
        code: resp.status,
      };
    }
    const payload: unknown = await resp.json();
    if (!Array.isArray(payload)) {
      return { ok: false, error: "Backend returned an unexpected response." };
    }
    return {
      ok: true,
      data: (payload as BackendProduct[]).map((item) => mapBackendProduct(item)),
    };
  } catch {
    return {
      ok: false,
      error:
        "Backend unavailable. Start the VeriChain API or enable mock mode (VITE_USE_MOCK).",
    };
  }
}

/** Look up a single product by ID (case-insensitive). */
export async function getProduct(
  productId: string
): Promise<ApiResult<Product>> {
  const parsed = ProductIdSchema.safeParse(productId);
  if (!parsed.success)
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid product ID." };

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
    if (!resp.ok) {
      return {
        ok: false,
        error: `Backend request failed (HTTP ${resp.status}).`,
        code: resp.status,
      };
    }
    const backendProduct = (await resp.json()) as BackendProduct;
    return { ok: true, data: mapBackendProduct(backendProduct) };
  } catch {
    // Never substitute mock data in real API mode: a failed lookup must stay
    // visible so the caller does not treat demo data as a live result.
    return {
      ok: false,
      error:
        "Backend unavailable. Start the VeriChain API or enable mock mode (VITE_USE_MOCK).",
      code: 503,
    };
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
