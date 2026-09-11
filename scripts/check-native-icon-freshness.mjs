#!/usr/bin/env node
/**
 * Guards against a generated native project carrying stale brand assets — the launcher icon and
 * the splash screen.
 *
 * ios/ and android/ are generated (they are gitignored — Expo continuous native generation), and
 * prebuild copies the brand assets into them exactly once, at generation time. Nothing re-syncs
 * them afterwards: `expo run:ios` / `expo run:android` skip prebuild when the native directory
 * already exists, so a native project generated before a brand change keeps building the old
 * launcher icon, or no splash screen at all. The JS is current, every gate is green, and what the
 * device shows is wrong for a reason nothing in the diff explains.
 *
 * Timestamps alone cannot answer this — a checkout rewrites mtimes — so the oldest artifact mtime
 * is used only to locate the commit the native project was generated from. The verdict comes from
 * comparing the tracked brand inputs (the asset blobs, the app.json keys pointing at them, and the
 * expo-splash-screen plugin entry that configures the splash) between that commit and the current
 * working tree, which is what the next build would consume. A project generated before an asset
 * existed at all never wrote it, and is caught by the missing artifact rather than by that diff.
 *
 * Usage: node scripts/check-native-icon-freshness.mjs [--json]
 * Exit 0 when the generated assets match the working tree, 1 when a prebuild is required.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * One entry per platform: the generated artifacts that must exist and that date the native
 * project, the tracked assets prebuild reads to produce them, and the app.json keys and plugin
 * entries that select those assets.
 */
const PLATFORMS = [
  {
    name: "ios",
    nativeDir: "ios",
    // One density is enough per asset: prebuild writes the whole imageset in the same pass.
    artifacts: [
      "ios/Folio/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png",
      "ios/Folio/Images.xcassets/SplashScreenLogo.imageset/image@3x.png",
    ],
    assets: ["assets/icon.png", "assets/splash-icon.png"],
    configPaths: [["icon"]],
    configPlugins: ["expo-splash-screen"],
    rebuildHint: "npx expo prebuild -p ios --clean",
  },
  {
    name: "android",
    nativeDir: "android",
    // One density is enough: prebuild regenerates every mipmap and drawable in the same pass.
    artifacts: [
      "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp",
      "android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png",
    ],
    assets: [
      "assets/icon.png",
      "assets/android-icon-foreground.png",
      "assets/android-icon-background.png",
      "assets/android-icon-monochrome.png",
      "assets/splash-icon.png",
    ],
    configPaths: [["icon"], ["android", "adaptiveIcon"]],
    configPlugins: ["expo-splash-screen"],
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

/**
 * A plugin's entry in expo.plugins, which is a flat array of either "name" or ["name", props].
 * Returning the whole entry means repointing the splash image or recolouring it counts as a change.
 */
function pluginEntry(expo, name) {
  const plugins = expo?.plugins;
  if (!Array.isArray(plugins)) return undefined;
  return JSON.stringify(
    plugins.find(
      (plugin) =>
        plugin === name || (Array.isArray(plugin) && plugin[0] === name),
    ),
  );
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
    config: Object.fromEntries([
      ...platform.configPaths.map((keys) => [
        keys.join("."),
        configValue(expo, keys),
      ]),
      ...platform.configPlugins.map((name) => [
        `plugins.${name}`,
        pluginEntry(expo, name),
      ]),
    ]),
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

  const missing = platform.artifacts.filter(
    (path) => !existsSync(resolve(REPO_ROOT, path)),
  );
  if (missing.length) {
    // Generated before this asset existed at all — no commit comparison can add to that.
    return {
      ...base,
      stale: true,
      reason: "missing-artifact",
      detail: `${platform.nativeDir}/ exists but ${missing.join(", ")} does not.`,
    };
  }

  // The oldest artifact dates the project, so a partly refreshed one is judged by its stalest part.
  const generatedAt = platform.artifacts
    .map((path) => statSync(resolve(REPO_ROOT, path)).mtime)
    .reduce((oldest, mtime) => (mtime < oldest ? mtime : oldest));
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
      detail: `Native brand assets predate every commit reachable from HEAD (generated ${generatedAt.toISOString()}).`,
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
        `${result.platform}: native brand assets are current (generated ${result.generatedAt.toISOString()} from ${result.generatedFrom}).`,
      );
    } else {
      console.error(
        `${result.platform}: native brand assets are STALE — the build would ship the wrong launcher icon or splash screen.`,
      );
      if (result.detail) {
        console.error(
          result.reason === "brand-assets-changed"
            ? `  changed since: ${result.detail}`
            : `  ${result.detail}`,
        );
      }
      const hint = PLATFORMS.find(
        (platform) => platform.name === result.platform,
      )?.rebuildHint;
      if (hint) console.error(`  ${hint}`);
    }
  }
}

process.exit(stale.length ? 1 : 0);
