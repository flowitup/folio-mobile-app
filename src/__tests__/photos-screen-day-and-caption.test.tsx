import { fireEvent, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { formatDate, localDayKey } from "@/lib/format/date";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

import ProjectPhotosSection from "../../app/(app)/(tabs)/projects/[id]/photos";

// The photos screen files a capture under the device's calendar day (the day "today" uses), caps
// the caption at the 500 characters the web and the API accept, lets an editor correct the date,
// and tells a member without the edit right why there is no add button.

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "p1" }),
}));

jest.mock("@/lib/query/use-refetch-on-focus", () => ({
  useRefetchOnFocus: () => undefined,
}));

let mockCanWrite = true;
jest.mock("@/features/projects/use-project-can", () => ({
  useProjectCan: () => mockCanWrite,
}));

jest.mock("@/components/ui/date-picker", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    DatePicker: ({
      testID,
      value,
      onChange,
    }: {
      testID: string;
      value: string | null;
      onChange: (day: string) => void;
    }) => (
      <Pressable testID={testID} onPress={() => onChange("2026-09-20")}>
        <Text>{value}</Text>
      </Pressable>
    ),
  };
});

jest.mock("@/components/ui/authed-image", () => ({
  AuthedImage: () => null,
}));

jest.mock("@/components/ui/sheet", () => {
  const { forwardRef } = jest.requireActual("react");
  return { Sheet: forwardRef(() => null) };
});

const PHOTO = {
  id: "ph1",
  project_id: "p1",
  filename: "chantier.jpg",
  content_type: "image/jpeg",
  size_bytes: 1024,
  caption: null,
  // 22:30 UTC on 1 October is 00:30 on 2 October in Paris
  captured_at: "2026-10-01T22:30:00+00:00",
  uploaded_at: "2026-10-01T22:30:00+00:00",
  uploader_id: "u1",
  thumbnail_url: "/api/v1/projects/p1/photos/ph1/thumbnail",
  original_url: "/api/v1/projects/p1/photos/ph1/original",
};

const mockMutate = jest.fn();
jest.mock("@/features/photos/photos-api", () => {
  const mutation = {
    mutate: (...args: unknown[]) => mockMutate(...args),
    mutateAsync: jest.fn(),
    isPending: false,
  };
  return {
    isVideo: () => false,
    sharePhoto: jest.fn(),
    useProjectPhotosInfinite: () => ({
      data: { pages: [{ items: [PHOTO], total: 1, page: 1, per_page: 50 }] },
      isPending: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: jest.fn(),
      fetchNextPage: jest.fn(),
    }),
    useUploadPhoto: () => mutation,
    useUpdatePhoto: () => mutation,
    useDeletePhoto: () => mutation,
  };
});

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  mockCanWrite = true;
  mockMutate.mockClear();
});

it("groups and labels a capture under the device's calendar day", async () => {
  const day = localDayKey(PHOTO.captured_at);
  expect(day).toBe(
    [
      new Date(PHOTO.captured_at).getFullYear(),
      String(new Date(PHOTO.captured_at).getMonth() + 1).padStart(2, "0"),
      String(new Date(PHOTO.captured_at).getDate()).padStart(2, "0"),
    ].join("-"),
  );
  await renderWithProviders(<ProjectPhotosSection />);

  expect(screen.getByText(formatDate(day))).toBeTruthy();

  await fireEvent.press(screen.getByTestId("photo-ph1"));
  expect(screen.getByText(`${formatDate(day)} · chantier.jpg`)).toBeTruthy();
});

it("lets an editor correct the capture date from the viewer", async () => {
  await renderWithProviders(<ProjectPhotosSection />);

  await fireEvent.press(screen.getByTestId("photo-ph1"));
  await fireEvent.press(screen.getByTestId("photo-date"));
  await fireEvent.press(screen.getByTestId("photo-caption-save"));

  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({
      photoId: "ph1",
      capturedAt: new Date(2026, 8, 20, 12).toISOString(),
    }),
    expect.anything(),
  );
});

it("explains why a member without the edit right cannot add photos", async () => {
  mockCanWrite = false;
  await renderWithProviders(<ProjectPhotosSection />);

  expect(screen.queryByTestId("photos-add")).toBeNull();
  expect(screen.getByTestId("photos-read-only")).toBeTruthy();

  await fireEvent.press(screen.getByTestId("photo-ph1"));
  expect(screen.queryByTestId("photo-date")).toBeNull();
});

it("caps the caption at 500 characters like the web and the API", async () => {
  await renderWithProviders(<ProjectPhotosSection />);

  await fireEvent.press(screen.getByTestId("photo-ph1"));
  expect(screen.getByTestId("photo-caption").props.maxLength).toBe(500);
});
