import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import {
  containing,
  ok,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

import InventoryScreen from "../../app/(app)/(tabs)/inventory/index";
import WarehousesScreen from "../../app/(app)/(tabs)/inventory/warehouses";
import { MenuSheet } from "@/components/shell/menu-sheet";
import type {
  InventoryItem,
  Warehouse,
} from "@/features/inventory/inventory-types";

// The equipment inventory: rows grouped by where they are, a damaged tool flagged in red, the
// filters narrowing the list, and the Menu row that leads there with its unit / damaged counts.

const COMPANY_ID = "c1";
const PROJECT = {
  id: "p1",
  name: "Villa Thảo Điền",
  address: "Quận 2, TP.HCM",
  company_id: COMPANY_ID,
  my_permissions: ["project:read", "project:update", "project:manage_labor"],
};

const WAREHOUSE: Warehouse = {
  id: "w1",
  company_id: COMPANY_ID,
  name: "Kho Bình Thạnh",
  address: "12 Nguyễn Hữu Cảnh",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const ITEMS: InventoryItem[] = [
  {
    id: "drill",
    company_id: COMPANY_ID,
    name: "Máy khoan Bosch",
    category: "power_tool",
    reference: "SN-778",
    description: null,
    quantity: 3,
    condition: "working",
    location_type: "warehouse",
    warehouse_id: "w1",
    project_id: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "screwdriver",
    company_id: COMPANY_ID,
    name: "Visseuse Makita",
    category: "power_tool",
    reference: null,
    description: null,
    quantity: 1,
    condition: "damaged",
    location_type: "site",
    warehouse_id: null,
    project_id: "p1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
];

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, navigate: jest.fn(), back: jest.fn() }),
  useFocusEffect: () => undefined,
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "manager@example.com",
      permissions: ["project:read", "project:update", "project:manage_labor"],
      companies: [{ id: "c1", legal_name: "Folio QA", role: "manager" }],
    },
  }),
}));

jest.mock("@/components/shell/shell-context", () => ({
  ...jest.requireActual("@/components/shell/shell-context"),
  useShell: () => ({
    sheet: "menu",
    closeSheet: jest.fn(),
    openSheet: jest.fn(),
    toggleSheet: jest.fn(),
    tabBarHeight: 0,
    setTabBarHeight: jest.fn(),
  }),
}));

jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({
    projectId: "p1",
    project: PROJECT,
    projects: [PROJECT],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    select: jest.fn(),
  }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PATCH: (...args: unknown[]) => mockPatch(...args),
  },
}));

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockPush.mockReset();
  mockGet.mockReset();
  mockPost.mockReset();
  mockPatch.mockReset();
  mockPost.mockImplementation(async () => ok({ id: "new" }));
  mockPatch.mockImplementation(async () => ok({ id: "drill" }));
  mockGet.mockImplementation(async (path: string) => {
    switch (path) {
      case "/api/v1/projects":
        return ok({ projects: [PROJECT], total: 1 });
      case "/api/v1/companies":
        return ok({
          items: [
            {
              company: { id: COMPANY_ID, legal_name: "Folio QA" },
              access: {
                is_primary: true,
                attached_at: "2026-01-01",
                role: "manager",
              },
            },
          ],
        });
      case "/api/v1/inventory/items":
        return ok({ items: ITEMS, total: ITEMS.length });
      case "/api/v1/inventory/warehouses":
        return ok({ items: [WAREHOUSE] });
      case "/api/v1/bibliotheque/products":
        return ok({ items: [], total: 0, page: 1 });
      case "/api/v1/bibliotheque/suppliers":
        return ok({ items: [] });
      default:
        return ok({});
    }
  });
});

