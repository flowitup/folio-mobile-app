import type {
  InventoryItem,
  Warehouse,
} from "@/features/inventory/inventory-types";
import {
  filterInventoryItems,
  groupInventoryByLocation,
  parseQuantity,
  summarizeInventory,
} from "@/lib/inventory/inventory-helpers";

const WAREHOUSE: Warehouse = {
  id: "w1",
  company_id: "c1",
  name: "Kho Bình Thạnh",
  address: "12 Nguyễn Hữu Cảnh, Bình Thạnh",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function item(
  overrides: Partial<InventoryItem> & { id: string },
): InventoryItem {
  return {
    company_id: "c1",
    name: "Máy khoan Bosch",
    category: "power_tool",
    reference: null,
    description: null,
    quantity: 1,
    condition: "working",
    location_type: "warehouse",
    warehouse_id: "w1",
    project_id: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const ITEMS: InventoryItem[] = [
  item({ id: "a", quantity: 3 }),
  item({ id: "b", quantity: 1, condition: "damaged", reference: "SN-778" }),
  item({
    id: "c",
    name: "Visseuse Makita",
    quantity: 2,
    location_type: "site",
    warehouse_id: null,
    project_id: "p1",
  }),
  item({
    id: "d",
    name: "Thang nhôm",
    category: "access",
    quantity: 1,
    location_type: "site",
    warehouse_id: null,
    project_id: "p-gone",
    description: "3 m",
  }),
];

describe("filterInventoryItems", () => {
  it("narrows by location, condition and text at once", () => {
    const ids = (filters: Parameters<typeof filterInventoryItems>[1]) =>
      filterInventoryItems(ITEMS, filters).map((row) => row.id);
    expect(ids({ location: "all", condition: "all", q: "" })).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(ids({ location: "warehouse", condition: "all", q: "" })).toEqual([
      "a",
      "b",
    ]);
    expect(ids({ location: "all", condition: "damaged", q: "" })).toEqual([
      "b",
    ]);
    expect(ids({ location: "site", condition: "working", q: "" })).toEqual([
      "c",
      "d",
    ]);
  });

  it("searches name, reference and description without caring about case", () => {
    const ids = (q: string) =>
      filterInventoryItems(ITEMS, { location: "all", condition: "all", q }).map(
        (row) => row.id,
      );
    expect(ids("  makita ")).toEqual(["c"]);
    expect(ids("sn-778")).toEqual(["b"]);
    expect(ids("3 m")).toEqual(["d"]);
    expect(ids("nothing")).toEqual([]);
  });
});

describe("summarizeInventory", () => {
  it("counts units, not rows, and splits them by condition and place", () => {
    expect(summarizeInventory(ITEMS)).toEqual({
      entries: 4,
      quantity: 7,
      working: 6,
      damaged: 1,
      inWarehouse: 4,
      onSite: 3,
    });
  });

  it("is all zeros on an empty inventory", () => {
    expect(summarizeInventory([])).toEqual({
      entries: 0,
      quantity: 0,
      working: 0,
      damaged: 0,
      inWarehouse: 0,
      onSite: 0,
    });
  });
});

describe("groupInventoryByLocation", () => {
  it("puts warehouses first, then sites, and dangling references last without a title", () => {
    const groups = groupInventoryByLocation(ITEMS, {
      warehouses: [WAREHOUSE],
      sites: [{ id: "p1", name: "Villa Thảo Điền", address: "Quận 2" }],
    });
    expect(groups.map((group) => group.key)).toEqual([
      "warehouse:w1",
      "site:p1",
      "unknown:site",
    ]);
    expect(groups[0]).toMatchObject({
      kind: "warehouse",
      title: "Kho Bình Thạnh",
      subtitle: "12 Nguyễn Hữu Cảnh, Bình Thạnh",
      quantity: 4,
    });
    expect(groups[1]).toMatchObject({
      kind: "site",
      title: "Villa Thảo Điền",
      subtitle: "Quận 2",
      quantity: 2,
    });
    expect(groups[2]).toMatchObject({
      kind: "site",
      title: null,
      subtitle: null,
      quantity: 1,
    });
  });

  it("sorts rows by name inside a group and groups by name", () => {
    const groups = groupInventoryByLocation(
      [
        item({ id: "x", name: "Zed", warehouse_id: "w2" }),
        item({ id: "y", name: "Alpha", warehouse_id: "w2" }),
        item({ id: "z", name: "Mid", warehouse_id: "w1" }),
      ],
      {
        warehouses: [WAREHOUSE, { ...WAREHOUSE, id: "w2", name: "Kho An Phú" }],
        sites: [],
      },
    );
    expect(groups.map((group) => group.title)).toEqual([
      "Kho An Phú",
      "Kho Bình Thạnh",
    ]);
    expect(groups[0].items.map((row) => row.name)).toEqual(["Alpha", "Zed"]);
  });
});

describe("parseQuantity", () => {
  it("accepts whole non-negative numbers only", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity(" 0 ")).toBe(0);
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("1.5")).toBeNull();
    expect(parseQuantity("-2")).toBeNull();
    expect(parseQuantity("+2")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
  });
});
