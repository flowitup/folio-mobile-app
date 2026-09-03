import { getStoredTokens } from "@/auth/token-storage";
import { API_BASE_URL } from "@/config/env";
import { ApiError } from "@/lib/query/api-error";

import type { PickedFile } from "./pick";

/** React Native's FormData accepts `{ uri, name, type }` objects as file parts. */
function toFormPart(file: PickedFile): unknown {
  return { uri: file.uri, name: file.name, type: file.mimeType };
}

async function authHeaders(): Promise<Record<string, string>> {
  const { accessToken } = await getStoredTokens();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function throwIfFailed(response: Response): Promise<void> {
  if (response.ok) return;
  let code = "HttpError";
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
 * `fields` are extra text parts. Returns the parsed JSON body.
 */
export async function uploadMultipart<T = unknown>(
  path: string,
  files: { field: string; file: PickedFile }[],
  fields: Record<string, string> = {},
): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const { field, file } of files)
    form.append(field, toFormPart(file) as Blob);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  await throwIfFailed(response);
  return (await response.json()) as T;
}

type PresignResponse = {
  upload_url: string;
  storage_key: string;
  headers?: Record<string, string>;
};

/**
 * Project document upload as the web does it: presign → PUT bytes to storage → confirm.
 * Returns the confirmed document JSON.
 */
export async function presignedUpload<T = unknown>(
  projectId: string,
  file: PickedFile,
): Promise<T> {
  const base = `${API_BASE_URL}/api/v1/projects/${encodeURIComponent(projectId)}/documents`;
  const headers = {
    ...(await authHeaders()),
    "Content-Type": "application/json",
  };

  const presign = await fetch(`${base}/presign`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename: file.name,
      content_type: file.mimeType,
      size: file.size,
    }),
  });
  await throwIfFailed(presign);
  const target = (await presign.json()) as PresignResponse;

  const bytes = await fetch(file.uri).then((r) => r.blob());
  const put = await fetch(target.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.mimeType, ...(target.headers ?? {}) },
    body: bytes,
  });
  if (!put.ok)
    throw new ApiError(
      put.status,
      "StorageUploadFailed",
      `Storage upload failed (HTTP ${put.status})`,
    );

  const confirm = await fetch(`${base}/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      storage_key: target.storage_key,
      filename: file.name,
      content_type: file.mimeType,
      size: file.size,
    }),
  });
  await throwIfFailed(confirm);
  return (await confirm.json()) as T;
}
