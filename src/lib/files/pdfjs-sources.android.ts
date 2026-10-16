import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import { toScriptLiteral } from "@/lib/files/pdf";
import type { PdfAssetKind, PdfJsScripts } from "@/lib/files/pdf";

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

/* eslint-disable @typescript-eslint/no-require-imports */
const ASSET_BUNDLES = {
  cmap: require("../../../assets/pdfjs/cmaps.json.txt"),
  font: require("../../../assets/pdfjs/standard_fonts.json.txt"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const bundles = new Map<PdfAssetKind, Promise<Record<string, string>>>();

/**
 * A CMap or standard font the pdf.js page asked for, as base64, or undefined when the bundle
 * has no such file. Each bundle (vendored by scripts/vendor-pdfjs.mjs) is read once, and only
 * when a document needs it.
 */
export async function loadPdfAsset(
  kind: PdfAssetKind,
  name: string,
): Promise<string | undefined> {
  let bundle = bundles.get(kind);
  if (!bundle) {
    bundle = (async () => {
      const [asset] = await Asset.loadAsync([ASSET_BUNDLES[kind]]);
      if (!asset.localUri) throw new Error("pdf.js assets unavailable");
      return JSON.parse(await new File(asset.localUri).text()) as Record<
        string,
        string
      >;
    })();
    bundles.set(kind, bundle);
    bundle.catch(() => bundles.delete(kind));
  }
  const files = await bundle;
  return Object.prototype.hasOwnProperty.call(files, name)
    ? files[name]
    : undefined;
}
