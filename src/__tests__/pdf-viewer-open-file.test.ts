import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  clearOpenedFiles,
  openFile,
  openPdfViewer,
  resolveViewerFile,
} from "@/lib/files/open-file";
import {
  PDFJS_VERSION,
  buildPdfJsHtml,
  isPdfFile,
  isPermanentPdfError,
  PDF_CHUNK_BYTES,
  parsePdfViewerMessage,
  pdfAssetMessage,
  pdfTransferMessages,
  toScriptLiteral,
} from "@/lib/files/pdf";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
const mockDownloadToCache = jest.fn();
const mockShareLocalFile = jest.fn();
const mockCachedFileExists = jest.fn((..._args: unknown[]) => true);
jest.mock("@/lib/files/download", () => ({
  downloadToCache: (...args: unknown[]) => mockDownloadToCache(...args),
  shareLocalFile: (...args: unknown[]) => mockShareLocalFile(...args),
  cachedFileExists: (...args: unknown[]) => mockCachedFileExists(...args),
}));

describe("isPdfFile", () => {
  it("trusts the MIME type when the server sends one", () => {
    expect(isPdfFile({ filename: "a.bin", mimeType: "application/pdf" })).toBe(
      true,
    );
    expect(
      isPdfFile({ filename: "a", mimeType: "Application/PDF; charset=binary" }),
    ).toBe(true);
    expect(isPdfFile({ filename: "a.pdf", mimeType: "image/png" })).toBe(false);
  });

  it("falls back to the extension without a MIME type", () => {
    expect(isPdfFile({ filename: "Devis 12.PDF" })).toBe(true);
    expect(isPdfFile({ filename: "export.xlsx", mimeType: "" })).toBe(false);
    expect(isPdfFile({ filename: "pdf" })).toBe(false);
  });

  it("ignores a generic octet-stream type and reads the name", () => {
    expect(
      isPdfFile({ filename: "scan.pdf", mimeType: "application/octet-stream" }),
    ).toBe(true);
    expect(
      isPdfFile({ filename: "plan.dwg", mimeType: "application/octet-stream" }),
    ).toBe(false);
  });
});

const SCRIPTS = {
  lib: toScriptLiteral("export const lib = 1;"),
  worker: toScriptLiteral("self.worker = 2;"),
};

/** Evaluates a JS string literal, as the WebView does with the inlined pdf.js. */
const evaluate = (literal: string): string =>
  new Function(`return ${literal};`)() as string;

describe("buildPdfJsHtml", () => {
  it("inlines the bundled pdf.js and fetches nothing from the network", () => {
    const html = buildPdfJsHtml("#efe9de", SCRIPTS);
    expect(html).toContain('var PDFJS_LIB = "export const lib = 1;";');
    expect(html).toContain('var PDFJS_WORKER = "self.worker = 2;";');
    expect(html).not.toMatch(/https?:\/\/(?!folio)/);
    expect(html).toContain("isEvalSupported: false");
    expect(html).toContain("background: #efe9de");
    // Classic script + dynamic import: parses on WebViews without top-level await.
    expect(html).not.toContain('type="module"');
    expect(html).toContain('addEventListener("unhandledrejection"');
    // The document is streamed in after "ready", never embedded in the page.
    expect(html).toContain('post({ type: "ready" })');
  });
});

describe("pdfTransferMessages", () => {
  const toBase64 = (chunk: Uint8Array) => Buffer.from(chunk).toString("base64");

  it("streams size, standalone base64 chunks and an end marker", () => {
    const bytes = new Uint8Array(PDF_CHUNK_BYTES * 2 + 5);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) & 0xff;
    const messages = pdfTransferMessages(bytes, toBase64);

    expect(messages[0]).toBe(`size:${bytes.length}`);
    expect(messages.at(-1)).toBe("end");
    const chunks = messages.slice(1, -1);
    expect(chunks).toHaveLength(3);
    // The page decodes each chunk on its own: every one must be complete base64.
    const decoded = Buffer.concat(
      chunks.map((m) => Buffer.from(m.slice("chunk:".length), "base64")),
    );
    expect(decoded.equals(Buffer.from(bytes))).toBe(true);
  });

  it("still sends size and end for an empty file", () => {
    expect(pdfTransferMessages(new Uint8Array(0), toBase64)).toEqual([
      "size:0",
      "end",
    ]);
  });
});

