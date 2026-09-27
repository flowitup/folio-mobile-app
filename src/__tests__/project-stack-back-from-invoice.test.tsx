import { act, screen } from "@testing-library/react-native";
import { Tabs, router } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { Text } from "react-native";

import "@/i18n";
import ProjectLayout from "../../app/(app)/(tabs)/projects/[id]/_layout";
import { TABS_BACK_BEHAVIOR } from "@/components/shell/tabs-config";

/**
 * The Menu sections and the invoice screens share the `projects/[id]` stack. An invoice opened
 * from Expenses after a visit to Menu > Members used to be pushed over that stale Members
 * screen, so Back from the invoice landed on Members instead of Expenses.
 */
const page = (name: string) =>
  function Page() {
    return <Text testID="page">{name}</Text>;
  };

async function renderShell() {
  await renderRouter(
    {
      "(tabs)/_layout": () => (
        <Tabs backBehavior={TABS_BACK_BEHAVIOR}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="expenses" />
          <Tabs.Screen name="projects/[id]" options={{ href: null }} />
        </Tabs>
      ),
      "(tabs)/index": page("overview"),
      "(tabs)/expenses": page("expenses"),
      "(tabs)/projects/[id]/_layout": ProjectLayout,
      "(tabs)/projects/[id]/members": page("members"),
      "(tabs)/projects/[id]/salaries": page("salaries"),
      "(tabs)/projects/[id]/invoices/[invoiceId]/index": page("invoice"),
    },
    { initialUrl: "/expenses" },
  );
}

const current = () => screen.getByTestId("page");

describe("project section stack", () => {
  it("returns from an invoice opened in Expenses to Expenses, not to a stale section", async () => {
    await renderShell();
    await act(() => router.push("/projects/p1/members"));
    expect(current()).toHaveTextContent("members");
    await act(() => router.navigate("/expenses"));
    expect(current()).toHaveTextContent("expenses");

    await act(() => router.push("/projects/p1/invoices/i1"));
    expect(current()).toHaveTextContent("invoice");
    await act(() => router.back());
    expect(current()).toHaveTextContent("expenses");
  });

  it("keeps the section under an invoice opened from that section", async () => {
    await renderShell();
    await act(() => router.push("/projects/p1/salaries"));
    await act(() => router.push("/projects/p1/invoices/i1"));
    expect(current()).toHaveTextContent("invoice");
    await act(() => router.back());
    expect(current()).toHaveTextContent("salaries");
  });
});
