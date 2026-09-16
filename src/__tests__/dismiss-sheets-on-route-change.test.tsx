import { render } from "@testing-library/react-native";

import { DismissSheetsOnRouteChange } from "@/components/shell/dismiss-sheets-on-route-change";

let mockPathname = "/labor";
jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
}));

const mockDismissAll = jest.fn();
jest.mock("@gorhom/bottom-sheet", () => ({
  useBottomSheetModal: () => ({ dismissAll: mockDismissAll }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/labor";
});

/**
 * Reproduces the deep-link case: a form sheet was open on one screen and a push
 * notification navigated elsewhere, leaving the sheet floating over the new screen.
 */
describe("dismissing sheets on navigation", () => {
  it("closes open sheets once the route changes", async () => {
    const view = await render(<DismissSheetsOnRouteChange />);
    expect(mockDismissAll).not.toHaveBeenCalled();

    mockPathname = "/projects/p1/notes";
    await view.rerender(<DismissSheetsOnRouteChange />);

    expect(mockDismissAll).toHaveBeenCalledTimes(1);
  });

  it("leaves them alone while the route is unchanged", async () => {
    const view = await render(<DismissSheetsOnRouteChange />);
    await view.rerender(<DismissSheetsOnRouteChange />);
    await view.rerender(<DismissSheetsOnRouteChange />);

    // Re-renders happen constantly — a sheet opened from this very screen must survive them.
    expect(mockDismissAll).not.toHaveBeenCalled();
  });
});
