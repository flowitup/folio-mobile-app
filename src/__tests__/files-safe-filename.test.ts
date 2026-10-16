import { contentDispositionFilename, safeFilename } from "@/lib/files/download";

jest.mock("expo-file-system", () => ({
  Directory: class {},
  File: class {},
  Paths: { cache: "cache" },
}));
jest.mock("expo-sharing", () => ({}));
jest.mock("@/api/authed-fetch", () => ({}));

describe("safeFilename", () => {
  it("keeps Vietnamese and French letters", () => {
    expect(safeFilename("Hợp đồng thi công.pdf")).toBe("Hợp đồng thi công.pdf");
    expect(safeFilename("Báo cáo tiến độ.xlsx")).toBe("Báo cáo tiến độ.xlsx");
    expect(safeFilename("Ảnh hiện trường.jpg")).toBe("Ảnh hiện trường.jpg");
    expect(safeFilename("Devis été.pdf")).toBe("Devis été.pdf");
  });

  it("recomposes decomposed letters", () => {
    expect(safeFilename("Hợp.pdf")).toBe("Hợp.pdf");
  });

  it("keeps only the basename and drops leading dots", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("a\\b\\..secret")).toBe("secret");
  });

  it("replaces characters that are invalid in file names", () => {
    expect(safeFilename('a:b*c?"d<e>f|g\u0001.pdf')).toBe("a_b_c_d_e_f_g_.pdf");
    expect(safeFilename("...")).toBe("download");
  });
});

describe("contentDispositionFilename", () => {
  it("prefers the UTF-8 filename* and decodes it", () => {
    expect(
      contentDispositionFilename(
        "attachment; filename=\"depenses-12-rue-des-lilas.xlsx\"; filename*=UTF-8''d%C3%A9penses-12-rue-des-lilas.xlsx",
      ),
    ).toBe("dépenses-12-rue-des-lilas.xlsx");
  });

  it("falls back to the plain filename, quoted or not", () => {
    expect(
      contentDispositionFilename('attachment; filename="labor-a-b.pdf"'),
    ).toBe("labor-a-b.pdf");
    expect(contentDispositionFilename("attachment; filename=x.pdf")).toBe(
      "x.pdf",
    );
  });

  it("gives nothing without a name", () => {
    expect(contentDispositionFilename(null)).toBeUndefined();
    expect(contentDispositionFilename("inline")).toBeUndefined();
  });
});
