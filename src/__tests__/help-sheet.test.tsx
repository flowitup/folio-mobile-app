/**
 * The help sheet is the only way into the workflow guide, so what matters is the path through
 * it: the index lists the topics, a topic opens its own steps, and back returns to the index.
 * Assertions read from the real catalogue so the test stays true as the documentation grows.
 *
 * `fireEvent` is awaited throughout: on React Native Testing Library 14 it resolves
 * asynchronously, and without the await the shell state update never lands.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";
import { Pressable, Text } from "react-native";

import { HelpSheet } from "@/components/shell/help-sheet";
import { ShellProvider, useShell } from "@/components/shell/shell-context";
import { helpCatalogueEn, helpChromeEn } from "@/content/help/en";
import { helpCatalogueFr, helpChromeFr } from "@/content/help/fr";
import i18n from "@/i18n";

// The sheet narrows the catalogue to what this reader's navigation shows; these mocks decide who
// is reading. Default is the widest reader, and one test switches to the worker shell.
let mockWorkerMode = false;

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      permissions: [],
      companies: [{ id: "c1", role: "admin" }],
    },
  }),
}));
jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({ projectId: "p1", project: { id: "p1" } }),
}));
jest.mock("@/features/projects/use-project-can", () => ({
  useProjectCan: () => true,
}));
jest.mock("@/features/companies/companies-api", () => ({
  useBillingAccess: () => ({ allowed: true }),
}));
jest.mock("@/features/labor/use-worker-mode", () => ({
  useWorkerMode: () => ({ workerMode: mockWorkerMode }),
}));

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function OpenHelp() {
  const { openSheet } = useShell();
  return (
    <Pressable testID="open-help" onPress={() => openSheet("help")}>
      <Text>open</Text>
    </Pressable>
  );
}

async function renderHelp() {
  await i18n.changeLanguage("en");
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ShellProvider>
        <OpenHelp />
        <HelpSheet />
      </ShellProvider>
    </SafeAreaProvider>,
  );
}

const [firstTopic] = helpCatalogueEn;

describe("HelpSheet", () => {
  beforeEach(() => {
    mockWorkerMode = false;
  });

  it("stays closed until the shell asks for it", async () => {
    await renderHelp();
    expect(screen.queryByTestId("help-sheet")).toBeNull();
  });

  it("lists the workflows this reader can reach", async () => {
    await renderHelp();

    await fireEvent.press(screen.getByTestId("open-help"));

    for (const topic of helpCatalogueEn.filter((t) => !t.workerMode)) {
      expect(screen.getByTestId(`help-topic-${topic.id}`)).toBeTruthy();
    }
    // A manager is not offered the worker-only screens.
    expect(screen.queryByTestId("help-topic-worker-salary")).toBeNull();
  });

  it("drills into a topic and comes back to the index", async () => {
    await renderHelp();

    await fireEvent.press(screen.getByTestId("open-help"));
    await fireEvent.press(screen.getByTestId(`help-topic-${firstTopic.id}`));

    expect(screen.getByTestId("help-topic-detail")).toBeTruthy();
    expect(screen.getByText(firstTopic.steps[0])).toBeTruthy();
    expect(screen.getByText(firstTopic.whoCanDoIt)).toBeTruthy();
    expect(screen.queryByTestId(`help-topic-${firstTopic.id}`)).toBeNull();

    await fireEvent.press(screen.getByTestId("help-back"));

    expect(screen.getByTestId(`help-topic-${firstTopic.id}`)).toBeTruthy();
    expect(screen.queryByTestId("help-topic-detail")).toBeNull();
  });

  it("gives a worker their own screens and none of the Menu ones", async () => {
    mockWorkerMode = true;
    await renderHelp();

    await fireEvent.press(screen.getByTestId("open-help"));

    expect(screen.getByTestId("help-topic-worker-attendance")).toBeTruthy();
    expect(screen.getByTestId("help-topic-worker-salary")).toBeTruthy();
    // Worker mode drops the Menu entirely, so these areas are not theirs to open.
    expect(screen.queryByTestId("help-topic-billing")).toBeNull();
    expect(screen.queryByTestId("help-topic-library")).toBeNull();
    expect(screen.queryByTestId("help-topic-documents")).toBeNull();
  });

  it("reads the guide in another language without touching the app's", async () => {
    await renderHelp();
    await fireEvent.press(screen.getByTestId("open-help"));

    // Starts in the app's language.
    expect(screen.getByText(helpChromeEn.title)).toBeTruthy();

    await fireEvent.press(screen.getByTestId("help-language-fr"));

    // Panel labels and topic titles both follow the choice.
    expect(screen.getByText(helpChromeFr.title)).toBeTruthy();
    expect(screen.getByText(helpCatalogueFr[0].title)).toBeTruthy();
    expect(screen.queryByText(helpCatalogueEn[0].title)).toBeNull();
    // The app itself is untouched.
    expect(i18n.language).toBe("en");
  });

  it("keeps you on the same topic when the guide language changes", async () => {
    await renderHelp();
    await fireEvent.press(screen.getByTestId("open-help"));
    await fireEvent.press(screen.getByTestId("help-topic-planning"));

    const english = helpCatalogueEn.find((topic) => topic.id === "planning")!;
    expect(screen.getByText(english.steps[0])).toBeTruthy();

    await fireEvent.press(screen.getByTestId("help-language-fr"));

    const french = helpCatalogueFr.find((topic) => topic.id === "planning")!;
    expect(screen.getByText(french.steps[0])).toBeTruthy();
  });
});
