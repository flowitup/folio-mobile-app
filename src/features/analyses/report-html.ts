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

/**
 * What the WebView does with a navigation request from a report: stay on the report document
 * (`about:blank` and its `#anchors`), open a link outside the app, or refuse. Nothing ever replaces
 * the report inside Folio's viewer. iOS reports real clicks; Android always says `other`, so there a
 * link (or a scripted redirect) can only open the system browser, where the address is visible.
 */
export function reportNavigation(
  request: { url: string; navigationType?: string; isTopFrame?: boolean },
  os: string,
): "allow" | "external" | "block" {
  if (request.url.startsWith("about:")) return "allow";
  if (request.isTopFrame === false || !EXTERNAL_SCHEME.test(request.url))
    return "block";
  return os === "android" || request.navigationType === "click"
    ? "external"
    : "block";
}
