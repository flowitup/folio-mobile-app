/**
 * `login.codeSentTo` wraps the number in `<mono>` so it can be rendered in the
 * monospace face. Three screens show that string, and two of them printed the
 * tag literally — "6-digit code sent to <mono>+33600000001</mono>." — because
 * they used `t()` instead of `<Trans>`. A reviewer signing up walked straight
 * into it.
 *
 * This guards the pairing rather than the pixels: any locale string carrying
 * markup must only ever be rendered through `<Trans>`.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const LOCALES = ["en", "fr", "vi"] as const;

/** Dotted key paths whose value contains an XML-ish tag, e.g. `login.codeSentTo`. */
function keysWithMarkup(value: unknown, trail: string[] = []): string[] {
  if (typeof value === "string") {
    return /<[a-zA-Z][a-zA-Z0-9]*>/.test(value) ? [trail.join(".")] : [];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      keysWithMarkup(child, [...trail, key]),
    );
  }
  return [];
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("locale strings that carry markup", () => {
  const markupKeys = [
    ...new Set(
      LOCALES.flatMap((locale) =>
        keysWithMarkup(
          JSON.parse(
            fs.readFileSync(
              path.join(ROOT, "src/i18n/locales", `${locale}.json`),
              "utf8",
            ),
          ),
        ),
      ),
    ),
  ];

  const files = [
    ...sourceFiles(path.join(ROOT, "app")),
    ...sourceFiles(path.join(ROOT, "src")),
  ].filter((file) => !file.includes("__tests__"));

  it("finds the markup-bearing keys it is meant to police", () => {
    expect(markupKeys).toContain("login.codeSentTo");
  });

  it.each(markupKeys)("%s is never rendered through t()", (key) => {
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      // `t("login.codeSentTo"...` — the plain call that prints the tag literally.
      return new RegExp(
        `\\bt\\(\\s*["'\`]${key.replace(/\./g, "\\.")}["'\`]`,
      ).test(source);
    });

    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });
});