describe("toScriptLiteral", () => {
  const hostile =
    "a = \"</script><!--<script>\" + '\\'' + `\\u0041` \u2028\u2029 é 😀 \ud800 \0 \n";

  it("evaluates back to exactly the input text", () => {
    expect(evaluate(toScriptLiteral(hostile))).toBe(hostile);
  });

  it("is pure ASCII with no `<`, so it cannot leave its script element", () => {
    const literal = toScriptLiteral(hostile);
    expect(literal).toMatch(/^[\x20-\x7e]*$/);
    expect(literal).not.toContain("<");
  });
});

/** SHA-256 of each vendored file; `npm run pdfjs:vendor` prints them after a version bump. */
const PDFJS_SHA256: Record<string, string> = {
  "pdf.min.mjs.txt":
    "44ec6f011027ee77791386b66c14876a5fc29e20bf0433c07c6726fff7212b72",
  "pdf.worker.min.mjs.txt":
    "bd88805178a26c729db8c0107a5b630cb900ec070f4d8c7529a3e45530afd41d",
  LICENSE: "0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594",
  LICENSE_FOXIT:
    "b578cdd2345840ada550bd12519533812320d5f1d21cf4c1c7e1b1b0a31c98b7",
  LICENSE_LIBERATION:
    "93fed46019c38bbe566b479d22148e2e8a1e85ada614accb0211c37b2c61c19b",
  "cmaps.json.txt":
    "0e9fd0620b294dcc4f440fe39a25b1f6480c5e5d0ac11bc40efaedd4979f9dda",
  "standard_fonts.json.txt":
    "9a42ff66988b3282171a487f7662fb3fd4e588086043609819be96e66f30c213",
};

describe("vendored pdf.js", () => {
  const read = (name: string) =>
    readFileSync(join(__dirname, "../../assets/pdfjs", name));

  it.each(Object.keys(PDFJS_SHA256))("%s is the pinned build", (name) => {
    expect(createHash("sha256").update(read(name)).digest("hex")).toBe(
      PDFJS_SHA256[name],
    );
  });

  it("is PDFJS_VERSION (run `npm run pdfjs:vendor` after a bump)", () => {
    expect(read("pdf.min.mjs.txt").toString()).toContain(`"${PDFJS_VERSION}"`);
  });

  it.each(["pdf.min.mjs.txt", "pdf.worker.min.mjs.txt"])(
    "%s survives inlining byte for byte",
    (name) => {
      const text = read(name).toString("utf8");
      expect(evaluate(toScriptLiteral(text))).toBe(text);
    },
  );
});

describe("parsePdfViewerMessage", () => {
  it("accepts only the page's own messages", () => {
    expect(parsePdfViewerMessage('{"type":"loaded","pages":3}')).toEqual({
      type: "loaded",
      pages: 3,
    });
    expect(parsePdfViewerMessage('{"type":"error","message":"bad"}')).toEqual({
      type: "error",
      message: "bad",
    });
    expect(parsePdfViewerMessage('{"type":"ready"}')).toEqual({
      type: "ready",
    });
    expect(parsePdfViewerMessage('{"type":"loaded"}')).toBeNull();
    expect(parsePdfViewerMessage("not json")).toBeNull();
  });

  it("accepts password and asset requests, but no path-like asset names", () => {
    expect(parsePdfViewerMessage('{"type":"password","retry":false}')).toEqual({
      type: "password",
      retry: false,
    });
    expect(
      parsePdfViewerMessage(
        '{"type":"asset","kind":"cmap","name":"UniJIS-UCS2-H.bcmap"}',
      ),
    ).toEqual({ type: "asset", kind: "cmap", name: "UniJIS-UCS2-H.bcmap" });
    expect(
      parsePdfViewerMessage('{"type":"asset","kind":"cmap","name":"../x"}'),
    ).toBeNull();
    expect(
      parsePdfViewerMessage('{"type":"asset","kind":"file","name":"x"}'),
    ).toBeNull();
  });
});

