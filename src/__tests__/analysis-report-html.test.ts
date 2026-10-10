/**
 * Stored analysis reports render in a WebView from text, without the API's CSP header: the policy is
 * injected ahead of the report markup and navigation away from the report is refused.
 */
import {
  REPORT_CSP,
  prepareReportHtml,
  reportNavigation,
} from "@/features/analyses/report-html";

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${REPORT_CSP}">`;
const VIEWPORT_META =
  '<meta name="viewport" content="width=device-width, initial-scale=1">';

describe("prepareReportHtml", () => {
  it("puts the CSP before any report markup, after the doctype", () => {
    const html =
      '<!DOCTYPE html><html><head><script src="https://example.com/remote.js"></script></head><body>x</body></html>';
    expect(prepareReportHtml(html)).toBe(
      `<!DOCTYPE html>${CSP_META}${VIEWPORT_META}<html><head><script src="https://example.com/remote.js"></script></head><body>x</body></html>`,
    );
  });

  it("covers a script placed before <head> and a document without doctype", () => {
    const html =
      "<script>fetch('https://example.com/beacon')</script><p>hi</p>";
    const out = prepareReportHtml(html);
    expect(out.startsWith(CSP_META)).toBe(true);
    expect(out.endsWith(html)).toBe(true);
  });

  it("keeps leading comments and whitespace ahead of the doctype", () => {
    const html = "\n<!-- generated -->\n<!doctype html><html></html>";
    expect(prepareReportHtml(html)).toBe(
      `\n<!-- generated -->\n<!doctype html>${CSP_META}${VIEWPORT_META}<html></html>`,
    );
  });

  it.each([
    ["", "\u00a0<script src=https://e.com/x.js></script>"],
    ["", "\v<script src=https://e.com/x.js></script>"],
    ["", "<!--><script src=https://e.com/x.js></script>-->"],
    ["", "<!---><script src=https://e.com/x.js></script>-->"],
    ["<!-- a --!>", "<script src=https://e.com/x.js></script>-->"],
  ])(
    "reads the prologue as the HTML parser does, so no script precedes the CSP: %j + %j",
    (prologue, rest) => {
      expect(prepareReportHtml(prologue + rest)).toBe(
        `${prologue}${CSP_META}${VIEWPORT_META}${rest}`,
      );
    },
  );

  it("does not add a second viewport meta", () => {
    const html =
      '<html><head><meta name="viewport" content="width=600"></head></html>';
    expect(prepareReportHtml(html)).toBe(`${CSP_META}${html}`);
  });

  it("blocks network calls, remote scripts, frames and form posts but keeps inline script and CSS", () => {
    expect(REPORT_CSP).toContain("default-src 'none'");
    expect(REPORT_CSP).toContain("script-src 'unsafe-inline'");
    expect(REPORT_CSP).toContain("style-src 'unsafe-inline'");
    expect(REPORT_CSP).toContain("form-action 'none'");
    expect(REPORT_CSP).not.toMatch(
      /connect-src|frame-src|script-src[^;]*https/,
    );
  });
});

describe("reportNavigation", () => {
  it("keeps the report document and its anchors", () => {
    expect(
      reportNavigation({ url: "about:blank", navigationType: "other" }, "ios"),
    ).toBe("allow");
    expect(reportNavigation({ url: "about:blank#part-2" }, "android")).toBe(
      "allow",
    );
  });

  it("never replaces the report on a meta refresh or scripted redirect (iOS)", () => {
    expect(
      reportNavigation(
        {
          url: "https://example.com/folio-login",
          navigationType: "other",
          isTopFrame: true,
        },
        "ios",
      ),
    ).toBe("block");
  });

  it("opens a clicked link outside the app", () => {
    expect(
      reportNavigation(
        {
          url: "https://example.com/source",
          navigationType: "click",
          isTopFrame: true,
        },
        "ios",
      ),
    ).toBe("external");
    expect(
      reportNavigation(
        { url: "https://example.com/source", navigationType: "other" },
        "android",
      ),
    ).toBe("external");
    expect(
      reportNavigation(
        { url: "mailto:a@example.com", navigationType: "click" },
        "ios",
      ),
    ).toBe("external");
  });

  it("refuses app deep links, data URLs and sub-frame loads", () => {
    expect(
      reportNavigation(
        { url: "folio://projects", navigationType: "click" },
        "ios",
      ),
    ).toBe("block");
    expect(reportNavigation({ url: "intent://x#Intent;end" }, "android")).toBe(
      "block",
    );
    expect(
      reportNavigation(
        { url: "data:text/html,<p>x</p>", navigationType: "click" },
        "ios",
      ),
    ).toBe("block");
    expect(
      reportNavigation(
        {
          url: "https://example.com/frame",
          navigationType: "click",
          isTopFrame: false,
        },
        "ios",
      ),
    ).toBe("block");
  });
});
