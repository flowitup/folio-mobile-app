#!/usr/bin/env node
/**
 * Copies the pdf.js legacy build into assets/pdfjs, where Metro bundles it as a plain asset for
 * the Android PDF viewer (Android's WebView cannot render PDFs, and the viewer must work
 * offline, so the library ships inside the app instead of coming from a CDN).
 *
 * The files keep a `.txt` suffix: Metro treats `.mjs` as source code and would try to bundle it
 * into the JS; as an asset the viewer reads the text and hands it to the WebView untouched.
 *
 * The version comes from PDFJS_VERSION in src/lib/files/pdf.ts, fetched with `npm pack` rather
 * than installed: pdfjs-dist drags a native Node canvas package into every install otherwise.
 * The Jest test pins each file's SHA-256: paste the hashes this script prints into
 * PDFJS_SHA256 in src/__tests__/pdf-viewer-open-file.test.ts, so a bump is reviewable.
 *
 * Usage: npm run pdfjs:vendor
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = resolve(REPO_ROOT, "assets/pdfjs");
const VERSION = /PDFJS_VERSION = "([^"]+)"/.exec(
  readFileSync(resolve(REPO_ROOT, "src/lib/files/pdf.ts"), "utf8"),
)?.[1];
if (!VERSION)
  throw new Error("PDFJS_VERSION not found in src/lib/files/pdf.ts");

const FILES = [
  ["legacy/build/pdf.min.mjs", "pdf.min.mjs.txt"],
  ["legacy/build/pdf.worker.min.mjs", "pdf.worker.min.mjs.txt"],
  ["LICENSE", "LICENSE"],
];

const work = mkdtempSync(join(tmpdir(), "pdfjs-"));
try {
  const packed = JSON.parse(
    execFileSync(
      "npm",
      ["pack", `pdfjs-dist@${VERSION}`, "--json", "--pack-destination", work],
      // npm is npm.cmd on Windows, which only a shell resolves.
      { encoding: "utf8", shell: process.platform === "win32" },
    ),
  );
  // npm <= 11 prints an array of packs, npm 12 an object keyed by package name.
  const { filename } = Array.isArray(packed) ? packed[0] : packed["pdfjs-dist"];
  execFileSync("tar", ["xzf", join(work, filename), "-C", work]);
  // Start clean so a file dropped from FILES does not linger in the app bundle.
  rmSync(TARGET, { recursive: true, force: true });
  mkdirSync(TARGET, { recursive: true });
  for (const [from, to] of FILES) {
    const target = resolve(TARGET, to);
    copyFileSync(join(work, "package", from), target);
    const sha = createHash("sha256").update(readFileSync(target)).digest("hex");
    console.log(`assets/pdfjs/${to}  pdfjs-dist@${VERSION}  sha256 ${sha}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