describe("password-protected and damaged PDFs (owner-pdf-08)", () => {
  it("asks for the password in the page, in the UI language", () => {
    const html = buildPdfJsHtml("#fff", SCRIPTS, {
      password: "Ce PDF est protégé.",
      wrongPassword: "Mot de passe incorrect.",
      open: "Ouvrir",
    });
    expect(html).toContain("task.onPassword");
    expect(html).toContain('post({ type: "password", retry })');
    expect(html).toContain(toScriptLiteral("Ce PDF est protégé."));
  });

  it("offers no Retry for errors a second try cannot fix", () => {
    expect(isPermanentPdfError("PasswordException")).toBe(true);
    expect(isPermanentPdfError("InvalidPDFException")).toBe(true);
    expect(isPermanentPdfError("UnknownErrorException")).toBe(false);
    expect(isPermanentPdfError(undefined)).toBe(false);
  });
});

describe("CMaps and standard fonts (owner-pdf-09)", () => {
  it("hands pdf.js factories that ask React Native, never the network", () => {
    const html = buildPdfJsHtml("#fff", SCRIPTS);
    expect(html).toContain("CMapReaderFactory,");
    expect(html).toContain("StandardFontDataFactory,");
    expect(html).toContain('requestAsset("cmap", name + ".bcmap")');
    expect(html).not.toMatch(/https?:\/\/(?!folio)/);
  });

  it("answers with the file or a missing marker", () => {
    expect(pdfAssetMessage("cmap", "H.bcmap", "AAAA")).toBe(
      "asset:cmap:H.bcmap:AAAA",
    );
    expect(pdfAssetMessage("font", "FoxitSymbol.pfb", undefined)).toBe(
      "asset-missing:font:FoxitSymbol.pfb",
    );
  });

  it("bundles the CMaps and fonts pdf.js asks for", () => {
    const bundle = (name: string) =>
      JSON.parse(
        readFileSync(join(__dirname, "../../assets/pdfjs", name), "utf8"),
      ) as Record<string, string>;
    expect(Object.keys(bundle("cmaps.json.txt"))).toEqual(
      expect.arrayContaining([
        "UniJIS-UCS2-H.bcmap",
        "Adobe-Japan1-UCS2.bcmap",
      ]),
    );
    expect(Object.keys(bundle("standard_fonts.json.txt"))).toEqual(
      expect.arrayContaining(["FoxitSymbol.pfb", "FoxitDingbats.pfb"]),
    );
  });
});

