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
 * pdf.js build bundled in `assets/pdfjs` for the Android viewer (`npm run pdfjs:vendor` after a
 * change). The legacy build keeps older Android System WebViews working.
 */
export const PDFJS_VERSION = "4.10.38";

/**
 * The pdf.js library and worker modules as JS string literals ready to inline (see
 * `toScriptLiteral`). Escaping ~1.8 MB is not free, so it happens once per app run.
 */
export type PdfJsScripts = { lib: string; worker: string };

/**
 * A JS string literal safe inside an inline <script>, evaluating back to exactly `text`: JSON
 * escaping, then `<` (so the text can never close the script element) and every non-ASCII code
 * unit (U+2028/2029 break older engines; pure ASCII also keeps the engine's strings 1 byte per
 * character) as \uXXXX escapes.
 */
export function toScriptLiteral(text: string): string {
  return JSON.stringify(text).replace(
    /[<\u007f-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/** What the pdf.js page posts back to React Native. */
export type PdfViewerMessage =
  | { type: "ready" }
  | { type: "loaded"; pages: number }
  | { type: "error"; message: string };

export function parsePdfViewerMessage(raw: string): PdfViewerMessage | null {
  try {
    const message = JSON.parse(raw) as PdfViewerMessage;
    if (message.type === "ready") return message;
    if (message.type === "loaded" && typeof message.pages === "number")
      return message;
    if (message.type === "error" && typeof message.message === "string")
      return message;
  } catch {
    // not ours
  }
  return null;
}

/** Bytes per streamed chunk: a multiple of 3, so every chunk is standalone base64. */
export const PDF_CHUNK_BYTES = 3 * 256 * 1024;

/**
 * The messages that stream a PDF into the page, in order: its size, base64 chunks, then the
 * end marker. Streaming keeps the page itself small: a document embedded in the HTML makes
 * Android's `loadDataWithBaseURL` crawl (a 14 MB scan timed out) and holds several copies.
 */
export function pdfTransferMessages(
  bytes: Uint8Array,
  toBase64: (chunk: Uint8Array) => string,
): string[] {
  const messages = [`size:${bytes.length}`];
  for (let at = 0; at < bytes.length; at += PDF_CHUNK_BYTES)
    messages.push(
      `chunk:${toBase64(bytes.subarray(at, at + PDF_CHUNK_BYTES))}`,
    );
  messages.push("end");
  return messages;
}

/**
 * Self-contained page that renders a PDF with pdf.js, for Android, whose WebView cannot show
 * PDFs itself (iOS WKWebView renders the local file natively). pdf.js is bundled with the app
 * and inlined (loaded from blob URLs), so nothing touches the network. Once it is up the page
 * posts `ready`, and React Native streams the document in (`pdfTransferMessages`).
 *
 * Pages are laid out at their real aspect ratio up front and drawn to a canvas only while near
 * the viewport, then cleared again, so a long document does not hold every page in memory.
 */
export function buildPdfJsHtml(
  background: string,
  pdfjs: PdfJsScripts,
): string {
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
<script>
  var post = function (message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); };
  var fail = function (error) { post({ type: "error", message: String((error && error.message) || error) }); };
  window.addEventListener("error", function (event) { fail(event.error || event.message); });
  window.addEventListener("unhandledrejection", function (event) { fail(event.reason); });
  // Largest canvas drawn per page: bigger ones cost tens of MB each and can render blank.
  var MAX_PIXELS = 5000000;
</script>
<script>
  var PDFJS_LIB = ${pdfjs.lib};
  var PDFJS_WORKER = ${pdfjs.worker};
</script>
<script>
  var moduleUrl = function (source) { return URL.createObjectURL(new Blob([source], { type: "text/javascript" })); };
  // The blobs hold the code now: drop the 1.8 MB of source strings.
  var libUrl = moduleUrl(PDFJS_LIB);
  var workerUrl = moduleUrl(PDFJS_WORKER);
  PDFJS_LIB = PDFJS_WORKER = null;

  // The document arrives as "size:<n>", "chunk:<base64>"..., "end" (see pdfTransferMessages).
  var received = null;
  var filled = 0;
  var lastEvent = null;
  var documentReady = new Promise(function (resolve) {
    var onMessage = function (event) {
      // React Native may dispatch on document (bubbling to window): take each event once.
      if (event === lastEvent || typeof event.data !== "string") return;
      lastEvent = event;
      var data = event.data;
      if (data.indexOf("size:") === 0) {
        received = new Uint8Array(Number(data.slice(5)));
        filled = 0;
      } else if (data.indexOf("chunk:") === 0 && received) {
        var binary = atob(data.slice(6));
        for (var i = 0; i < binary.length; i++) received[filled++] = binary.charCodeAt(i);
      } else if (data === "end" && received) {
        resolve(received);
        received = null;
      }
    };
    document.addEventListener("message", onMessage);
    window.addEventListener("message", onMessage);
  });

  (async function () {
    const pdfjs = await import(libUrl);
    URL.revokeObjectURL(libUrl);
    // Same-origin blob: pdf.js starts a real worker from it (or runs it inline if it cannot).
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    post({ type: "ready" });
    const bytes = await documentReady;
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
