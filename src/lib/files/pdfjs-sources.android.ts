import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import { toScriptLiteral } from "@/lib/files/pdf";
import type { PdfJsScripts } from "@/lib/files/pdf";

// Vendored by scripts/vendor-pdfjs.mjs; bundled as assets so the viewer needs no network.
// Android only (this file's suffix): iOS renders PDFs natively and never loads them.
// Expo's lint allow-list only knows media extensions; these `require`s are Metro assets too.
/* eslint-disable @typescript-eslint/no-require-imports */
const LIB = require("../../../assets/pdfjs/pdf.min.mjs.txt");
const WORKER = require("../../../assets/pdfjs/pdf.worker.min.mjs.txt");
/* eslint-enable @typescript-eslint/no-require-imports */

let loading: Promise<PdfJsScripts> | null = null;

/**
 * The bundled pdf.js library and worker as inline-ready string literals, read and escaped once
 * per app run; only the escaped form is kept. A failed load is not cached, so Retry reads again.
 */
export function loadPdfJsScripts(): Promise<PdfJsScripts> {
  loading ??= (async () => {
    const [lib, worker] = await Asset.loadAsync([LIB, WORKER]);
    if (!lib.localUri || !worker.localUri)
      throw new Error("pdf.js assets unavailable");
    const [libText, workerText] = await Promise.all([
      new File(lib.localUri).text(),
      new File(worker.localUri).text(),
    ]);
    return {
      lib: toScriptLiteral(libText),
      worker: toScriptLiteral(workerText),
    };
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