describe("openFile", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockShareLocalFile.mockReset();
    mockDownloadToCache.mockReset();
    mockDownloadToCache.mockResolvedValue("file:///cache/download-1/x");
    mockCachedFileExists.mockReset();
    mockCachedFileExists.mockReturnValue(true);
    clearOpenedFiles();
  });

  it("opens a PDF in the in-app viewer instead of another app", async () => {
    await openFile("/api/v1/attachments/9/download", "facture.pdf", null);
    expect(mockDownloadToCache).toHaveBeenCalledWith(
      "/api/v1/attachments/9/download",
      "facture.pdf",
      expect.anything(),
    );
    expect(viewerUri()).toBe("file:///cache/download-1/x");
    expect(mockShareLocalFile).not.toHaveBeenCalled();
  });

  it("saves a PDF known only by its MIME type under a .pdf name", async () => {
    await openFile("/api/v1/attachments/7/download", "scan", "application/pdf");
    expect(mockDownloadToCache).toHaveBeenCalledWith(
      "/api/v1/attachments/7/download",
      "scan.pdf",
      expect.anything(),
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ title: "scan" }),
      }),
    );
  });

  it("keeps the share sheet for files the app cannot show", async () => {
    await openFile(
      "/export?format=xlsx",
      "labor.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockShareLocalFile).toHaveBeenCalledWith(
      "file:///cache/download-1/x",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("does not navigate when the download fails", async () => {
    mockDownloadToCache.mockRejectedValue(new Error("HTTP 404"));
    await expect(openFile("/x", "a.pdf")).rejects.toThrow("HTTP 404");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("downloads once when the row is tapped twice", async () => {
    await Promise.all([
      openFile("/doc/1", "a.pdf", "application/pdf"),
      openFile("/doc/1", "a.pdf", "application/pdf"),
    ]);
    expect(mockDownloadToCache).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("shows the copy already downloaded when the same version is opened again", async () => {
    await openFile("/billing/1/pdf", "D-1.pdf", undefined, { version: "v1" });
    await openFile("/billing/1/pdf", "D-1.pdf", undefined, { version: "v1" });
    expect(mockDownloadToCache).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(2);
    // An edit changes the version: fetch the new file.
    await openFile("/billing/1/pdf", "D-1.pdf", undefined, { version: "v2" });
    expect(mockDownloadToCache).toHaveBeenCalledTimes(2);
  });

  it("downloads again when the OS purged the cached copy", async () => {
    await openFile("/doc/5", "a.pdf", "application/pdf", { version: "x" });
    mockCachedFileExists.mockReturnValue(false);
    await openFile("/doc/5", "a.pdf", "application/pdf", { version: "x" });
    expect(mockDownloadToCache).toHaveBeenCalledTimes(2);
  });

  it("shows a picture in the in-app image viewer, not the share sheet", async () => {
    await openFile("/att/3/download", "ticket.jpg", "image/jpeg");
    expect(mockShareLocalFile).not.toHaveBeenCalled();
    const call = mockPush.mock.calls.at(-1)?.[0];
    expect(call.pathname).toBe("/image-viewer");
    expect(resolveViewerFile(call.params.file)).toBe(
      "file:///cache/download-1/x",
    );
  });

  it("titles a server-named export with the name it was saved under", async () => {
    mockDownloadToCache.mockResolvedValue(
      "file:///cache/download-2/labor-12-rue-des-lilas-2026-10-to-2026-10.pdf",
    );
    await openFile(
      "/labor-export?format=pdf",
      "labor-2026-10-2026-10.pdf",
      undefined,
      {
        preferServerName: true,
      },
    );
    expect(mockDownloadToCache).toHaveBeenCalledWith(
      "/labor-export?format=pdf",
      "labor-2026-10-2026-10.pdf",
      { preferServerName: true },
    );
    expect(mockPush.mock.calls.at(-1)?.[0].params.title).toBe(
      "labor-12-rue-des-lilas-2026-10-to-2026-10.pdf",
    );
  });

  it("opens a local file (printed invoice) directly", () => {
    openPdfViewer("file:///cache/Print/abc.pdf", "INV-7");
    expect(viewerUri()).toBe("file:///cache/Print/abc.pdf");
    expect(mockPush.mock.calls[0][0].params.title).toBe("INV-7");
  });
});

describe("viewer route params", () => {
  it("carry an opaque token, never the file path", () => {
    mockPush.mockReset();
    openPdfViewer("file:///cache/download-9/x.pdf", "x.pdf");
    const { params } = mockPush.mock.calls[0][0];
    expect(JSON.stringify(params)).not.toContain("file://");
    expect(resolveViewerFile(params.file)).toBe(
      "file:///cache/download-9/x.pdf",
    );
  });

  it("resolve nothing for a forged or missing token", () => {
    expect(resolveViewerFile("file:///data/user/0/app/db")).toBeNull();
    expect(resolveViewerFile(undefined)).toBeNull();
  });
});

/** The file the last viewer push points at, through its token. */
function viewerUri(): string | null {
  const call = mockPush.mock.calls.at(-1)?.[0];
  expect(call?.pathname).toBe("/pdf-viewer");
  return resolveViewerFile(call.params.file);
}
