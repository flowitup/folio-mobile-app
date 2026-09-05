import { bytesToBase64 } from "@/lib/files/base64";

describe("bytesToBase64", () => {
  it("encodes small buffers", () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
    expect(bytesToBase64(new TextEncoder().encode("Folio"))).toBe("Rm9saW8=");
    expect(bytesToBase64(new Uint8Array([0xff, 0x00, 0x7f]))).toBe("/wB/");
  });

  it("matches Buffer for a payload larger than one chunk", () => {
    const bytes = new Uint8Array(100_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) & 0xff;
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});
