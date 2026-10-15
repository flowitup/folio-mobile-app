import { act, fireEvent, screen } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";

import ProjectAnalysesSection from "../../app/(app)/(tabs)/projects/[id]/analyses";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * Android reports every WebView navigation as `other`, so a scripted redirect in an uploaded report
 * must not reach the system browser, dialer or mail app: only a navigation right after a real tap
 * (signalled by the injected script, with this viewing's nonce) may.
 */
const ANALYSIS = { id: "a1", title: "Rapport", tags: [], size_bytes: 1 };

type WebViewProps = {
  injectedJavaScriptBeforeContentLoaded?: string;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
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

/** The nonce the injected script was built with. */
function nonceOf(web: WebViewProps) {
  return /folioTap:("[^"]+")/.exec(
    web.injectedJavaScriptBeforeContentLoaded!,
  )![1];
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

  it("does not trust a message that lacks this viewing's nonce", async () => {
    const web = await openReport();
    await act(async () =>
      web.onMessage!({
        nativeEvent: { data: JSON.stringify({ folioTap: "guess" }) },
      }),
    );
    web.onShouldStartLoadWithRequest!(REDIRECT);
    expect(openURL).not.toHaveBeenCalled();
  });

  it("opens the link after the tap signal, and still never loads it in place", async () => {
    const web = await openReport();
    expect(web.injectedJavaScriptBeforeContentLoaded).toContain("isTrusted");
    const nonce = nonceOf(web);
    await act(async () =>
      web.onMessage!({
        nativeEvent: { data: JSON.stringify({ folioTap: JSON.parse(nonce) }) },
      }),
    );
    expect(web.onShouldStartLoadWithRequest!(REDIRECT)).toBe(false);
    expect(openURL).toHaveBeenCalledWith(REDIRECT.url);
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
