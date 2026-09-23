import {
  openFile,
  openPdfViewer,
  resolveViewerFile,
} from "@/lib/files/open-file";
import {
  PDFJS_VERSION,
  buildPdfJsHtml,
  isPdfFile,
  parsePdfViewerMessage,
} from "@/lib/files/pdf";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
const mockDownloadToCache = jest.fn();
const mockShareLocalFile = jest.fn();
jest.mock("@/lib/files/download", () => ({
  downloadToCache: (...args: unknown[]) => mockDownloadToCache(...args),
  shareLocalFile: (...args: unknown[]) => mockShareLocalFile(...args),
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

describe("buildPdfJsHtml", () => {
  it("embeds the document and pins the pdf.js build", () => {
    const html = buildPdfJsHtml("JVBERi0xLjQ=", "#efe9de");
    expect(html).toContain(">JVBERi0xLjQ=</script>");
    expect(html).toContain(`pdfjs-dist@${PDFJS_VERSION}/legacy/build`);
    expect(html).toContain("isEvalSupported: false");
    expect(html).toContain("background: #efe9de");
    // Classic script + dynamic import: parses on WebViews without top-level await.
    expect(html).not.toContain('type="module"');
    expect(html).toContain('addEventListener("unhandledrejection"');
  });

  it("refuses data that could break out of the page", () => {
    expect(() => buildPdfJsHtml("abc</script><script>x", "#fff")).toThrow();
  });
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
    expect(parsePdfViewerMessage('{"type":"loaded"}')).toBeNull();
    expect(parsePdfViewerMessage("not json")).toBeNull();
  });
});

describe("openFile", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockShareLocalFile.mockReset();
    mockDownloadToCache.mockReset();
    mockDownloadToCache.mockResolvedValue("file:///cache/download-1/x");
  });

  it("opens a PDF in the in-app viewer instead of another app", async () => {
    await openFile("/api/v1/attachments/9/download", "facture.pdf", null);
    expect(mockDownloadToCache).toHaveBeenCalledWith(
      "/api/v1/attachments/9/download",
      "facture.pdf",
    );
    expect(viewerUri()).toBe("file:///cache/download-1/x");
    expect(mockShareLocalFile).not.toHaveBeenCalled();
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
