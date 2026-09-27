import { act, fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import {
  ShellProvider,
  requestShellSheet,
  useShell,
} from "@/components/shell/shell-context";

let mockPathname = "/";
jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
}));

function Probe() {
  const { sheet, openSheet } = useShell();
  return (
    <Pressable testID="open-help" onPress={() => openSheet("help")}>
      <Text testID="sheet">{sheet ?? "none"}</Text>
    </Pressable>
  );
}
const tree = () => (
  <ShellProvider>
    <Probe />
  </ShellProvider>
);

beforeEach(() => {
  mockPathname = "/";
});

/**
 * The shell sheets (help, menu, switcher…) are drawn over every tab scene: a screen opened by
 * a deep link must not come up under a sheet left open.
 */
describe("shell sheets on navigation", () => {
  it("closes the open sheet when the route changes", async () => {
    const view = await render(tree());
    await fireEvent.press(view.getByTestId("open-help"));
    expect(view.getByTestId("sheet")).toHaveTextContent("help");

    // Re-renders on the same route keep it.
    await view.rerender(tree());
    expect(view.getByTestId("sheet")).toHaveTextContent("help");

    mockPathname = "/projects/p1/invoices/i1";
    await view.rerender(tree());
    expect(view.getByTestId("sheet")).toHaveTextContent("none");
  });

  it("keeps a sheet a tapped push asked for across the navigation that follows", async () => {
    const view = await render(tree());
    await act(async () => requestShellSheet("notifications"));

    mockPathname = "/(app)/(tabs)";
    await view.rerender(tree());
    expect(view.getByTestId("sheet")).toHaveTextContent("notifications");

    mockPathname = "/projects/p1/notes";
    await view.rerender(tree());
    expect(view.getByTestId("sheet")).toHaveTextContent("none");
  });
});
