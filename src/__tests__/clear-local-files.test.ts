import { clearLocalUserFiles } from "@/lib/files/clear-local-files";

const mockDeleted: string[] = [];
let mockFailOn: string | null = null;
let mockExisting: string[] = [];
jest.mock("expo-file-system", () => {
  class Entry {
    name: string;
    constructor(...parts: unknown[]) {
      this.name = String(parts.at(-1));
    }
    get exists() {
      return mockExisting.includes(this.name);
    }
    delete() {
      if (mockFailOn === this.name) throw new Error("EBUSY");
      mockDeleted.push(this.name);
    }
  }
  class Directory extends Entry {
    list() {
      return mockEntries;
    }
  }
  const mockEntries = [
    "download-1000",
    "share-500",
    "chat-voice-m1.m4a",
    "download-abc", // not ours
    "my-download-1",
    "chat-voice-m1.m4a.tmp",
    "unrelated.png",
  ].map((name) => new Entry(name));
  return { Directory, Paths: { cache: "cache" } };
});

beforeEach(() => {
  mockDeleted.length = 0;
  mockFailOn = null;
  mockExisting = ["upload-names", "Print", "DocumentPicker"];
});

describe("clearLocalUserFiles", () => {
  it("removes the app's downloads, voice notes and picker, print and rename folders only", () => {
    clearLocalUserFiles();
    expect(mockDeleted.sort()).toEqual(
      [
        "DocumentPicker",
        "Print",
        "chat-voice-m1.m4a",
        "download-1000",
        "share-500",
        "upload-names",
      ].sort(),
    );
  });

  it("keeps going when one entry cannot be deleted and never throws", () => {
    mockFailOn = "download-1000";
    expect(() => clearLocalUserFiles()).not.toThrow();
    expect(mockDeleted).toContain("share-500");
    expect(mockDeleted).toContain("Print");
    expect(mockDeleted).not.toContain("download-1000");
  });
});
