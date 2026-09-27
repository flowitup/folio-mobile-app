import { loadPdfJsScripts } from "@/lib/files/pdfjs-sources.android";

const mockLoadAsync = jest.fn();
jest.mock("expo-asset", () => ({
  Asset: { loadAsync: (...args: unknown[]) => mockLoadAsync(...args) },
}));
jest.mock("expo-file-system", () => ({
  File: class {
    mockUri: string;
    constructor(uri: string) {
      this.mockUri = uri;
    }
    text() {
      return Promise.resolve(`text of ${this.mockUri}`);
    }
  },
}));

const loaded = [{ localUri: "file:///lib.txt" }, { localUri: "file:///w.txt" }];

describe("loadPdfJsScripts", () => {
  it("retries after a failed load, then reads and escapes only once", async () => {
    mockLoadAsync.mockRejectedValueOnce(new Error("disk full"));
    await expect(loadPdfJsScripts()).rejects.toThrow("disk full");

    mockLoadAsync.mockResolvedValue(loaded);
    const first = await loadPdfJsScripts();
    expect(first).toEqual({
      lib: '"text of file:///lib.txt"',
      worker: '"text of file:///w.txt"',
    });
    expect(await loadPdfJsScripts()).toBe(first);
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);
  });
});
