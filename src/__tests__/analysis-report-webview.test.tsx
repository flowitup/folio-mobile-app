import { fireEvent, screen } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";

import ProjectAnalysesSection from "../../app/(app)/(tabs)/projects/[id]/analyses";
import { GESTURE_WINDOW_MS } from "@/features/analyses/report-html";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * Android reports every WebView navigation as `other`, so a scripted redirect in an uploaded report
 * must not reach the system browser, dialer or mail app: only a navigation right after a real tap
 * (seen as native touch events on the view around the WebView, out of the report's reach) may.
 * The report cannot inject anything into the app, so a hostile first script has nothing to hook.
 */
const ANALYSIS = { id: "a1", title: "Rapport", tags: [], size_bytes: 1 };

type WebViewProps = {
  injectedJavaScriptBeforeContentLoaded?: string;
  onMessage?: unknown;
  onShouldStartLoadWithRequest?: (request: {
    url: string;
    navigationType?: string;
    isTopFrame?: boolean;
  }) => boolean;
};
let mockWebView: WebViewProps | null = null;
jest.mock("react-native-webview", () => ({
  WebView: (props: WebViewProps) => {
    mockWebView = props;
    return null;
  },
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "p1" }),
  useFocusEffect: () => undefined,
}));
jest.mock("@/features/projects/use-project-can", () => ({
  useProjectCan: () => false,
}));
jest.mock("@/features/analyses/analyses-api", () => ({
  useAnalyses: () => ({
    data: [ANALYSIS],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useAnalysisTags: () => ({ data: [] }),
  useAnalysisContent: () => ({
    data: "<p>report</p>",
    isPending: false,
    isError: false,
  }),
  useDeleteAnalysis: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateAnalysis: () => ({ mutate: jest.fn(), isPending: false }),
  useUploadAnalysis: () => ({ mutate: jest.fn(), isPending: false }),
}));

const REDIRECT = {
  url: "https://example.com/folio-login",
  navigationType: "other",
  isTopFrame: true,
};

async function openReport() {
  await renderWithProviders(<ProjectAnalysesSection />);
  await fireEvent.press(await screen.findByTestId("analysis-open-a1"));
  expect(mockWebView).not.toBeNull();
  return mockWebView!;
}

const touch = (x: number, y: number) => ({
  nativeEvent: { pageX: x, pageY: y },
});
async function tap(x = 50, y = 50) {
  const view = screen.getByTestId("analysis-report");
  await fireEvent(view, "touchStart", touch(x, y));
  await fireEvent(view, "touchEnd", touch(x, y));
}

describe("report WebView on Android", () => {
  const os = Platform.OS;
  let openURL: jest.SpyInstance;
  beforeEach(() => {
    mockWebView = null;
    Platform.OS = "android";
    openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });
  afterEach(() => {
    Platform.OS = os;
    openURL.mockRestore();
  });

  it("does not open a scripted redirect that follows no tap", async () => {
    const web = await openReport();
    expect(web.onShouldStartLoadWithRequest!(REDIRECT)).toBe(false);
    expect(openURL).not.toHaveBeenCalled();
  });

  it("injects nothing into the report and listens to no message from it", async () => {
    const web = await openReport();
    expect(web.injectedJavaScriptBeforeContentLoaded).toBeUndefined();
    expect(web.onMessage).toBeUndefined();
  });

  it("opens the link after a tap, and still never loads it in place", async () => {
    const web = await openReport();
    await tap();
    expect(web.onShouldStartLoadWithRequest!(REDIRECT)).toBe(false);
    expect(openURL).toHaveBeenCalledWith(REDIRECT.url);
  });

  it("lets one tap open one link only", async () => {
    const web = await openReport();
    await tap();
    web.onShouldStartLoadWithRequest!(REDIRECT);
    web.onShouldStartLoadWithRequest!(REDIRECT);
    expect(openURL).toHaveBeenCalledTimes(1);
  });

  it("does not count a scroll as a tap", async () => {
    const web = await openReport();
    const view = screen.getByTestId("analysis-report");
    await fireEvent(view, "touchStart", touch(50, 400));
    await fireEvent(view, "touchEnd", touch(50, 120));
    web.onShouldStartLoadWithRequest!(REDIRECT);
    expect(openURL).not.toHaveBeenCalled();
  });

  it("stops trusting a touch once the finger moves past the tap slop, before it lifts", async () => {
    const web = await openReport();
    const view = screen.getByTestId("analysis-report");
    await fireEvent(view, "touchStart", touch(50, 400));
    await fireEvent(view, "touchMove", touch(50, 380));
    web.onShouldStartLoadWithRequest!(REDIRECT);
    expect(openURL).not.toHaveBeenCalled();
  });

  it("keeps trusting a touch that only jitters within the slop", async () => {
    const web = await openReport();
    const view = screen.getByTestId("analysis-report");
    await fireEvent(view, "touchStart", touch(50, 400));
    await fireEvent(view, "touchMove", touch(52, 402));
    web.onShouldStartLoadWithRequest!(REDIRECT);
    expect(openURL).toHaveBeenCalledWith(REDIRECT.url);
  });

  it("does not trust a cancelled touch", async () => {
    const web = await openReport();
    const view = screen.getByTestId("analysis-report");
    await fireEvent(view, "touchStart", touch(50, 50));
    await fireEvent(view, "touchCancel", touch(50, 50));
    web.onShouldStartLoadWithRequest!(REDIRECT);
    expect(openURL).not.toHaveBeenCalled();
  });

  it("stops trusting a tap after the window", async () => {
    const web = await openReport();
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_700_000_000_000);
    await tap();
    now.mockReturnValue(1_700_000_000_000 + GESTURE_WINDOW_MS + 1);
    web.onShouldStartLoadWithRequest!(REDIRECT);
    expect(openURL).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it("still refuses app deep links and intents right after a tap", async () => {
    const web = await openReport();
    await tap();
    for (const url of ["folio://settings", "intent://x#Intent;end"])
      expect(web.onShouldStartLoadWithRequest!({ ...REDIRECT, url })).toBe(
        false,
      );
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe("report WebView on iOS", () => {
  it("injects nothing and opens only real clicks", async () => {
    mockWebView = null;
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const web = await openReport();
    expect(web.injectedJavaScriptBeforeContentLoaded).toBeUndefined();
    web.onShouldStartLoadWithRequest!(REDIRECT);
    expect(openURL).not.toHaveBeenCalled();
    web.onShouldStartLoadWithRequest!({ ...REDIRECT, navigationType: "click" });
    expect(openURL).toHaveBeenCalledWith(REDIRECT.url);
    openURL.mockRestore();
  });
});
