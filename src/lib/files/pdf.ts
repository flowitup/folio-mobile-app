const GENERIC_MIME_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
]);

/** Whether a file is a PDF, from its MIME type or, when the server sends none, its extension. */
export function isPdfFile(file: {
  filename: string;
  mimeType?: string | null;
}): boolean {
  const mime = file.mimeType?.split(";")[0].trim().toLowerCase();
  // A generic type says nothing (pickers record unknown files as octet-stream): use the name.
  if (mime && !GENERIC_MIME_TYPES.has(mime)) return mime === "application/pdf";
  return /\.pdf$/i.test(file.filename.trim());
}

/**
 * pdf.js build the Android viewer loads. Pinned: a floating tag would change the renderer under
 * shipped apps. The legacy build keeps older Android System WebViews working.
 */
export const PDFJS_VERSION = "4.10.38";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build`;

/** What the pdf.js page posts back to React Native. */
export type PdfViewerMessage =
  { type: "loaded"; pages: number } | { type: "error"; message: string };

export function parsePdfViewerMessage(raw: string): PdfViewerMessage | null {
  try {
    const message = JSON.parse(raw) as PdfViewerMessage;
    if (message.type === "loaded" && typeof message.pages === "number")
      return message;
    if (message.type === "error" && typeof message.message === "string")
      return message;
  } catch {
    // not ours
  }
  return null;
}

/**
 * Self-contained page that renders a PDF with pdf.js, for Android, whose WebView cannot show
 * PDFs itself (iOS WKWebView renders the local file natively). The document travels inside the
 * page as base64, so its bytes never leave the device; only the library comes from the CDN.
 *
 * Pages are laid out at their real aspect ratio up front and drawn to a canvas only while near
 * the viewport, then cleared again, so a long document does not hold every page in memory.
 */
export function buildPdfJsHtml(base64: string, background: string): string {
  // base64 is [A-Za-z0-9+/=] only, so it cannot close the data element early.
  if (/[^A-Za-z0-9+/=\s]/.test(base64)) throw new Error("Invalid PDF data");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<style>
  html, body { margin: 0; padding: 0; background: ${background}; }
  #pages { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0 24px; }
  .page { position: relative; width: calc(100vw - 16px); background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); }
  .page canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="pages"></div>
<script type="application/octet-stream" id="pdf-data">${base64}</script>
<script>
  var post = function (message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); };
  var fail = function (error) { post({ type: "error", message: String((error && error.message) || error) }); };
  window.addEventListener("error", function (event) { fail(event.error || event.message); });
  window.addEventListener("unhandledrejection", function (event) { fail(event.reason); });
  // Largest canvas drawn per page: bigger ones cost tens of MB each and can render blank.
  var MAX_PIXELS = 5000000;
  (async function () {
    const pdfjs = await import("${PDFJS_BASE}/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "${PDFJS_BASE}/pdf.worker.min.mjs";
    const binary = atob(document.getElementById("pdf-data").textContent.replace(/\\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pdf = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
    const container = document.getElementById("pages");
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const slots = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const slot = document.createElement("div");
      slot.className = "page";
      slot.style.aspectRatio = base.width + " / " + base.height;
      container.appendChild(slot);
      slots.push({ slot, page, base, task: null });
    }
    const draw = (entry) => {
      if (entry.task || entry.slot.firstChild) return;
      let scale = (entry.slot.clientWidth * ratio) / entry.base.width;
      const pixels = entry.base.width * entry.base.height * scale * scale;
      if (pixels > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / pixels);
      const viewport = entry.page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      entry.slot.appendChild(canvas);
      entry.task = entry.page.render({ canvasContext: canvas.getContext("2d"), viewport });
      entry.task.promise.catch(() => undefined).finally(() => { entry.task = null; });
    };
    const clear = (entry) => {
      const canvas = entry.slot.firstChild;
      if (!canvas) return;
      if (entry.task) entry.task.cancel();
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
      entry.page.cleanup();
    };
    const observer = new IntersectionObserver((changes) => {
      for (const change of changes) {
        const entry = slots.find((s) => s.slot === change.target);
        if (change.isIntersecting) draw(entry); else clear(entry);
      }
    }, { rootMargin: "150% 0px" });
    for (const entry of slots) observer.observe(entry.slot);
    post({ type: "loaded", pages: pdf.numPages });
  })().catch(fail);
</script>
</body>
</html>`;
}