describe("inventory screen", () => {
  it("asks for the company's items and warehouses", async () => {
    await renderWithProviders(<InventoryScreen />);
    await screen.findByTestId("inventory-item-drill");

    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/inventory/items",
      expect.objectContaining({
        params: { query: { company_id: COMPANY_ID } },
      }),
    );
    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/inventory/warehouses",
      expect.objectContaining({
        params: { query: { company_id: COMPANY_ID } },
      }),
    );
  });

  it("groups rows by place with the warehouse address and the site name", async () => {
    await renderWithProviders(<InventoryScreen />);
    await screen.findByTestId("inventory-item-drill");

    expect(
      screen.getByTestId("inventory-group-warehouse:w1"),
    ).toHaveTextContent(/Kho Bình Thạnh/);
    expect(
      screen.getByTestId("inventory-group-warehouse:w1"),
    ).toHaveTextContent(/12 Nguyễn Hữu Cảnh/);
    expect(screen.getByTestId("inventory-group-site:p1")).toHaveTextContent(
      /Villa Thảo Điền/,
    );
  });

  it("sums units on the tiles and flags the damaged row", async () => {
    await renderWithProviders(<InventoryScreen />);
    await screen.findByTestId("inventory-item-drill");

    expect(screen.getByTestId("inventory-summary-total")).toHaveTextContent(
      "4",
    );
    expect(screen.getByTestId("inventory-summary-working")).toHaveTextContent(
      "3",
    );
    expect(screen.getByTestId("inventory-summary-damaged")).toHaveTextContent(
      "1",
    );
    expect(screen.getByTestId("inventory-summary-warehouse")).toHaveTextContent(
      "3",
    );
    expect(screen.getByTestId("inventory-summary-site")).toHaveTextContent("1");
    expect(
      screen.getByTestId("inventory-item-screwdriver-condition"),
    ).toHaveTextContent(i18n.t("inventory.condition.damaged"));
    expect(
      screen.getByTestId("inventory-item-drill-condition"),
    ).toHaveTextContent(i18n.t("inventory.condition.working"));
    expect(
      screen.getByTestId("inventory-item-drill-quantity"),
    ).toHaveTextContent("3");
  });

  it("narrows the list by condition and by place", async () => {
    await renderWithProviders(<InventoryScreen />);
    await screen.findByTestId("inventory-item-drill");

    await fireEvent.press(
      screen.getByTestId("inventory-filter-condition-damaged"),
    );
    expect(screen.queryByTestId("inventory-item-drill")).toBeNull();
    expect(screen.getByTestId("inventory-item-screwdriver")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("inventory-filter-condition-all"));
    await fireEvent.press(
      screen.getByTestId("inventory-filter-location-warehouse"),
    );
    expect(screen.getByTestId("inventory-item-drill")).toBeTruthy();
    expect(screen.queryByTestId("inventory-item-screwdriver")).toBeNull();
  });

  it("finds a row by its reference", async () => {
    await renderWithProviders(<InventoryScreen />);
    await screen.findByTestId("inventory-item-drill");

    await fireEvent.changeText(
      screen.getByTestId("inventory-search"),
      "sn-778",
    );
    expect(screen.getByTestId("inventory-item-drill")).toBeTruthy();
    expect(screen.queryByTestId("inventory-item-screwdriver")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("inventory-search"), "zzz");
    expect(screen.getByText(i18n.t("inventory.noResults"))).toBeTruthy();
  });

  it("opens the warehouses screen from its row", async () => {
    await renderWithProviders(<InventoryScreen />);
    await screen.findByTestId("inventory-item-drill");

    await fireEvent.press(screen.getByTestId("inventory-warehouses"));
    expect(mockPush).toHaveBeenCalledWith("/inventory/warehouses");
  });
});

