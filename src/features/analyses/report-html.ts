/**
 * Confinement of stored HTML analysis reports in the app's WebView. The body is fetched as text, so
 * the API's Content-Security-Policy header never reaches the WebView: the same policy (minus the
 * header-only `sandbox` / `frame-ancestors`) is injected as a meta tag, and navigation away from the
 * report is refused. Inline CSS and the reports' inline scroll-reveal script keep working; remote
 * scripts, fetch/XHR beacons, frames and form posts are blocked.
 */
export const REPORT_CSP = [
  "default-src 'none'",
  "img-src data: https:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/**
 * Leading whitespace, comments and doctype: the injected tags go after them so standards mode holds.
 * Only what the HTML parser itself skips counts: its five whitespace characters (not JS `\s`, whose
 * NBSP or \v would open the body and leave the CSP meta outside <head>, where it is ignored) and
 * comments closed the way the tokenizer closes them (`<!-->`, `<!--->` and `--!>` end a comment early).
 */
const PROLOGUE =
  /^(?:[\t\n\f\r ]|<!--(?!-?>)[\s\S]*?--!?>)*(?:<!doctype[^>]*>)?/i;

/**
 * Report HTML with the CSP meta (and a phone-scale viewport meta when the report has none) placed
 * before any report markup: the parser puts them in the head, so the policy covers every script.
 */
export function prepareReportHtml(html: string): string {
  const csp = `<meta http-equiv="Content-Security-Policy" content="${REPORT_CSP}">`;
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html)
    ? ""
    : '<meta name="viewport" content="width=device-width, initial-scale=1">';
  const prologue = PROLOGUE.exec(html)?.[0] ?? "";
  return `${prologue}${csp}${viewport}${html.slice(prologue.length)}`;
}

/** Schemes a report link may hand to the system (browser, mail, phone); never app deep links. */
const EXTERNAL_SCHEME = /^(https?|mailto|tel):/i;

/** How long a tap in the report keeps a link navigation "user initiated" (Android only). */
export const GESTURE_WINDOW_MS = 3000;

/** True when the last trusted tap reached us less than {@link GESTURE_WINDOW_MS} ago. */
export function isRecentGesture(
  gestureAt: number | null | undefined,
  now: number = Date.now(),
): boolean {
  return (
    gestureAt != null &&
    now - gestureAt >= 0 &&
    now - gestureAt <= GESTURE_WINDOW_MS
  );
}

/**
 * Android reports every navigation as `other`, so a scripted `location.href` looks like a tapped
 * link. This script runs before the report's own scripts and tells the app about real taps only
 * (`isTrusted` is false for synthetic events). The report's scripts could post messages too, so the
 * message carries a per-viewing nonce that lives only in this closure, and the bridge is taken off
 * `window` once captured.
 */
export function reportGestureScript(nonce: string): string {
  return `(function(){var rn=window.ReactNativeWebView;if(!rn)return;var m=JSON.stringify({folioTap:${JSON.stringify(nonce)}});try{delete window.ReactNativeWebView;}catch(x){}window.addEventListener("click",function(e){if(e.isTrusted)rn.postMessage(m);},true);})();true;`;
}

/** A fresh per-viewing secret for {@link reportGestureScript}; a stored report cannot know it. */
export function newReportNonce(): string {
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/** Whether a WebView message is the tap signal of this viewing; any other message is ignored. */
export function isGestureMessage(data: string, nonce: string): boolean {
  try {
    const message: unknown = JSON.parse(data);
    return (
      typeof message === "object" &&
      message !== null &&
      (message as { folioTap?: unknown }).folioTap === nonce
    );
  } catch {
    return false;
  }
}

/**
 * What the WebView does with a navigation request from a report: stay on the report document
 * (`about:blank` and its `#anchors`), open a link outside the app, or refuse. Nothing ever replaces
 * the report inside Folio's viewer. iOS reports real clicks; Android always says `other`, so there
 * a link only opens outside the app right after a trusted tap in the report (`gestureAt`, see
 * {@link reportGestureScript}), never on a scripted redirect.
 */
export function reportNavigation(
  request: { url: string; navigationType?: string; isTopFrame?: boolean },
  os: string,
  gestureAt?: number | null,
  now: number = Date.now(),
): "allow" | "external" | "block" {
  if (request.url.startsWith("about:")) return "allow";
  if (request.isTopFrame === false || !EXTERNAL_SCHEME.test(request.url))
    return "block";
  const userInitiated =
    os === "android"
      ? isRecentGesture(gestureAt, now)
      : request.navigationType === "click";
  return userInitiated ? "external" : "block";
}
