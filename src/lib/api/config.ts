/**
 * Central API configuration for VeriChain.
 *
 * All service functions must use these values — never hardcode URLs.
 *
 * Phase 1: All calls resolve to mock data.
 * Phase 2: Set VITE_API_BASE_URL to point at the FastAPI backend.
 */

/**
 * The backend mounts every router under `/api` and does not use a version
 * prefix (see backend/app/main.py and backend/app/api/*.py). The base URL
 * therefore already contains `/api`; endpoint paths below start at
 * `/products`, `/alerts`, etc.
 */
const configuredBaseUrl =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ??
  "http://localhost:8000/api";

export const API_CONFIG = {
  /**
   * Base URL for the FastAPI backend, without a trailing slash.
   * In development: http://localhost:8000/api
   * In production:  set via VITE_API_BASE_URL environment variable.
   */
  BASE_URL: configuredBaseUrl.replace(/\/+$/, ""),

  /**
   * Default request timeout in milliseconds.
   */
  TIMEOUT_MS: 10_000,

  /**
   * When true the service layer uses mock data instead of real HTTP calls.
   * The live demo runs against the FastAPI backend, so the default is false:
   * a missing backend must surface as an explicit error, never as invented
   * results. Set VITE_USE_MOCK=true to opt back into the offline mock path.
   */
  USE_MOCK:
    (import.meta.env["VITE_USE_MOCK"] as string | undefined) === "true",
} as const;

/**
 * Full API base path, e.g. "http://localhost:8000/api".
 * Do not append `/v1` — the backend routers are not versioned.
 */
export const API_BASE = API_CONFIG.BASE_URL;

/** Named endpoint paths — one place to update if the backend router changes. */
export const API_ENDPOINTS = {
  products: {
    list: "/products",
    detail: (id: string) => `/products/${encodeURIComponent(id)}`,
    verify: (id: string) => `/products/${encodeURIComponent(id)}/verify`,
    risk: (id: string) => `/products/${encodeURIComponent(id)}/risk`,
    provenance: (id: string) => `/products/${encodeURIComponent(id)}/provenance`,
    history: (id: string) =>
      `/products/${encodeURIComponent(id)}/verification-history`,
    blockchain: (id: string) =>
      `/products/${encodeURIComponent(id)}/blockchain`,
  },
  blockchain: {
    transactions: "/blockchain/transactions",
    networkStatus: "/blockchain/status",
  },
  alerts: {
    list: "/alerts",
    acknowledge: (id: string) => `/alerts/${encodeURIComponent(id)}/acknowledge`,
  },
} as const;
