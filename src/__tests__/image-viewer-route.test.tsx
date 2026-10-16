/**
 * One picture viewer in the app: the `/image-viewer` route that `openFile` opens for a
 * downloaded picture shows the same `ImageViewer` as documents and expense attachments.
 */
import { fireEvent, screen } from "@testing-library/react-native";

import { renderWithProviders } from "./helpers/release-qa-fixtures";
import ImageViewerScreen from "../../app/(app)/image-viewer";
import { openImageViewer } from "@/lib/files/open-file";

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: () => mockBack(),
    canGoBack: () => true,
    replace: jest.fn(),
  },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
const mockShareLocalFile = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock("@/lib/files/download", () => ({
  downloadToCache: jest.fn(),
  cachedFileExists: jest.fn(() => true),
  shareLocalFile: (...args: unknown[]) => mockShareLocalFile(...args),
}));

describe("image viewer route", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockShareLocalFile.mockClear();
  });

  it("shows a downloaded picture in the shared viewer, with Share and Close", async () => {
    openImageViewer("file:///cache/ticket.jpg", "ticket.jpg", "image/jpeg");
    mockParams = mockPush.mock.calls.at(-1)?.[0].params;
    await renderWithProviders(<ImageViewerScreen />);

    expect(screen.getByTestId("image-viewer")).toBeTruthy();
    expect(screen.getByTestId("image-viewer-image").props.source).toEqual({
      uri: "file:///cache/ticket.jpg",
    });
    await fireEvent.press(screen.getByTestId("image-viewer-share"));
    expect(mockShareLocalFile).toHaveBeenCalledWith(
      "file:///cache/ticket.jpg",
      "image/jpeg",
    );
    await fireEvent.press(screen.getByTestId("image-viewer-close"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("refuses a token it did not register", async () => {
    mockParams = { file: "forged", title: "x" };
    await renderWithProviders(<ImageViewerScreen />);
    expect(screen.getByTestId("image-viewer-missing")).toBeTruthy();
    expect(screen.queryByTestId("image-viewer-image")).toBeNull();
  });
});
