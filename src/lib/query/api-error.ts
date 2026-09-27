/** Error raised for any non-2xx API response, carrying the backend's error envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type FetchResult<T> = {
  data?: T;
  error?: unknown;
  response: { status: number; statusText: string };
};

// Backend error envelope: { error: "NotFound", message: "...", status_code: 404 }
function readEnvelope(error: unknown): { code?: string; message?: string } {
  if (typeof error !== "object" || error === null) return {};
  const body = error as { error?: unknown; message?: unknown };
  return {
    code: typeof body.error === "string" ? body.error : undefined,
    message: typeof body.message === "string" ? body.message : undefined,
  };
}

/** Turns an openapi-fetch result into data, throwing ApiError on failure. */
export function unwrap<T>(result: FetchResult<T>): T {
  if (result.error !== undefined || result.data === undefined) {
    const { code, message } = readEnvelope(result.error);
    throw new ApiError(
      result.response.status,
      code ?? "HttpError",
      message ??
        `HTTP ${result.response.status} ${result.response.statusText}`.trim(),
    );
  }
  return result.data;
}

/** Same as unwrap but for endpoints returning an empty body (204). */
export function unwrapVoid(result: FetchResult<unknown>): void {
  if (result.error !== undefined) unwrap(result);
}

/** unwrap for endpoints the spec leaves untyped (200 with no schema): caller asserts the shape. */
export function unwrapAs<T>(result: FetchResult<unknown>): T {
  return unwrap(result) as unknown as T;
}

/** Client errors a second identical request can still get past (session refresh, timeout, rate limit). */
const TRANSIENT_CLIENT_STATUSES = new Set([401, 408, 429]);

/**
 * Default query retry: one more try, except for a client error the backend will answer the
 * same way again — a 404 for a record that is gone or hidden from the caller, a 403, a 400.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= 1) return false;
  return !(
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    !TRANSIENT_CLIENT_STATUSES.has(error.status)
  );
}
