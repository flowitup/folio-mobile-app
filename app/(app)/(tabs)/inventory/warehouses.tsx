import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Card, EmptyState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { useMyCompanies } from "@/features/companies/companies-api";
import {
  useCreateWarehouse,
  useDeleteWarehouse,
  useInventoryItems,
  useUpdateWarehouse,
  useWarehouses,
} from "@/features/inventory/inventory-api";
import type {
  CreateWarehousePayload,
  UpdateWarehousePayload,
  Warehouse,
} from "@/features/inventory/inventory-types";
import { WarehouseFormSheet } from "@/features/inventory/warehouse-form-sheet";
import { useTokens } from "@/theme/tokens";

/**
 * The company's warehouses: name and address, with how many units each one holds. A warehouse
 * that still holds rows cannot be deleted — the crew moves or removes them first.
 */
export default function WarehousesScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const companies = useMyCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const effectiveCompany = companyId ?? companies.data?.[0]?.id ?? null;

  const warehouses = useWarehouses(effectiveCompany);
  const items = useInventoryItems(effectiveCompany);
  const create = useCreateWarehouse(effectiveCompany);
  const update = useUpdateWarehouse();
  const remove = useDeleteWarehouse();

  const formSheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);

  // Units per warehouse, so a row says what deleting it would strand.
  const unitsByWarehouse = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items.data?.items ?? [])
      if (item.location_type === "warehouse" && item.warehouse_id)
        map.set(
          item.warehouse_id,
          (map.get(item.warehouse_id) ?? 0) + Math.max(0, item.quantity),
        );
    return map;
  }, [items.data]);

  function openCreate() {
    setEditing(null);
    setFormKey((k) => k + 1);
    formSheet.current?.present();
  }

  function openEdit(warehouse: Warehouse) {
    setEditing(warehouse);
    setFormKey((k) => k + 1);
    formSheet.current?.present();
  }

  function submit(payload: CreateWarehousePayload | UpdateWarehousePayload) {
    const done = { onSuccess: () => formSheet.current?.dismiss() };
    if (!editing) return create.mutate(payload as CreateWarehousePayload, done);
    if (Object.keys(payload).length === 0) return formSheet.current?.dismiss();
    update.mutate({ id: editing.id, ...payload }, done);
  }

  const deletingUnits = deleting ? (unitsByWarehouse.get(deleting.id) ?? 0) : 0;

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader
        title={t("inventory.warehouses.title")}
        back
        right={
          <Button
            testID="warehouse-add"
            label={`＋ ${t("inventory.warehouses.add")}`}
            size="sm"
            onPress={openCreate}
          />
        }
      />
      <ScrollView contentContainerClassName="p-4 pb-24">
        {(companies.data?.length ?? 0) > 1 ? (
          <Select
            testID="warehouses-company"
            value={effectiveCompany}
            options={(companies.data ?? []).map((company) => ({
              value: company.id,
              label: company.legal_name,
            }))}
            onChange={setCompanyId}
          />
        ) : null}
        {warehouses.isPending && effectiveCompany ? (
          <ActivityIndicator className="my-8" />
        ) : null}
        {warehouses.data && warehouses.data.length === 0 ? (
          <EmptyState
            message={t("inventory.warehouses.empty")}
            action={
              <Button
                testID="warehouse-add-empty"
                label={t("inventory.warehouses.add")}
                size="sm"
                onPress={openCreate}
              />
            }
          />
        ) : null}
        {warehouses.data && warehouses.data.length > 0 ? (
          <Card padded={false}>
            {warehouses.data.map((warehouse) => (
              <ListRow
                key={warehouse.id}
                testID={`warehouse-${warehouse.id}`}
                grouped
                title={warehouse.name}
                subtitle={
                  warehouse.address ?? t("inventory.warehouses.noAddress")
                }
                left={
                  <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-paper-2">
                    <Icon name="home" size={16} color={tokens.ink} />
                  </View>
                }
                right={
                  <View className="flex-row items-center gap-2">
                    <Text className="font-mono text-[12px] text-muted">
                      {t("inventory.units", {
                        count: unitsByWarehouse.get(warehouse.id) ?? 0,
                      })}
                    </Text>
                    <Button
                      testID={`warehouse-delete-${warehouse.id}`}
                      label={t("common.delete")}
                      size="sm"
                      variant="ghost"
                      onPress={() => setDeleting(warehouse)}
                    />
                  </View>
                }
                onPress={() => openEdit(warehouse)}
                chevron
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <WarehouseFormSheet
        key={`${editing?.id ?? "create"}-${formKey}`}
        ref={formSheet}
        initial={editing ?? undefined}
        submitting={create.isPending || update.isPending}
        onSubmit={submit}
      />

      <ConfirmDialog
        visible={deleting !== null}
        title={t("inventory.warehouses.deleteConfirm", {
          name: deleting?.name ?? "",
        })}
        message={
          deletingUnits > 0
            ? t("inventory.warehouses.deleteBlocked", { count: deletingUnits })
            : undefined
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { id: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </View>
  );
}
