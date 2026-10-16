import {
  assertUploadSize,
  rateLimitWait,
  uploadLimitBytes,
  uploadMultipart,
} from "@/lib/files/upload";
import { ApiError } from "@/lib/query/api-error";

jest.mock("expo-file-system", () => ({
  Directory: class {
    create() {}
  },
  // Blob-compatible, as expo-file-system's File is for multipart parts.
  File: class extends Blob {
    name: string;
    constructor(uri: string) {
      super(["bytes"]);
      this.name = uri.split("/").pop() ?? "";
    }
  },
  Paths: { cache: "cache" },
}));

const mockAuthedFetch = jest.fn();
jest.mock("@/api/authed-fetch", () => ({
  authedFetch: (...args: unknown[]) => mockAuthedFetch(...args),
}));

const MB = 1024 * 1024;
const photo = {
  uri: "file:///p/IMG_1.jpg",
  name: "IMG_1.jpg",
  mimeType: "image/jpeg",
  size: 3 * MB,
};

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    ok: status < 400,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
  };
}

describe("upload size caps (config-deploy-25)", () => {
  it("mirrors the API's caps per upload path", () => {
    expect(uploadLimitBytes("/api/v1/projects/p/documents")).toBe(150 * MB);
    expect(uploadLimitBytes("/api/v1/projects/p/photos", "image/jpeg")).toBe(
      25 * MB,
    );
    expect(uploadLimitBytes("/api/v1/projects/p/photos", "video/mp4")).toBe(
      50 * MB,
    );
    expect(uploadLimitBytes("/api/v1/projects/p/invoices/i/attachments")).toBe(
      10 * MB,
    );
    expect(uploadLimitBytes("/api/v1/projects/p/analyses")).toBe(2 * MB);
    expect(uploadLimitBytes("/api/v1/whatever")).toBeNull();
  });

  it("refuses an oversized file before sending anything", async () => {
    const big = { ...photo, size: 30 * MB };
    expect(() => assertUploadSize("/api/v1/projects/p/photos", big)).toThrow(
      ApiError,
    );
    await expect(
      uploadMultipart("/api/v1/projects/p/photos", [
        { field: "file", file: big },
      ]),
    ).rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
    expect(mockAuthedFetch).not.toHaveBeenCalled();
  });
});

describe("rate-limited uploads (sweep-rate-limits-10)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAuthedFetch.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it("waits out a short 429 and sends the file again", async () => {
    mockAuthedFetch
      .mockResolvedValueOnce(
        response(
          429,
          { error: "TooManyRequests", retry_after: 2 },
          { "Retry-After": "2" },
        ),
      )
      .mockResolvedValueOnce(response(201, { id: "ph-1" }));
    const pending = uploadMultipart("/api/v1/projects/p/photos", [
      { field: "file", file: photo },
    ]);
    await jest.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toEqual({ id: "ph-1" });
    expect(mockAuthedFetch).toHaveBeenCalledTimes(2);
  });

  it("gives up on long waits and after a few tries", () => {
    const limited = (s: number) =>
      new ApiError(429, "TooManyRequests", "x", undefined, s);
    expect(rateLimitWait(limited(10), 0)).toBe(10);
    expect(rateLimitWait(limited(3600), 0)).toBeNull();
    expect(rateLimitWait(limited(10), 3)).toBeNull();
    expect(rateLimitWait(new ApiError(500, "x", "y"), 0)).toBeNull();
  });
});
