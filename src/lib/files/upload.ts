import { Directory, File, Paths } from "expo-file-system";

import { authedFetch } from "@/api/authed-fetch";
import { API_BASE_URL } from "@/config/env";
import { ApiError, retryAfterSeconds } from "@/lib/query/api-error";

import type { PickedFile } from "./pick";

/** Where a picked file is copied when its own name is not the one to upload it under. */
const RENAMED = new Directory(Paths.cache, "upload-names");

/**
 * Expo's fetch accepts expo-file-system `File` objects (Blob-compatible) as multipart parts,
 * and the part is named after the file on disk — the third argument to `FormData.append` is
 * ignored. Android's photo picker hands over a cache copy named with a bare UUID, so pictures
 * arrived stored under that hex instead of the name the user sees. Copy the file next to a
 * correctly named sibling when the two differ; the cache directory is the system's to reclaim.
 */
function toFormPart(file: PickedFile): Blob {
  const source = new File(file.uri);
  if (source.name === file.name) return source as unknown as Blob;
  try {
    RENAMED.create({ intermediates: true, idempotent: true });
    const target = new File(RENAMED, file.name);
    if (target.exists) target.delete();
    source.copy(target);
    return target as unknown as Blob;
  } catch {
    // Never fail an upload over the file's name: send it under the picker's own.
    return source as unknown as Blob;
  }
}

async function throwIfFailed(
  response: Response,
  fallbackCode: string,
): Promise<void> {
  if (response.ok) return;
  let code = fallbackCode;
  let message = `HTTP ${response.status}`;
  let retryAfter = retryAfterSeconds(response.headers?.get("Retry-After"));
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
      retry_after?: unknown;
    };
    if (body.error) code = body.error;
    if (body.message) message = body.message;
    retryAfter ??= retryAfterSeconds(body.retry_after);
  } catch {
    // non-JSON error body; keep the HTTP status message
  }
  // A rate limit carries its wait, so a batch can pause and the toast can say how long.
  throw new ApiError(response.status, code, message, undefined, retryAfter);
}

const MB = 1024 * 1024;

/**
 * The API's size cap for an upload path (bytes), mirrored here so a file the server would refuse
 * is not sent first (the web checks the same before uploading). Null: no client-side cap.
 * Keep in step with the back end: upload_project_document.py (150 MB), upload_project_photo.py
 * (25 MB, videos 50 MB), upload_attachment.py and chat/usecases.py (10 MB), product and article
 * images (10 MB), project analyses (2 MB).
 */
export function uploadLimitBytes(
  path: string,
  mimeType?: string | null,
): number | null {
  const route = path.split("?")[0];
  if (/\/projects\/[^/]+\/documents(\/presign)?$/.test(route)) return 150 * MB;
  if (/\/projects\/[^/]+\/photos$/.test(route))
    return mimeType?.startsWith("video/") ? 50 * MB : 25 * MB;
  if (/\/projects\/[^/]+\/analyses$/.test(route)) return 2 * MB;
  if (
    /\/attachments$/.test(route) ||
    /\/chat\/channels\/[^/]+\/messages$/.test(route)
  )
    return 10 * MB;
  if (/\/image$/.test(route)) return 10 * MB;
  return null;
}

/** Throws the API's own 413 (FILE_TOO_LARGE) when `file` is over the path's cap. */
export function assertUploadSize(path: string, file: PickedFile): void {
  const limit = uploadLimitBytes(path, file.mimeType);
  if (limit === null || file.size === undefined || file.size <= limit) return;
  throw new ApiError(
    413,
    "FILE_TOO_LARGE",
    `${file.name} is larger than ${Math.round(limit / MB)} MB.`,
  );
}

/**
 * Multipart upload to an API path (invoice attachments, photos, product images…).
 * `fields` are extra text parts; array values repeat the key. Returns the parsed JSON body.
 */
