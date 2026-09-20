import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import {
  containing,
  ok,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

import InventoryScreen from "../../app/(app)/(tabs)/inventory/index";
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
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
}));

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockPush.mockReset();
  mockGet.mockReset();
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
