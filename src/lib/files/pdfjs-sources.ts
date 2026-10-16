import type { PdfAssetKind, PdfJsScripts } from "@/lib/files/pdf";

/**
 * iOS (and every non-Android target) renders PDFs natively, so pdf.js is not loaded there; the
 * real loader is `pdfjs-sources.android.ts`, which Metro picks by platform suffix.
 */
export function loadPdfJsScripts(): Promise<PdfJsScripts> {
  return Promise.reject(new Error("pdf.js is only used on Android"));
}

/** Android only (see `pdfjs-sources.android.ts`); nothing to hand out elsewhere. */
export function loadPdfAsset(
  _kind: PdfAssetKind,
  _name: string,
): Promise<string | undefined> {
  return Promise.resolve(undefined);
}
