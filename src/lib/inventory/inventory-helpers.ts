import type {
  InventoryCondition,
  InventoryItem,
  InventoryLocationType,
  Warehouse,
} from "@/features/inventory/inventory-types";

/** What the list screen's controls narrow the inventory by. `all` leaves a dimension open. */
export type InventoryFilters = {
  location: InventoryLocationType | "all";
  condition: InventoryCondition | "all";
  q: string;
};

/** Name, reference and description are searched, case-insensitively, on trimmed input. */
export function filterInventoryItems(
  items: readonly InventoryItem[],
  filters: InventoryFilters,
): InventoryItem[] {
  const needle = filters.q.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.location !== "all" && item.location_type !== filters.location)
      return false;
    if (filters.condition !== "all" && item.condition !== filters.condition)
      return false;
    if (
      needle &&
      !`${item.name} ${item.reference ?? ""} ${item.description ?? ""}`
        .toLowerCase()
        .includes(needle)
    )
      return false;
    return true;
  });
}

export type InventorySummary = {
  /** Number of rows. */
  entries: number;
  /** Units, all conditions. */
  quantity: number;
  working: number;
  damaged: number;
  /** Units kept at a warehouse. */
  inWarehouse: number;
  /** Units out on a site. */
  onSite: number;
};

/** Unit totals for the summary tiles; a row counts its `quantity`, never 1. */
export function summarizeInventory(
  items: readonly InventoryItem[],
): InventorySummary {
  const summary: InventorySummary = {
    entries: items.length,
    quantity: 0,
    working: 0,
    damaged: 0,
    inWarehouse: 0,
    onSite: 0,
  };
  for (const item of items) {
    const quantity = Math.max(0, Math.floor(item.quantity));
    summary.quantity += quantity;
    if (item.condition === "damaged") summary.damaged += quantity;
    else summary.working += quantity;
    if (item.location_type === "warehouse") summary.inWarehouse += quantity;
    else summary.onSite += quantity;
  }
  return summary;
}

/** The little the grouping needs to know about a project: its id and how to name it. */
export type SiteRef = { id: string; name: string; address?: string | null };

export type InventoryLocationGroup = {
  /** Stable key: `warehouse:<id>`, `site:<id>` or `unknown:<type>` for a dangling reference. */
  key: string;
  kind: InventoryLocationType;
  title: string | null;
  /** The warehouse address or the site address, when known. */
  subtitle: string | null;
  items: InventoryItem[];
  quantity: number;
};

/**
 * Rows grouped by where they are: warehouses first (alphabetically), then sites, and any row
 * pointing at a warehouse or project the client no longer knows last. `title` is null for
 * those, so the screen can label them "unknown location" in the user's language rather than
 * showing an id.
 */
export function groupInventoryByLocation(
  items: readonly InventoryItem[],
  refs: { warehouses: readonly Warehouse[]; sites: readonly SiteRef[] },
): InventoryLocationGroup[] {
  const warehouses = new Map(refs.warehouses.map((w) => [w.id, w]));
  const sites = new Map(refs.sites.map((s) => [s.id, s]));
  const groups = new Map<string, InventoryLocationGroup>();

  for (const item of items) {
    let key: string;
    let title: string | null = null;
    let subtitle: string | null = null;
    if (item.location_type === "warehouse") {
      const warehouse = item.warehouse_id
        ? warehouses.get(item.warehouse_id)
        : undefined;
      key = warehouse ? `warehouse:${warehouse.id}` : "unknown:warehouse";
      title = warehouse?.name ?? null;
      subtitle = warehouse?.address ?? null;
    } else {
      const site = item.project_id ? sites.get(item.project_id) : undefined;
      key = site ? `site:${site.id}` : "unknown:site";
      title = site?.name ?? null;
      subtitle = site?.address ?? null;
    }
    const group = groups.get(key) ?? {
      key,
      kind: item.location_type,
      title,
      subtitle,
      items: [],
      quantity: 0,
    };
    group.items.push(item);
    group.quantity += Math.max(0, Math.floor(item.quantity));
    groups.set(key, group);
  }

  const rank = (group: InventoryLocationGroup) =>
    group.title === null ? 2 : group.kind === "warehouse" ? 0 : 1;
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort(
      (a, b) =>
        rank(a) - rank(b) || (a.title ?? "").localeCompare(b.title ?? ""),
    );
}

/**
 * The quantity field is typed by hand: accept only a whole, non-negative number and reject
 * everything else (blank, decimals, signs, letters) so a typo never lands as 0 units.
 */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}
