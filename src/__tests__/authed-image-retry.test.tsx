import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { AuthedImage } from "@/components/ui/authed-image";

const mockAuthedFetch = jest.fn();
jest.mock("@/api/authed-fetch", () => ({
  authedFetch: (...args: unknown[]) => mockAuthedFetch(...args),
}));
jest.mock("@/auth/token-storage", () => ({
  getStoredTokens: async () => ({ accessToken: "tok", refreshToken: "r" }),
}));

/** sweep-rate-limits-11: a rate-limited thumbnail is not an empty tile for good. */
describe("AuthedImage after a 429", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAuthedFetch.mockReset();
    mockAuthedFetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === "Retry-After" ? "3" : null) },
    });
  });
  afterEach(() => jest.useRealTimers());

  it("shows a retry tile, then tries again once the wait is over", async () => {
    await render(
      <AuthedImage testID="thumb" path="/api/v1/photos/1/thumbnail" />,
    );
    await act(async () => {});
    await act(async () => {
      fireEvent(screen.getByTestId("thumb"), "error", {
        nativeEvent: { error: "429" },
      });
    });
    expect(screen.getByTestId("authed-image-retry")).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    // The native image is mounted again for a new try.
    expect(screen.getByTestId("thumb")).toBeTruthy();
    expect(screen.queryByTestId("authed-image-retry")).toBeNull();
  });

  it("tries again on a tap", async () => {
    await render(
      <AuthedImage testID="thumb" path="/api/v1/photos/2/thumbnail" />,
    );
    await act(async () => {});
    await act(async () => {
      fireEvent(screen.getByTestId("thumb"), "error", {
        nativeEvent: { error: "429" },
      });
    });
    await fireEvent.press(screen.getByTestId("authed-image-retry"));
    expect(screen.getByTestId("thumb")).toBeTruthy();
  });
});
