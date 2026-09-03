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
