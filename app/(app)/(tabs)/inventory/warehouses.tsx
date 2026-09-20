import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import {
  Card,
  EmptyState,
  ErrorState,
  ListRow,
} from "@/components/ui/primitives";
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
import { unitsByWarehouse } from "@/lib/inventory/inventory-helpers";
import { useTokens } from "@/theme/tokens";

/** One opening of the form sheet; see the same type on the inventory screen. */
type FormSession = { warehouse: Warehouse | null; nonce: number };

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
  const [session, setSession] = useState<FormSession | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);

  useEffect(() => {
    if (session) formSheet.current?.present();
  }, [session]);

  const units = useMemo(
    () => unitsByWarehouse(items.data?.items ?? []),
    [items.data],
  );

  const openForm = (warehouse: Warehouse | null) =>
    setSession((previous) => ({
      warehouse,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  const editing = session?.warehouse ?? null;

  function submit(payload: CreateWarehousePayload | UpdateWarehousePayload) {
    const done = { onSuccess: () => formSheet.current?.dismiss() };
    if (!editing) return create.mutate(payload as CreateWarehousePayload, done);
    if (Object.keys(payload).length === 0) return formSheet.current?.dismiss();
    update.mutate({ id: editing.id, ...payload }, done);
  }

  const deletingUnits = deleting ? (units.get(deleting.id) ?? 0) : 0;

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
            onPress={() => openForm(null)}
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
        {warehouses.isError ? (
          <ErrorState
            message={t("inventory.warehouses.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void warehouses.refetch()}
          />
        ) : null}
        {warehouses.data && warehouses.data.length === 0 ? (
          <EmptyState
            message={t("inventory.warehouses.empty")}
            action={
              <Button
                testID="warehouse-add-empty"
                label={t("inventory.warehouses.add")}
                size="sm"
                onPress={() => openForm(null)}
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
                    <Text
                      testID={`warehouse-${warehouse.id}-units`}
                      className="font-mono text-[12px] text-muted"
                    >
                      {t("inventory.units", {
                        count: units.get(warehouse.id) ?? 0,
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
                onPress={() => openForm(warehouse)}
                chevron
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <WarehouseFormSheet
        key={`${editing?.id ?? "create"}-${session?.nonce ?? 0}`}
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
