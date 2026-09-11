/**
 * The help sheet is the only way into the workflow guide, so what matters is the path through
 * it: the index lists the topics, a topic opens its own steps, and back returns to the index.
 * Assertions read from the real catalogue so the test stays true as the documentation grows.
 * `fireEvent` is awaited throughout: on React Native Testing Library 14 it resolves
 * asynchronously, and without the await the shell state update never lands.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";
import { Pressable, Text } from "react-native";

import { HelpSheet } from "@/components/shell/help-sheet";
import { ShellProvider, useShell } from "@/components/shell/shell-context";
import { helpCatalogueEn } from "@/content/help/en";
import i18n from "@/i18n";

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
  it("stays closed until the shell asks for it", async () => {
    await renderHelp();
    expect(screen.queryByTestId("help-sheet")).toBeNull();
  });

  it("lists every documented workflow once opened", async () => {
    await renderHelp();

    await fireEvent.press(screen.getByTestId("open-help"));

    for (const topic of helpCatalogueEn) {
      expect(screen.getByTestId(`help-topic-${topic.id}`)).toBeTruthy();
    }
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
});
