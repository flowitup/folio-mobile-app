import { fireEvent, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { formatDate } from "@/lib/format/date";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

import ProjectPhotosSection from "../../app/(app)/(tabs)/projects/[id]/photos";

// The photos screen files a capture under its Europe/Paris day, as the web gallery does, and caps
// the caption at the 500 characters the web and the API accept.

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "p1" }),
}));

jest.mock("@/lib/query/use-refetch-on-focus", () => ({
  useRefetchOnFocus: () => undefined,
}));

jest.mock("@/features/projects/use-project-can", () => ({
  useProjectCan: () => true,
}));

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

jest.mock("@/features/photos/photos-api", () => {
  const mutation = {
    mutate: jest.fn(),
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

it("groups and labels a late-evening UTC capture under its Paris day", async () => {
  await renderWithProviders(<ProjectPhotosSection />);

  expect(screen.getByText(formatDate("2026-10-02"))).toBeTruthy();
  expect(screen.queryByText(formatDate("2026-10-01"))).toBeNull();

  await fireEvent.press(screen.getByTestId("photo-ph1"));
  expect(
    screen.getByText(`${formatDate("2026-10-02")} · chantier.jpg`),
  ).toBeTruthy();
});

it("caps the caption at 500 characters like the web and the API", async () => {
  await renderWithProviders(<ProjectPhotosSection />);

  await fireEvent.press(screen.getByTestId("photo-ph1"));
  expect(screen.getByTestId("photo-caption").props.maxLength).toBe(500);
});
