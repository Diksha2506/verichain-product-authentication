/**
 * Shared API envelope types for VeriChain Phase 1.
 *
 * These wrappers mirror a standard FastAPI JSON response so the
 * service layer can swap mock data for real HTTP calls without
 * changing any component code.
 */

/** Generic success response wrapper. */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

/** Generic error response wrapper. */
export interface ApiError {
  ok: false;
  error: string;
  /** Optional machine-readable error code (HTTP status or domain code). */
  code?: number;
}

/** Union that every service function returns. */
export type ApiResult<T> = ApiSuccess<T> | ApiError;

/** Pagination metadata attached to list responses. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Paginated list response. */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}
