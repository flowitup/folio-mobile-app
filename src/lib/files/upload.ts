import { File } from "expo-file-system";

import { authedFetch } from "@/api/authed-fetch";
import { API_BASE_URL } from "@/config/env";
import { ApiError } from "@/lib/query/api-error";

import type { PickedFile } from "./pick";

/** Expo's fetch accepts expo-file-system `File` objects (Blob-compatible) as multipart parts. */
function toFormPart(file: PickedFile): Blob {
  return new File(file.uri) as unknown as Blob;
}

async function throwIfFailed(
  response: Response,
  fallbackCode: string,
): Promise<void> {
  if (response.ok) return;
  let code = fallbackCode;
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    if (body.error) code = body.error;
    if (body.message) message = body.message;
  } catch {
    // non-JSON error body; keep the HTTP status message
  }
  throw new ApiError(response.status, code, message);
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
  await throwIfFailed(response, "UploadFailed");
  return (await response.json()) as T;
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
