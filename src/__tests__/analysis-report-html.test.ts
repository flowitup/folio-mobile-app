/**
 * Stored analysis reports render in a WebView from text, without the API's CSP header: the policy is
 * injected ahead of the report markup and navigation away from the report is refused.
 */
import {
  GESTURE_WINDOW_MS,
  REPORT_CSP,
  isGestureMessage,
  isRecentGesture,
  prepareReportHtml,
  reportGestureScript,
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

const NOW = 1_700_000_000_000;

describe("tap signal", () => {
  it("is recent only inside the window and never from the future", () => {
    expect(isRecentGesture(null, NOW)).toBe(false);
    expect(isRecentGesture(NOW - GESTURE_WINDOW_MS, NOW)).toBe(true);
    expect(isRecentGesture(NOW - GESTURE_WINDOW_MS - 1, NOW)).toBe(false);
    expect(isRecentGesture(NOW + 1, NOW)).toBe(false);
  });

  it("accepts only the message that carries this viewing's nonce", () => {
    expect(isGestureMessage(JSON.stringify({ folioTap: "n1" }), "n1")).toBe(
      true,
    );
    expect(isGestureMessage(JSON.stringify({ folioTap: "n2" }), "n1")).toBe(
      false,
    );
    for (const data of ["", "tap", "null", "[]", '{"folioTap":true}', "{}"])
      expect(isGestureMessage(data, "n1")).toBe(false);
  });

  describe("injected script", () => {
    function run(nonce: string) {
      const posted: string[] = [];
      let onClick: ((e: { isTrusted: boolean }) => void) | undefined;
      const win: Record<string, unknown> = {
        ReactNativeWebView: { postMessage: (m: string) => posted.push(m) },
        addEventListener: (
          type: string,
          fn: (e: { isTrusted: boolean }) => void,
          capture: boolean,
        ) => {
          if (type === "click" && capture) onClick = fn;
        },
      };
      new Function("window", reportGestureScript(nonce))(win);
      return { posted, click: onClick!, win };
    }

    it("reports trusted clicks with the nonce, ignores synthetic ones", () => {
      const { posted, click } = run("n-1");
      click({ isTrusted: false });
      expect(posted).toEqual([]);
      click({ isTrusted: true });
      expect(posted).toHaveLength(1);
      expect(isGestureMessage(posted[0], "n-1")).toBe(true);
    });

    it("takes the bridge off window so the report cannot post the nonce itself", () => {
      const { win } = run("n-1");
      expect(win.ReactNativeWebView).toBeUndefined();
    });

    it("is inert without a bridge and ends with a truthy value for the WebView", () => {
      const win = { addEventListener: jest.fn() };
      expect(() =>
        new Function("window", reportGestureScript("n"))(win),
      ).not.toThrow();
      expect(win.addEventListener).not.toHaveBeenCalled();
      expect(reportGestureScript("n").endsWith("true;")).toBe(true);
    });

    it("escapes the nonce as a JS string", () => {
      expect(reportGestureScript('a"b</script>')).toContain(
        JSON.stringify('a"b</script>'),
      );
    });
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
        NOW - 100,
        NOW,
      ),
    ).toBe("external");
    expect(
      reportNavigation(
        { url: "mailto:a@example.com", navigationType: "click" },
        "ios",
      ),
    ).toBe("external");
  });

  describe("Android, where every navigation is reported as `other`", () => {
    const redirect = {
      url: "https://example.com/folio-login",
      navigationType: "other",
      isTopFrame: true,
    };

    it("blocks a scripted redirect with no trusted tap", () => {
      expect(reportNavigation(redirect, "android", null, NOW)).toBe("block");
      expect(reportNavigation(redirect, "android", undefined, NOW)).toBe(
        "block",
      );
      expect(reportNavigation(redirect, "android")).toBe("block");
      for (const url of ["mailto:a@example.com", "tel:+33100000000"])
        expect(reportNavigation({ ...redirect, url }, "android", null)).toBe(
          "block",
        );
    });

    it("blocks a redirect once the tap is older than the window", () => {
      expect(
        reportNavigation(redirect, "android", NOW - GESTURE_WINDOW_MS - 1, NOW),
      ).toBe("block");
    });

    it("opens a link right after a trusted tap", () => {
      expect(reportNavigation(redirect, "android", NOW - 50, NOW)).toBe(
        "external",
      );
      expect(
        reportNavigation(redirect, "android", NOW - GESTURE_WINDOW_MS, NOW),
      ).toBe("external");
    });

    it("keeps the other rules after a tap", () => {
      const tapped = (url: string, isTopFrame?: boolean) =>
        reportNavigation(
          { url, navigationType: "other", isTopFrame },
          "android",
          NOW,
          NOW,
        );
      expect(tapped("about:blank#part-2")).toBe("allow");
      expect(tapped("intent://x#Intent;end")).toBe("block");
      expect(tapped("folio://projects")).toBe("block");
      expect(tapped("javascript:alert(1)")).toBe("block");
      expect(tapped("https://example.com/frame", false)).toBe("block");
    });
  });

  it("does not count a tap on iOS: only the platform's own click opens a link", () => {
    expect(
      reportNavigation(
        { url: "https://example.com/x", navigationType: "other" },
        "ios",
        NOW,
        NOW,
      ),
    ).toBe("block");
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
