import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  cachedFileExists,
  downloadToCache,
  shareLocalFile,
} from "@/lib/files/download";
import { isPdfFile } from "@/lib/files/pdf";

/**
 * Local files the viewer may show, by opaque token. The route carries only the token: every
 * route is reachable through a `folio://` link, and a path in the URL would let any link point
 * the viewer at an arbitrary file or web page.
 */
const viewerFiles = new Map<string, string>();
let nextToken = 0;

/** The local file registered under a viewer token, or null for an unknown / forged token. */
export function resolveViewerFile(token: string | undefined): string | null {
  return (token && viewerFiles.get(token)) || null;
}

function registerViewerFile(uri: string): string {
  nextToken += 1;
  const token = `${Date.now().toString(36)}-${nextToken}`;
  viewerFiles.set(token, uri);
  return token;
}

/** Shows a local PDF (cache download or expo-print output) in the in-app viewer. */
export function openPdfViewer(uri: string, title: string): void {
  const file = registerViewerFile(uri);
  router.push({ pathname: "/pdf-viewer", params: { file, title } });
}

/** Shows a local image (receipt photo, scanned document) in the in-app image viewer. */
export function openImageViewer(
  uri: string,
  title: string,
  mimeType?: string | null,
): void {
  const file = registerViewerFile(uri);
  router.push({
    pathname: "/image-viewer",
    params: { file, title, mime: mimeType ?? "" },
  });
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
// Android's image decoder cannot be relied on for HEIC: those still go to the share sheet.
const ANDROID_UNSUPPORTED = /^image\/hei[cf]$|\.(heic|heif)$/i;

/** Whether the app can show a file itself as a picture, from its MIME type or its extension. */
export function isViewableImage(file: {
  filename: string;
  mimeType?: string | null;
}): boolean {
  const mime = file.mimeType?.split(";")[0].trim().toLowerCase() ?? "";
  const image = mime.startsWith("image/")
    ? mime !== "image/svg+xml" && mime !== "image/tiff"
    : IMAGE_EXTENSIONS.test(file.filename.trim());
  if (!image) return false;
  if (
    Platform.OS === "android" &&
    (ANDROID_UNSUPPORTED.test(mime) ||
      ANDROID_UNSUPPORTED.test(file.filename.trim()))
  )
    return false;
  return true;
}

/**
 * Name the cached copy of a PDF is saved under. iOS WKWebView picks how to show a local file
 * from its extension, so a PDF whose name lacks `.pdf` (known only by its MIME type) would
 * load as a blank or text page; the copy gets the extension, the viewer keeps the real name.
 */
export function pdfCacheName(filename: string): string {
  return /\.pdf$/i.test(filename.trim()) ? filename : `${filename}.pdf`;
}

/** Downloads in flight, by API path: a double tap must not open the file twice. */
const opening = new Map<string, Promise<string>>();

/**
 * Files opened recently, by API path and version: opening the same document again shows the
 * copy already downloaded instead of fetching it again (a rate-limited request, and a wait).
 */
const recent = new Map<string, { uri: string; at: number }>();
/** A versioned file (its `updated_at`, or immutable) is reused this long… */
const REUSE_VERSIONED_MS = 30 * 60 * 1000;
/** …and an unversioned one (an export) only for a quick second tap. */
const REUSE_UNVERSIONED_MS = 60 * 1000;
const MAX_RECENT = 50;

export type OpenFileOptions = {
  /** What changes when the file does (`updated_at`), or "immutable"; enables reuse. */
  version?: string | null;
  /** Name the file as the server does (Content-Disposition): exports carry project and worker. */
  preferServerName?: boolean;
};

/** The last segment of a local file URI, decoded; `fallback` when there is none. */
export function fileNameOf(uri: string, fallback: string): string {
  const last = uri.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || fallback;
  } catch {
    return last || fallback;
  }
}

/** Forgets every reused download (tests; sign-out). */
export function clearOpenedFiles(): void {
  recent.clear();
}

/**
 * Opens an authenticated API file: a PDF or a picture inside the app, anything else (xlsx,
 * cad…) through the OS share sheet, since the app has no viewer for those. Returns the local URI.
 */
export function openFile(
  path: string,
  filename: string,
  mimeType?: string | null,
  options: OpenFileOptions = {},
): Promise<string> {
  const key = `${path}#${options.version ?? ""}`;
  const pending = opening.get(key);
  if (pending) return pending;
  const run = (async () => {
    const pdf = isPdfFile({ filename, mimeType });
    const image = !pdf && isViewableImage({ filename, mimeType });
    const ttl = options.version ? REUSE_VERSIONED_MS : REUSE_UNVERSIONED_MS;
    const hit = recent.get(key);
    let uri =
      hit && Date.now() - hit.at < ttl && cachedFileExists(hit.uri)
        ? hit.uri
        : undefined;
    if (!uri) {
      uri = await downloadToCache(
        path,
        pdf ? pdfCacheName(filename) : filename,
        {
          preferServerName: options.preferServerName,
        },
      );
      recent.set(key, { uri, at: Date.now() });
      if (recent.size > MAX_RECENT)
        recent.delete(recent.keys().next().value as string);
    }
    // A server-named export shows the name it was saved under, not the caller's fallback.
    const shown = options.preferServerName
      ? fileNameOf(uri, filename)
      : filename;
    if (pdf) openPdfViewer(uri, shown);
    else if (image) openImageViewer(uri, shown, mimeType);
    else await shareLocalFile(uri, mimeType ?? undefined);
    return uri;
  })().finally(() => opening.delete(key));
  opening.set(key, run);
  return run;
}

/**
 * Which row is opening a file, for its spinner: nothing shows while a file downloads before
 * the viewer opens, so without it a tap looks ignored. `run` ignores taps while one is busy.
 */
export function useOpeningFile(): {
  openingId: string | null;
  run: <T>(id: string, open: () => Promise<T>) => Promise<T | undefined>;
} {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const busy = useRef(false);
  const run = useCallback(
    async <T>(id: string, open: () => Promise<T>): Promise<T | undefined> => {
      if (busy.current) return undefined;
      busy.current = true;
      setOpeningId(id);
      try {
        return await open();
      } finally {
        busy.current = false;
        setOpeningId(null);
      }
    },
    [],
  );
  return { openingId, run };
}
