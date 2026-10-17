/**
 * Central API configuration for VeriChain.
 *
 * All service functions must use these values — never hardcode URLs.
 *
 * Phase 1: All calls resolve to mock data.
 * Phase 2: Set VITE_API_BASE_URL to point at the FastAPI backend.
 */

export const API_CONFIG = {
  /**
   * Base URL for the FastAPI backend.
   * In development: http://localhost:8000/api
   * In production:  set via VITE_API_BASE_URL environment variable.
   */
  BASE_URL:
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    "http://localhost:8000/api",

  /**
   * Default request timeout in milliseconds.
   */
  TIMEOUT_MS: 10_000,

  /**
   * API version prefix appended to BASE_URL.
   * Keep in sync with the FastAPI router prefix.
   */
  VERSION: "v1",

  /**
   * When true the service layer uses mock data instead of real HTTP calls.
   * Automatically true in Phase 1 (no backend exists yet).
   * Set VITE_USE_MOCK=false to force real API calls.
   */
  USE_MOCK:
    (import.meta.env.VITE_USE_MOCK as string | undefined) !== "false",
} as const;

/** Full versioned API base path, e.g. "http://localhost:8000/api/v1". */
export const API_BASE = `${API_CONFIG.BASE_URL}/${API_CONFIG.VERSION}`;

/** Named endpoint paths — one place to update if the backend router changes. */
export const API_ENDPOINTS = {
  products: {
    list: "/products",
    detail: (id: string) => `/products/${encodeURIComponent(id)}`,
    verify: (id: string) => `/products/${encodeURIComponent(id)}/verify`,
    risk: (id: string) => `/products/${encodeURIComponent(id)}/risk`,
    provenance: (id: string) => `/products/${encodeURIComponent(id)}/provenance`,
    history: (id: string) => `/products/${encodeURIComponent(id)}/history`,
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
