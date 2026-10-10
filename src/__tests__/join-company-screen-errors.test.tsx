/**
 * The join-by-code screen only translated a 404 and a 409. Offline, a 5xx or the rate limit
 * showed the raw message inline — "Network request failed", "HTTP 502 Bad Gateway",
 * "10 per 1 minute" — inside an otherwise Vietnamese onboarding step.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { ApiError } from "@/lib/query/api-error";
import JoinCompanyScreen from "../../app/(app)/join-company";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let mockJoinError: unknown = null;
jest.mock("@/features/companies/companies-api", () => ({
  useMyCompanies: () => ({ data: [] }),
  useJoinCompanyByCode: () => ({
    isPending: false,
    mutate: (
      _variables: unknown,
      options: { onError?: (error: unknown) => void },
    ) => options.onError?.(mockJoinError),
  }),
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: { email: "phone-1@no-email" }, signOut: jest.fn() }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({}),
}));

async function submitCode() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <JoinCompanyScreen />
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(screen.getByTestId("join-code"), "K7Q2M9XR");
  await fireEvent.press(screen.getByTestId("join-submit"));
  return screen.getByTestId("join-error");
}

afterAll(async () => {
  await i18n.changeLanguage("vi");
});

describe("join company by code: error line", () => {
  it.each(["vi", "fr", "en"])(
    "shows the network error when the request never reached the API (%s)",
    async (language) => {
      await i18n.changeLanguage(language);
      mockJoinError = new TypeError("Network request failed");
      expect(await submitCode()).toHaveTextContent(
        i18n.t("common.networkError"),
      );
    },
  );

  it.each(["vi", "fr", "en"])(
    "shows 'too many attempts' for the rate limit (%s)",
    async (language) => {
      await i18n.changeLanguage(language);
      mockJoinError = new ApiError(429, "TooManyRequests", "10 per 1 minute");
      const line = await submitCode();
      expect(line).toHaveTextContent(i18n.t("common.errors.tooManyRequests"));
      expect(line).not.toHaveTextContent(/per 1 minute/);
    },
  );

  it("hides a gateway error behind the generic retry text", async () => {
    await i18n.changeLanguage("vi");
    mockJoinError = new ApiError(502, "HttpError", "HTTP 502 Bad Gateway");
    const line = await submitCode();
    expect(line).toHaveTextContent(i18n.t("common.requestFailed"));
    expect(line).not.toHaveTextContent(/502/);
  });

  it("still names an unknown code", async () => {
    await i18n.changeLanguage("vi");
    mockJoinError = new ApiError(
      404,
      "NotFound",
      "Unknown or revoked company code",
    );
    expect(await submitCode()).toHaveTextContent(
      i18n.t("companies.join.errors.unknownCode"),
    );
  });
});
