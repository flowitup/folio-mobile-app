import { act, fireEvent, render, screen } from "@testing-library/react-native";

import {
  NETWORK_TOAST_MS,
  ToastProvider,
  showToast,
} from "@/components/ui/toast";

/** P-12: the "not saved, no network" toast stays long enough to read, and a tap closes it. */
describe("toast duration", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("keeps a network toast past the 6 s of an ordinary error", async () => {
    await render(<ToastProvider>{null}</ToastProvider>);
    await act(async () =>
      showToast("offline", "error", { durationMs: NETWORK_TOAST_MS }),
    );
    await act(async () => jest.advanceTimersByTime(6500));
    expect(screen.getByText("offline")).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(NETWORK_TOAST_MS));
    expect(screen.queryByText("offline")).toBeNull();
  });

  it("closes on tap", async () => {
    await render(<ToastProvider>{null}</ToastProvider>);
    await act(async () =>
      showToast("offline", "error", { durationMs: NETWORK_TOAST_MS }),
    );
    await fireEvent.press(screen.getByTestId("toast-error"));
    expect(screen.queryByText("offline")).toBeNull();
  });

  it("still drops an ordinary error after 6 s", async () => {
    await render(<ToastProvider>{null}</ToastProvider>);
    await act(async () => showToast("boom", "error"));
    await act(async () => jest.advanceTimersByTime(6100));
    expect(screen.queryByText("boom")).toBeNull();
  });
});
