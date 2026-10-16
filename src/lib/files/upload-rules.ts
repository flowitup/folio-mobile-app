import type { PickedFile } from "@/lib/files/pick";
import { apiErrorMessage } from "@/lib/query/api-error-message";
import { ApiError } from "@/lib/query/api-error";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Project documents: the extensions the API accepts (upload_project_document.py). */
export const DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".docx",
  ".xlsx",
  ".dwg",
  ".txt",
] as const;

/**
 * What the system document picker offers for project documents. DWG has no MIME type the
 * pickers agree on, so drawings come through the octet-stream / acad types; the extension
 * check below still refuses anything else before the upload.
 */
export const DOCUMENT_PICKER_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/acad",
  "application/x-acad",
  "application/dwg",
  "image/vnd.dwg",
  "image/x-dwg",
  "application/octet-stream",
];

/** Site photos and videos (upload_project_photo.py). */
export const PHOTO_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
] as const;

/** HTML analysis reports (create_project_analysis_usecase.py). */
export const ANALYSIS_EXTENSIONS = [".html", ".htm"] as const;
export const ANALYSIS_PICKER_TYPES = ["text/html", "application/xhtml+xml"];

export type UploadProblem =
  { kind: "unsupported"; ext: string } | { kind: "empty" };

function extensionOf(name: string): string {
  return /(\.[^./\\]+)$/.exec(name.trim())?.[1]?.toLowerCase() ?? "";
}

/**
 * Why the API would refuse this file, found before uploading it: a type it does not take or an
 * empty file. Null when the file can go up (an unknown size is left to the server).
 */
export function uploadProblem(
  file: Pick<PickedFile, "name" | "size">,
  extensions: readonly string[],
): UploadProblem | null {
  const ext = extensionOf(file.name);
  if (!extensions.includes(ext))
    return { kind: "unsupported", ext: ext || file.name };
  if (file.size === 0) return { kind: "empty" };
  return null;
}

/** "photo.heic: .heic files are not accepted (allowed: …)" in the UI language. */
export function uploadProblemMessage(
  file: Pick<PickedFile, "name">,
  problem: UploadProblem,
  extensions: readonly string[],
  t: Translate,
): string {
  return problem.kind === "empty"
    ? t("uploads.empty", { name: file.name })
    : t("uploads.unsupported", {
        name: file.name,
        ext: problem.ext,
        allowed: extensions.join(" "),
      });
}

/**
 * A refused upload, named after its file: the generic status texts ("check the form", "try
 * again") never say that the file itself is the problem, nor which one of several.
 */
export function uploadErrorMessage(
  error: unknown,
  file: Pick<PickedFile, "name">,
  extensions: readonly string[],
  t: Translate,
  language: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 415 || error.code === "UNSUPPORTED_TYPE")
      return uploadProblemMessage(
        file,
        { kind: "unsupported", ext: extensionOf(file.name) || file.name },
        extensions,
        t,
      );
    if (error.code === "EMPTY_FILE" || /\bempty\b/i.test(error.message))
      return t("uploads.empty", { name: file.name });
    if (error.code === "InvalidEncoding")
      return t("uploads.invalidEncoding", { name: file.name });
    if (error.status === 413 || error.code === "FILE_TOO_LARGE")
      return t("uploads.tooLarge", { name: file.name });
    if (error.code === "InvalidFile" && /extension/i.test(error.message))
      return uploadProblemMessage(
        file,
        { kind: "unsupported", ext: extensionOf(file.name) || file.name },
        extensions,
        t,
      );
  }
  return t("uploads.failed", {
    name: file.name,
    reason: apiErrorMessage(error, t, language),
  });
}

/**
 * Uploads picked files one by one and returns one message per refused file, by name: a file the
 * API would refuse (type, empty) is not sent at all when `precheck` is on.
 */
export async function uploadEach(
  files: PickedFile[],
  extensions: readonly string[],
  send: (file: PickedFile) => Promise<unknown>,
  t: Translate,
  language: string,
  precheck = true,
): Promise<string[]> {
  const problems: string[] = [];
  for (const file of files) {
    const problem = precheck ? uploadProblem(file, extensions) : null;
    if (problem) {
      problems.push(uploadProblemMessage(file, problem, extensions, t));
      continue;
    }
    try {
      await send(file);
    } catch (error) {
      problems.push(uploadErrorMessage(error, file, extensions, t, language));
    }
  }
  return problems;
}
