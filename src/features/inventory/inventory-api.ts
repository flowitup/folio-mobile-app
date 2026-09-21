import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type {
  CreateInventoryItemPayload,
  CreateWarehousePayload,
  InventoryItem,
  InventoryListResult,
  UpdateInventoryItemPayload,
  UpdateWarehousePayload,
  Warehouse,
} from "./inventory-types";

/**
 * Company-scoped like the product library: `company_id` travels as a query parameter on reads
 * and in the body on creates. The whole inventory of a company is fetched at once (a crew's
 * tool list stays in the hundreds) and the screens filter it locally, so the pickers answer
 * without a round trip. Requests are typed by the generated schema; responses are not (the
 * spec leaves them untyped, like the library's), so `unwrapAs` asserts their shape.
 */
export const inventoryKeys = {
  all: ["inventory"] as const,
  warehouses: (companyId: string) =>
    ["inventory", "warehouses", companyId] as const,
  items: (companyId: string) => ["inventory", "items", companyId] as const,
};

const base = "/api/v1/inventory" as const;

type QueryOptions = {
  /** Extra gate on top of "a company is known" (e.g. only while the Menu is open). */
  enabled?: boolean;
};

export function useWarehouses(
  companyId: string | null,
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: inventoryKeys.warehouses(companyId ?? ""),
    enabled: Boolean(companyId) && options.enabled !== false,
    queryFn: async () =>
      unwrapAs<{ items: Warehouse[] }>(
        await api.GET(`${base}/warehouses`, {
          params: { query: { company_id: companyId! } },
        }),
      ).items,
  });
}

export function useCreateWarehouse(companyId: string | null) {
  const { t } = useTranslation();
  return useApiMutation<CreateWarehousePayload, Warehouse>({
    mutationFn: async (body) =>
      unwrapAs<Warehouse>(
        await api.POST(`${base}/warehouses`, {
          body: { company_id: companyId!, ...body } as never,
        }),
      ),
    invalidates: [inventoryKeys.all],
    successMessage: t("inventory.toast.warehouseCreated"),
  });
}

export function useUpdateWarehouse() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string } & UpdateWarehousePayload, Warehouse>({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<Warehouse>(
        await api.PATCH(`${base}/warehouses/{warehouse_id}`, {
          params: { path: { warehouse_id: id } },
          body: body as never,
        }),
      ),
    invalidates: [inventoryKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useDeleteWarehouse() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE(`${base}/warehouses/{warehouse_id}`, {
          params: { path: { warehouse_id: id } },
        }),
      ),
    invalidates: [inventoryKeys.all],
    successMessage: t("inventory.toast.warehouseDeleted"),
  });
}

/**
 * No `placeholderData` here, unlike the paged library list: the key changes with the company,
 * and keeping the previous company's rows on screen while the next one loads would show its
 * totals under the wrong warehouses.
 */
export function useInventoryItems(
  companyId: string | null,
  options: QueryOptions = {},
) {
  return useQuery({
    queryKey: inventoryKeys.items(companyId ?? ""),
    enabled: Boolean(companyId) && options.enabled !== false,
    queryFn: async () => {
      const body = unwrapAs<Partial<InventoryListResult>>(
        await api.GET(`${base}/items`, {
          params: { query: { company_id: companyId! } },
        }),
      );
      const items = Array.isArray(body.items) ? body.items : [];
      return {
        items,
        total: typeof body.total === "number" ? body.total : items.length,
      } satisfies InventoryListResult;
    },
  });
}

export function useCreateInventoryItem(companyId: string | null) {
  const { t } = useTranslation();
  return useApiMutation<CreateInventoryItemPayload, InventoryItem>({
    mutationFn: async (body) =>
      unwrapAs<InventoryItem>(
        await api.POST(`${base}/items`, {
          body: { company_id: companyId!, ...body } as never,
        }),
      ),
    invalidates: [inventoryKeys.all],
    successMessage: t("inventory.toast.created"),
  });
}

export function useUpdateInventoryItem() {
  const { t } = useTranslation();
  return useApiMutation<
    { id: string } & UpdateInventoryItemPayload,
    InventoryItem
  >({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<InventoryItem>(
        await api.PATCH(`${base}/items/{item_id}`, {
          params: { path: { item_id: id } },
          body: body as never,
        }),
      ),
    invalidates: [inventoryKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useDeleteInventoryItem() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE(`${base}/items/{item_id}`, {
          params: { path: { item_id: id } },
        }),
      ),
    invalidates: [inventoryKeys.all],
    successMessage: t("inventory.toast.deleted"),
  });
}
