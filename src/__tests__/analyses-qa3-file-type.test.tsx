import { fireEvent, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import ProjectAnalysesSection from "../../app/(app)/(tabs)/projects/[id]/analyses";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * QA round 3 (analyses): the picker offered every file and a PDF failed on save with "check the
 * form", naming neither the file nor the reason.
 */
const ANALYSIS = { id: "a1", title: "Rapport", tags: [], size_bytes: 1 };

jest.mock("react-native-webview", () => ({ WebView: () => null }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "p1" }),
  useFocusEffect: () => undefined,
}));
jest.mock("@/features/projects/use-project-can", () => ({
  useProjectCan: () => true,
}));
const mockUseAnalyses = jest.fn();
jest.mock("@/features/analyses/analyses-api", () => ({
  useAnalyses: (...args: unknown[]) => mockUseAnalyses(...args),
  useAnalysisTags: () => ({ data: ["autre"] }),
  useAnalysisContent: () => ({
    data: undefined,
    isPending: false,
    isError: false,
  }),
  useDeleteAnalysis: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateAnalysis: () => ({ mutate: jest.fn(), isPending: false }),
  useUploadAnalysis: () => ({ mutate: jest.fn(), isPending: false }),
}));
const mockPickDocuments = jest.fn();
jest.mock("@/lib/files/pick", () => ({
  ...jest.requireActual("@/lib/files/pick"),
  pickDocuments: (...args: unknown[]) => mockPickDocuments(...args),
}));

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockUseAnalyses.mockReturnValue({
    data: [ANALYSIS],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
});

it("offers HTML files only and names a refused one under the file button", async () => {
  mockPickDocuments.mockResolvedValue({
    status: "picked",
    files: [
      {
        uri: "file:///r",
        name: "rapport.pdf",
        mimeType: "application/pdf",
        size: 10,
      },
    ],
  });
  await renderWithProviders(<ProjectAnalysesSection />);
  await fireEvent.press(screen.getByTestId("analyses-create"));
  await fireEvent.press(screen.getByTestId("analysis-pick-file"));

  expect(mockPickDocuments.mock.calls[0][1]).not.toContain("*/*");
  expect(
    (await screen.findByTestId("analysis-file-error")).props.children,
  ).toBe("rapport.pdf: .pdf files are not accepted (accepted: .html .htm).");
});
