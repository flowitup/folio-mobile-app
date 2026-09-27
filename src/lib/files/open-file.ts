import { router } from "expo-router";

import { downloadToCache, shareLocalFile } from "@/lib/files/download";
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

/** Shows a local PDF (cache download or expo-print output) in the in-app viewer. */
export function openPdfViewer(uri: string, title: string): void {
  nextToken += 1;
  const token = `${Date.now().toString(36)}-${nextToken}`;
  viewerFiles.set(token, uri);
  router.push({ pathname: "/pdf-viewer", params: { file: token, title } });
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
 * Opens an authenticated API file: a PDF inside the app, anything else (xlsx, images, cad…)
 * through the OS share sheet, since the app has no viewer for those. Returns the local URI.
 */
export function openFile(
  path: string,
  filename: string,
  mimeType?: string | null,
): Promise<string> {
  const pending = opening.get(path);
  if (pending) return pending;
  const run = (async () => {
    const pdf = isPdfFile({ filename, mimeType });
    const uri = await downloadToCache(
      path,
      pdf ? pdfCacheName(filename) : filename,
    );
    if (pdf) openPdfViewer(uri, filename);
    else await shareLocalFile(uri, mimeType ?? undefined);
    return uri;
  })().finally(() => opening.delete(path));
  opening.set(path, run);
  return run;
}
