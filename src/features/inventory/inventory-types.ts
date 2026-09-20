/**
 * Equipment inventory types — the company's tools and machines (drills, screwdrivers, ladders…),
 * where each one is kept and in what state. Field names mirror the backend contract documented
 * in README "Equipment inventory" (`/api/v1/inventory/*`); every row is one batch of identical
 * things in one place and one condition, so a tool that is partly broken or split between the
 * warehouse and a site is several rows.
 */

/** Usable or broken — the two states the crew cares about when picking tools for a day. */
export type InventoryCondition = "working" | "damaged";
export const INVENTORY_CONDITIONS: readonly InventoryCondition[] = [
  "working",
  "damaged",
];

/** Kept at a company warehouse (with its address) or currently on a site (a project). */
export type InventoryLocationType = "warehouse" | "site";
export const INVENTORY_LOCATION_TYPES: readonly InventoryLocationType[] = [
  "warehouse",
  "site",
];

/** Canonical category slugs; order drives the pickers (labels in i18n `inventory.categories.*`). */
export const INVENTORY_CATEGORY_SLUGS = [
  "power_tool",
  "hand_tool",
  "measuring",
  "access",
  "safety",
  "machine",
  "other",
] as const;
export type InventoryCategorySlug = (typeof INVENTORY_CATEGORY_SLUGS)[number];

export function isInventoryCategorySlug(
  value: string,
): value is InventoryCategorySlug {
  return (INVENTORY_CATEGORY_SLUGS as readonly string[]).includes(value);
}

/** A storage place of the company, with the address the crew drives to. */
export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  /** Serial number, brand reference or an internal tag. */
  reference: string | null;
  description: string | null;
  /** Whole units; never negative. */
  quantity: number;
  condition: InventoryCondition;
  location_type: InventoryLocationType;
  /** Set when `location_type` is `warehouse`. */
  warehouse_id: string | null;
  /** Set when `location_type` is `site`. */
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryListResult {
  items: InventoryItem[];
  total: number;
}

export interface CreateWarehousePayload {
  name: string;
  address?: string | null;
}
export type UpdateWarehousePayload = Partial<CreateWarehousePayload>;

export interface CreateInventoryItemPayload {
  name: string;
  category?: string | null;
  reference?: string | null;
  description?: string | null;
  quantity: number;
  condition: InventoryCondition;
  location_type: InventoryLocationType;
  warehouse_id?: string | null;
  project_id?: string | null;
}
export type UpdateInventoryItemPayload = Partial<CreateInventoryItemPayload>;