describe("inventory form", () => {
  it("presents the sheet once its fresh instance is mounted, then posts a new row on this company's site", async () => {
    const present = jest.spyOn(BottomSheetModal.prototype, "present");
    await renderWithProviders(<InventoryScreen />);
    await screen.findByTestId("inventory-item-drill");
    expect(present).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("inventory-add"));
    await waitFor(() => expect(present).toHaveBeenCalledTimes(1));
    expect(screen.getByText(i18n.t("inventory.createTitle"))).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("inventory-name"), "Máy cắt");
    await fireEvent.changeText(screen.getByTestId("inventory-quantity"), "2");
    await fireEvent.press(screen.getByTestId("inventory-location-type-site"));
    await fireEvent.press(screen.getByTestId("inventory-submit"));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/inventory/items",
        expect.objectContaining({
          body: {
            company_id: COMPANY_ID,
            name: "Máy cắt",
            category: null,
            reference: null,
            description: null,
            quantity: 2,
            condition: "working",
            location_type: "site",
            warehouse_id: null,
            project_id: "p1",
          },
        }),
      ),
    );
    present.mockRestore();
  });

  it("rejects a blank name and a non-integer quantity without calling the API", async () => {
    await renderWithProviders(<InventoryScreen />);
    await screen.findByTestId("inventory-item-drill");

    await fireEvent.press(screen.getByTestId("inventory-add"));
    await fireEvent.changeText(screen.getByTestId("inventory-quantity"), "1.5");
    await fireEvent.press(screen.getByTestId("inventory-submit"));

    expect(
      screen.getByText(i18n.t("inventory.validation.nameRequired")),
    ).toBeTruthy();
    expect(
      screen.getByText(i18n.t("inventory.validation.quantityInvalid")),
    ).toBeTruthy();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("patches only what changed when a row is edited", async () => {
    await renderWithProviders(<InventoryScreen />);
    await fireEvent.press(await screen.findByTestId("inventory-item-drill"));
    expect(screen.getByText(i18n.t("inventory.editTitle"))).toBeTruthy();

    await fireEvent.press(screen.getByTestId("inventory-condition-damaged"));
    await fireEvent.press(screen.getByTestId("inventory-submit"));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        "/api/v1/inventory/items/{item_id}",
        expect.objectContaining({
          params: { path: { item_id: "drill" } },
          body: { condition: "damaged" },
        }),
      ),
    );
  });
});

describe("warehouses screen", () => {
  it("lists each warehouse with its address and the units it holds", async () => {
    await renderWithProviders(<WarehousesScreen />);

    const row = await screen.findByTestId("warehouse-w1");
    expect(row).toHaveTextContent(containing("Kho Bình Thạnh"));
    expect(row).toHaveTextContent(containing("12 Nguyễn Hữu Cảnh"));
    expect(screen.getByTestId("warehouse-w1-units")).toHaveTextContent(
      i18n.t("inventory.units", { count: 3 }),
    );
  });

  it("warns how many units a warehouse still holds before deleting it", async () => {
    await renderWithProviders(<WarehousesScreen />);
    await screen.findByTestId("warehouse-w1");

    await fireEvent.press(screen.getByTestId("warehouse-delete-w1"));
    expect(screen.getByTestId("confirm-dialog")).toHaveTextContent(
      containing(i18n.t("inventory.warehouses.deleteBlocked", { count: 3 })),
    );
  });

  it("shows an error state with a retry when the warehouses cannot be loaded", async () => {
    mockGet.mockImplementation(async (path: string) => {
      if (path === "/api/v1/inventory/warehouses")
        return {
          error: { error: "ServerError", message: "boom" },
          response: { status: 500, statusText: "Server Error" },
        };
      if (path === "/api/v1/companies")
        return ok({
          items: [
            {
              company: { id: COMPANY_ID, legal_name: "Folio QA" },
              access: { is_primary: true, attached_at: "x", role: "manager" },
            },
          ],
        });
      return ok({ items: [] });
    });
    await renderWithProviders(<WarehousesScreen />);

    expect(await screen.findByTestId("error-state")).toHaveTextContent(
      containing(i18n.t("inventory.warehouses.loadError")),
    );
  });
});

describe("menu sheet", () => {
  it("lists the inventory with its unit and damaged counts", async () => {
    await renderWithProviders(<MenuSheet />);

    const row = await screen.findByTestId("menu-inventory");
    expect(row).toHaveTextContent(containing(i18n.t("inventory.title")));
    await waitFor(() =>
      expect(row).toHaveTextContent(
        containing(i18n.t("shell.inventorySub", { units: 4, damaged: 1 })),
      ),
    );

    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith("/inventory");
  });
});
