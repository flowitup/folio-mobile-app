#!/usr/bin/env node
/**
 * Guards against verifying Android against a stale debug APK.
 *
 * A debug build loads its JS from Metro, so it keeps working after JS-only changes and looks
 * current. Its *native* shell does not: a new dependency or a new Expo config plugin only reaches
 * the device through a rebuild, and an APK missing a native module fails at the call site.
 * expo-device and expo-notifications landed after the last built APK, so push registration would
 * have thrown on a build that looked healthy in every other respect.
 *
 * android/ is generated (it is gitignored — Expo continuous native generation), so the tracked
 * native surface is exactly: package.json dependencies + the Expo config plugins in app.json.
 *
 * Usage: node scripts/check-android-apk-freshness.mjs [--json]
 * Exit 0 when the APK can be trusted, 1 when it must be rebuilt.
 */

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APK_PATH = "android/app/build/outputs/apk/debug/app-debug.apk";
const REBUILD_HINT =
  'JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \\\n' +
  '  ANDROID_HOME="$HOME/Library/Android/sdk" \\\n' +
  "  (cd android && ./gradlew assembleDebug)";

function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** package.json dependency names at a commit — the set that decides native linking. */
function dependenciesAt(commit) {
  const raw = git(["show", `${commit}:package.json`]);
  return Object.keys(JSON.parse(raw).dependencies ?? {}).sort();
}

/** Expo config plugins at a commit; adding one changes the generated native project. */
function pluginsAt(commit) {
  const raw = git(["show", `${commit}:app.json`]);
  // A plugin entry is either "name" or ["name", {...}]; only the name matters here.
  return (JSON.parse(raw).expo?.plugins ?? [])
    .map((entry) => (Array.isArray(entry) ? entry[0] : entry))
    .sort();
}

const added = (before, after) => after.filter((name) => !before.includes(name));
const removed = (before, after) =>
  before.filter((name) => !after.includes(name));

function check() {
  const apkAbsolute = resolve(REPO_ROOT, APK_PATH);
  if (!existsSync(apkAbsolute)) {
    return { stale: true, reason: "missing", detail: `No APK at ${APK_PATH}.` };
  }

  const builtAt = statSync(apkAbsolute).mtime;
  // The commit the tree was on when the APK was built: everything native that landed after it is
  // absent from the binary.
  const builtFrom = git([
    "rev-list",
    "-1",
    `--before=${builtAt.toISOString()}`,
    "HEAD",
  ]);
  if (!builtFrom) {
    return {
      stale: true,
      reason: "unknown-origin",
      detail: `APK predates every commit reachable from HEAD (built ${builtAt.toISOString()}).`,
      builtAt,
    };
  }

  const head = git(["rev-parse", "HEAD"]);
  const beforeDeps = dependenciesAt(builtFrom);
  const afterDeps = dependenciesAt(head);
  const reasons = [];

  const newDeps = added(beforeDeps, afterDeps);
  const goneDeps = removed(beforeDeps, afterDeps);
  if (newDeps.length) reasons.push(`dependencies added: ${newDeps.join(", ")}`);
  if (goneDeps.length)
    reasons.push(`dependencies removed: ${goneDeps.join(", ")}`);

  const newPlugins = added(pluginsAt(builtFrom), pluginsAt(head));
  if (newPlugins.length)
    reasons.push(`Expo plugins added: ${newPlugins.join(", ")}`);

  return {
    stale: reasons.length > 0,
    reason: reasons.length ? "native-surface-changed" : "fresh",
    detail: reasons.join("; "),
    builtAt,
    builtFrom: builtFrom.slice(0, 7),
    head: head.slice(0, 7),
  };
}

const result = check();

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify(
      { ...result, builtAt: result.builtAt?.toISOString() },
      null,
      2,
    ),
  );
} else if (!result.stale) {
  console.log(
    `Android debug APK is current (built ${result.builtAt.toISOString()} from ${result.builtFrom}, HEAD ${result.head}).`,
  );
} else {
  console.error(
    "Android debug APK is STALE - rebuild before verifying on a device.",
  );
  console.error(`  ${result.detail}`);
  if (result.builtAt) {
    console.error(
      `  built ${result.builtAt.toISOString()} from ${result.builtFrom ?? "?"}`,
    );
  }
  console.error(`\n${REBUILD_HINT}`);
}

process.exit(result.stale ? 1 : 0);
