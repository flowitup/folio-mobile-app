import { sweepStaleDownloads } from "@/lib/files/download";

const mockDeleted: string[] = [];
jest.mock("expo-file-system", () => {
  class Directory {
    name: string;
    constructor(...parts: unknown[]) {
      this.name = String(parts.at(-1));
    }
    list() {
      return mockEntries;
    }
    delete() {
      mockDeleted.push(this.name);
    }
  }
  class File {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    delete() {
      mockDeleted.push(this.name);
    }
  }
  const mockEntries = [
    new Directory("download-1000"), // stale
    new Directory(`download-${3_600_000 + 1000}`), // fresh
    new Directory("share-500"), // stale, name of older builds
    new Directory("Print"), // expo-print output, not ours
    new File("download-10"), // a file, not a download folder
  ];
  return { Directory, File, Paths: { cache: "cache" } };
});
jest.mock("expo-sharing", () => ({}));
jest.mock("@/api/authed-fetch", () => ({}));

describe("sweepStaleDownloads", () => {
  it("removes only download folders past the TTL", () => {
    sweepStaleDownloads(3_600_000 + 2000);
    expect(mockDeleted.sort()).toEqual(["download-1000", "share-500"]);
  });
});
