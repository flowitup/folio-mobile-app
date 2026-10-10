import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { InventoryItemFormSheet } from "@/features/inventory/inventory-item-form-sheet";
import type { InventoryItem } from "@/features/inventory/inventory-types";

// Deleting a project leaves its site rows with no project. Editing such a row must not
// silently move it to a default site: the form asks where it is instead.

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const SITES = [
  { id: "p1", name: "Villa Thảo Điền" },
  { id: "p2", name: "Extension Meaux" },
];

function siteItem(projectId: string | null): InventoryItem {
  return {
    id: "ladder",
    company_id: "c1",
    name: "Thang nhôm",
    category: null,
    reference: null,
    description: null,
    quantity: 1,
    condition: "working",
    location_type: "site",
    warehouse_id: null,
    project_id: projectId,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

const onSubmit = jest.fn();

async function renderForm(initial: InventoryItem) {
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <InventoryItemFormSheet
        warehouses={[]}
        sites={SITES}
        initial={initial}
        defaultProjectId="p1"
        submitting={false}
        onSubmit={onSubmit}
      />
    </SafeAreaProvider>,
  );
}

beforeEach(() => onSubmit.mockReset());

describe("InventoryItemFormSheet — site row of a deleted project", () => {
  it("asks for a site instead of moving the row to the default one", async () => {
    await renderForm(siteItem(null));
    await fireEvent.changeText(
      screen.getByTestId("inventory-name"),
      "Thang mới",
    );
    await fireEvent.press(screen.getByTestId("inventory-submit"));

    expect(
      screen.getByText(i18n.t("inventory.validation.siteRequired")),
    ).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renames a row on its site without sending its location", async () => {
    await renderForm(siteItem("p2"));
    await fireEvent.changeText(
      screen.getByTestId("inventory-name"),
      "Thang mới",
    );
    await fireEvent.press(screen.getByTestId("inventory-submit"));

    expect(onSubmit).toHaveBeenCalledWith({ name: "Thang mới" });
  });
});
