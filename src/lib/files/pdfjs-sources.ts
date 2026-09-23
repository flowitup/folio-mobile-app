import type { PdfJsScripts } from "@/lib/files/pdf";

/**
 * iOS (and every non-Android target) renders PDFs natively, so pdf.js is not loaded there; the
 * real loader is `pdfjs-sources.android.ts`, which Metro picks by platform suffix.
 */
export function loadPdfJsScripts(): Promise<PdfJsScripts> {
  return Promise.reject(new Error("pdf.js is only used on Android"));
}
