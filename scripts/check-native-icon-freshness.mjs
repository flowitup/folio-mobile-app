#!/usr/bin/env node
/**
 * Guards against a generated native project carrying stale brand icons.
 *
 * ios/ and android/ are generated (they are gitignored — Expo continuous native generation), and
 * prebuild copies the brand assets into them exactly once, at generation time. Nothing re-syncs
 * them afterwards: `expo run:ios` / `expo run:android` skip prebuild when the native directory
 * already exists, so a native project generated before a brand change keeps building the old
 * launcher icon. The JS is current, every gate is green, and the icon on the springboard is wrong
 * for a reason nothing in the diff explains.
 *
 * Timestamps alone cannot answer this — a checkout rewrites mtimes — so the artifact's mtime is
 * used only to locate the commit the native project was generated from. The verdict comes from
 * comparing the tracked brand inputs (the asset blobs, plus the app.json keys pointing at them)
 * between that commit and the current working tree, which is what the next build would consume.
 *
 * Usage: node scripts/check-native-icon-freshness.mjs [--json]
 * Exit 0 when the generated icons match the working tree, 1 when a prebuild is required.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One entry per platform: the generated artifact that dates the native project, the tracked
 * assets prebuild reads to produce it, and the app.json keys that select those assets.
 */
const PLATFORMS = [
  {
    name: "ios",
    nativeDir: "ios",
    artifact:
      "ios/Folio/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png",
    assets: ["assets/icon.png"],
    configPaths: [["icon"]],
    rebuildHint: "npx expo prebuild -p ios --clean",
  },
  {
    name: "android",
    nativeDir: "android",
    // One density is enough: prebuild regenerates every mipmap in the same pass.
    artifact:
      "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp",
    assets: [
      "assets/icon.png",
      "assets/android-icon-foreground.png",
      "assets/android-icon-background.png",
      "assets/android-icon-monochrome.png",
    ],
    configPaths: [["icon"], ["android", "adaptiveIcon"]],
    rebuildHint: "npx expo prebuild -p android --clean",
  },
];

function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** Blob hash of a tracked path at a commit, or null when it did not exist yet. */
function blobAt(commit, path) {
  try {
    return git(["rev-parse", `${commit}:${path}`]);
  } catch {
    return null;
  }
}

/** Blob hash of the file as it sits on disk — what the next prebuild would actually copy. */
function blobOnDisk(path) {
  if (!existsSync(resolve(REPO_ROOT, path))) return null;
  return git(["hash-object", path]);
}

/** app.json's expo config at a commit, or from the working tree when commit is null. */
function appConfig(commit) {
  const raw =
    commit === null
      ? readFileSync(resolve(REPO_ROOT, "app.json"), "utf8")
      : git(["show", `${commit}:app.json`]);
  try {
    return JSON.parse(raw).expo ?? null;
  } catch {
    return null;
  }
}

/** Serialised value at a key path, so a repointed icon path counts as a change. */
function configValue(expo, keys) {
  let node = expo;
  for (const key of keys) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[key];
  }
  return JSON.stringify(node);
}

/** The brand inputs for one platform, at a commit (or the working tree when commit is null). */
function brandState(platform, commit) {
  const expo = appConfig(commit);
  return {
    assets: Object.fromEntries(
      platform.assets.map((path) => [
        path,
        commit === null ? blobOnDisk(path) : blobAt(commit, path),
      ]),
    ),
    config: Object.fromEntries(
      platform.configPaths.map((keys) => [
        keys.join("."),
        configValue(expo, keys),
      ]),
    ),
  };
}

function diffState(before, after) {
  const changes = [];
  for (const [path, hash] of Object.entries(after.assets)) {
    if (before.assets[path] !== hash) changes.push(path);
  }
  for (const [key, value] of Object.entries(after.config)) {
    if (before.config[key] !== value) changes.push(`app.json expo.${key}`);
  }
  return changes;
}

function check(platform) {
  const base = { platform: platform.name };

  if (!existsSync(resolve(REPO_ROOT, platform.nativeDir))) {
    // Never prebuilt here (CI, a fresh clone): there is no artifact to be stale.
    return { ...base, skipped: true, reason: "not-generated" };
  }

  const artifact = resolve(REPO_ROOT, platform.artifact);
  if (!existsSync(artifact)) {
    return {
      ...base,
      stale: true,
      reason: "missing-icon",
      detail: `${platform.nativeDir}/ exists but ${platform.artifact} does not.`,
    };
  }

  const generatedAt = statSync(artifact).mtime;
  // The commit the tree was on when prebuild ran: brand changes that landed after it never
  // reached the native project.
  const generatedFrom = git([
    "rev-list",
    "-1",
    `--before=${generatedAt.toISOString()}`,
    "HEAD",
  ]);
  if (!generatedFrom) {
    return {
      ...base,
      stale: true,
      reason: "unknown-origin",
      detail: `Native icons predate every commit reachable from HEAD (generated ${generatedAt.toISOString()}).`,
      generatedAt,
    };
  }

  const changes = diffState(
    brandState(platform, generatedFrom),
    brandState(platform, null),
  );

  return {
    ...base,
    stale: changes.length > 0,
    reason: changes.length ? "brand-assets-changed" : "fresh",
    detail: changes.join(", "),
    generatedAt,
    generatedFrom: generatedFrom.slice(0, 7),
  };
}

const results = PLATFORMS.map(check);
const stale = results.filter((result) => result.stale);

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      results.map((result) => ({
        ...result,
        generatedAt: result.generatedAt?.toISOString(),
      })),
      null,
      2,
    ),
  );
} else {
  for (const result of results) {
    if (result.skipped) {
      console.log(
        `${result.platform}: not generated on this machine — skipped.`,
      );
    } else if (!result.stale) {
      console.log(
        `${result.platform}: native icons are current (generated ${result.generatedAt.toISOString()} from ${result.generatedFrom}).`,
      );
    } else {
      console.error(
        `${result.platform}: native icons are STALE — the build would ship the wrong launcher icon.`,
      );
      if (result.detail) console.error(`  changed since: ${result.detail}`);
      const hint = PLATFORMS.find(
        (platform) => platform.name === result.platform,
      )?.rebuildHint;
      if (hint) console.error(`  ${hint}`);
    }
  }
}

process.exit(stale.length ? 1 : 0);