export async function uploadMultipart<T = unknown>(
  path: string,
  files: { field: string; file: PickedFile }[],
  fields: Record<string, string | string[]> = {},
  signal?: AbortSignal,
): Promise<T> {
  // Refuse an oversized file before sending it over mobile data only to get a 413 back.
  for (const { file } of files) assertUploadSize(path, file);
  for (let attempt = 0; ; attempt += 1) {
    const form = new FormData();
    // Arrays repeat the key (e.g. `tags`), matching Flask `request.form.getlist`.
    for (const [key, value] of Object.entries(fields))
      for (const part of Array.isArray(value) ? value : [value])
        form.append(key, part);
    for (const { field, file } of files)
      form.append(field, toFormPart(file), file.name);
    const response = await authedFetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      body: form,
      signal,
    });
    try {
      await throwIfFailed(response, "UploadFailed");
    } catch (error) {
      // A batch of site photos can hit the per-minute cap: wait as long as the server says
      // (short waits only) and send the file again, instead of dropping it.
      const wait = rateLimitWait(error, attempt);
      if (wait === null || signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }
    return (await response.json()) as T;
  }
}

/** Upload retries on a 429 before giving up, and the longest wait (seconds) worth sitting out. */
const UPLOAD_429_RETRIES = 3;
const UPLOAD_429_MAX_WAIT = 65;

/** Seconds to wait before retrying a rate-limited upload, or null to give up. */
export function rateLimitWait(error: unknown, attempt: number): number | null {
  if (!(error instanceof ApiError) || error.status !== 429) return null;
  if (attempt >= UPLOAD_429_RETRIES) return null;
  const wait = error.retryAfter ?? 5;
  return wait <= UPLOAD_429_MAX_WAIT ? wait : null;
}

// Backend contract (project_documents/routes.py): presign → { presigned_url, storage_key, doc_id },
// confirm ← { doc_id, storage_key, filename, content_type, size_bytes }.
type PresignResponse = {
  presigned_url: string;
  storage_key: string;
  doc_id: string;
};

/** Reads the picked file from disk; the PUT needs raw bytes, not a multipart part. */
async function readFileBytes(file: PickedFile): Promise<Uint8Array> {
  return new File(file.uri).bytes();
}

/**
 * Project document upload as the web does it: presign → PUT bytes to storage → confirm.
 * Returns the confirmed document JSON.
 */
export async function presignedUpload<T = unknown>(
  projectId: string,
  file: PickedFile,
  signal?: AbortSignal,
): Promise<T> {
  const base = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/documents`;
  assertUploadSize(`/api/v1/projects/${projectId}/documents`, file);
  const bytes = await readFileBytes(file);
  const sizeBytes = file.size ?? bytes.byteLength;
  const json = { "Content-Type": "application/json" };

  const presign = await authedFetch(`${base}/presign`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      filename: file.name,
      content_type: file.mimeType,
      size_bytes: sizeBytes,
    }),
    signal,
  });
  await throwIfFailed(presign, "PresignFailed");
  const target = (await presign.json()) as PresignResponse;

  // Storage URL is not the API origin: authedFetch sends no Bearer here.
  const put = await authedFetch(target.presigned_url, {
    method: "PUT",
    headers: { "Content-Type": file.mimeType },
    // RN fetch accepts typed arrays via XHR; the DOM lib typing is narrower than the runtime.
    body: bytes as unknown as BodyInit,
    signal,
  });
  if (!put.ok)
    throw new ApiError(
      put.status,
      "StorageUploadFailed",
      `Storage upload failed (HTTP ${put.status})`,
    );

  const confirm = await authedFetch(`${base}/confirm`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      doc_id: target.doc_id,
      storage_key: target.storage_key,
      filename: file.name,
      content_type: file.mimeType,
      size_bytes: sizeBytes,
    }),
    signal,
  });
  await throwIfFailed(confirm, "ConfirmFailed");
  return (await confirm.json()) as T;
}
