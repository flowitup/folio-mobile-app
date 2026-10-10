/**
 * A number that hit its hourly SMS-code cap gets 429 `OtpHourlyLimit` with Retry-After. The
 * app said "A code was sent a moment ago. Wait a minute and try again." for every 429, so the
 * user came back each minute and failed again for up to an hour.
 */

import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { AuthProvider, useAuth } from "@/auth/auth-context";
import i18n from "@/i18n";
import { AuthRequestError } from "@/lib/auth/auth-error-message";

jest.mock("@/auth/token-storage", () => ({
  getStoredTokens: jest.fn(async () => ({
    accessToken: null,
    refreshToken: null,
  })),
  setStoredTokens: jest.fn(async () => undefined),
  clearStoredTokens: jest.fn(async () => undefined),
}));

jest.mock("@/features/push/push-device-registration", () => ({
  unregisterPushDevice: jest.fn(async () => undefined),
  forgetPushToken: jest.fn(async () => undefined),
  clearHandledPushResponse: jest.fn(),
}));

const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: jest.fn(),
    POST: (...args: unknown[]) => mockPost(...args),
  },
  refreshAccessToken: jest.fn(async () => "rejected"),
  setSessionExpiredHandler: jest.fn(),
}));

function throttled(error: string, retryAfter: string) {
  return {
    error: { error, message: "Server wording", status_code: 429 },
    response: new Response(null, {
      status: 429,
      headers: { "Retry-After": retryAfter },
    }),
  };
}

function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

async function requestOtpError(): Promise<AuthRequestError> {
  const { result } = await renderHook(useAuth, { wrapper: Providers });
  await waitFor(() => expect(result.current.status).toBe("signedOut"));
  return result.current.requestOtp("+33612345678").then(
    () => {
      throw new Error("expected a refusal");
    },
    (caught: AuthRequestError) => caught,
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

describe("requesting a sign-in code past the hourly cap", () => {
  it("names how long to wait, from Retry-After", async () => {
    mockPost.mockResolvedValue(throttled("OtpHourlyLimit", "2585"));

    const caught = await requestOtpError();

    expect(caught).toBeInstanceOf(AuthRequestError);
    expect(caught.status).toBe(429);
    expect(caught.message).toBe(
      "Too many codes were requested for this number. Try again in 44 minutes.",
    );
  });

  it("keeps the one-minute text for the short resend gap", async () => {
    mockPost.mockResolvedValue(throttled("TooManyRequests", "60"));

    const caught = await requestOtpError();

    expect(caught.message).toBe(
      "A code was sent a moment ago. Wait a minute and try again.",
    );
  });
});
