import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ChipRow, Segmented } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Card,
  EmptyState,
  ErrorState,
  ListRow,
} from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { Eyebrow } from "@/components/ui/typography";
import { useMyCompanies } from "@/features/companies/companies-api";
import {
  useCreateInventoryItem,
  useDeleteInventoryItem,
  useInventoryItems,
  useUpdateInventoryItem,
  useWarehouses,
} from "@/features/inventory/inventory-api";
import { InventoryItemFormSheet } from "@/features/inventory/inventory-item-form-sheet";
import { InventoryItemRow } from "@/features/inventory/inventory-item-row";
import type {
  CreateInventoryItemPayload,
  InventoryCondition,
  InventoryItem,
  InventoryLocationType,
  UpdateInventoryItemPayload,
} from "@/features/inventory/inventory-types";
import { useSelectedProject } from "@/features/projects/selected-project";
import {
  filterInventoryItems,
  groupInventoryByLocation,
  summarizeInventory,
} from "@/lib/inventory/inventory-helpers";
import type { SiteRef } from "@/lib/inventory/inventory-helpers";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens } from "@/theme/tokens";

type LocationFilter = InventoryLocationType | "all";
type ConditionFilter = InventoryCondition | "all";

/**
 * One opening of the form sheet. The sheet is remounted (keyed) for every opening so its
 * fields start from `item` — or blank — and it is presented from an effect, once that fresh
 * instance is mounted: calling `present()` in the same handler that changes the key would
 * open the instance React is about to unmount.
 */
type FormSession = { item: InventoryItem | null; nonce: number };

function SummaryTile({
  label,
  value,
  tone = "ink",
  testID,
}: {
  label: string;
  value: number;
  tone?: "ink" | "positive" | "negative";
  testID: string;
}) {
  const color =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : "text-ink";
  return (
    <View className="flex-1 items-center rounded-[10px] bg-paper-2 px-2 py-2.5">
      <Text testID={testID} className={`font-mono text-[20px] ${color}`}>
        {value}
      </Text>
      <Text
        className="mt-0.5 font-sans text-[11px] uppercase tracking-[0.8px] text-muted"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Company equipment inventory: the tools and machines the company owns, how many, whether
 * they work, and where they are — a warehouse with its address or a site. Grouped by place;
 * filters by place and condition; create / edit / delete through a sheet.
 */
export default function InventoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const tokens = useTokens();
  const companies = useMyCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const effectiveCompany = companyId ?? companies.data?.[0]?.id ?? null;
  const { projects, projectId } = useSelectedProject();

  const items = useInventoryItems(effectiveCompany);
  const warehouses = useWarehouses(effectiveCompany);
  useRefetchOnFocus(items.refetch);
  const create = useCreateInventoryItem(effectiveCompany);
  const update = useUpdateInventoryItem();
  const remove = useDeleteInventoryItem();

  const [location, setLocation] = useState<LocationFilter>("all");
  const [condition, setCondition] = useState<ConditionFilter>("all");
  const [search, setSearch] = useState("");
  const formSheet = useRef<BottomSheetModal>(null);
  const [session, setSession] = useState<FormSession | null>(null);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);

  useEffect(() => {
    if (session) formSheet.current?.present();
  }, [session]);

  // Sites are the company's projects; the address is what the crew recognises on a row.
  const sites = useMemo<SiteRef[]>(
    () =>
      projects
        .filter(
          (project) =>
            !effectiveCompany ||
            !project.company_id ||
            project.company_id === effectiveCompany,
        )
        .map((project) => ({
          id: project.id,
          name: project.name,
          address: project.address,
        })),
    [projects, effectiveCompany],
  );

  const all = useMemo(() => items.data?.items ?? [], [items.data]);
  const summary = useMemo(() => summarizeInventory(all), [all]);
  const groups = useMemo(
    () =>
      groupInventoryByLocation(
        filterInventoryItems(all, { location, condition, q: search }),
        { warehouses: warehouses.data ?? [], sites },
      ),
    [all, location, condition, search, warehouses.data, sites],
  );

  const openForm = (item: InventoryItem | null) =>
    setSession((previous) => ({ item, nonce: (previous?.nonce ?? 0) + 1 }));
  const editing = session?.item ?? null;

  function submit(
    payload: CreateInventoryItemPayload | UpdateInventoryItemPayload,
  ) {
    const done = { onSuccess: () => formSheet.current?.dismiss() };
    if (!editing)
      return create.mutate(payload as CreateInventoryItemPayload, done);
    if (Object.keys(payload).length === 0) return formSheet.current?.dismiss();
    update.mutate({ id: editing.id, ...payload }, done);
  }

  if (companies.data && companies.data.length === 0)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title={t("inventory.title")} back />
        <EmptyState message={t("billing.form.noCompanies")} />
      </View>
    );

  const loading =
    (items.isPending || warehouses.isPending) && Boolean(effectiveCompany);

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader
        title={t("inventory.title")}
        back
        right={
          <Button
            testID="inventory-add"
            label={`＋ ${t("inventory.addItem")}`}
            size="sm"
            onPress={() => openForm(null)}
          />
        }
      />
      <ScrollView
        contentContainerClassName="p-4 pb-24"
        keyboardShouldPersistTaps="handled"
      >
        {(companies.data?.length ?? 0) > 1 ? (
          <Select
            testID="inventory-company"
            value={effectiveCompany}
            options={(companies.data ?? []).map((company) => ({
              value: company.id,
              label: company.legal_name,
            }))}
            onChange={(id) => {
              setCompanyId(id);
              setLocation("all");
              setCondition("all");
              setSearch("");
            }}
          />
        ) : null}

        {items.isError ? (
          <ErrorState
            message={t("inventory.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void items.refetch()}
          />
        ) : null}
        {warehouses.isError ? (
          <ErrorState
            message={t("inventory.warehouses.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void warehouses.refetch()}
          />
        ) : null}

        {loading ? <ActivityIndicator className="my-8" /> : null}

        {items.data ? (
          <>
            <Card className="mb-3" padded={false}>
              <View className="flex-row gap-2 p-2.5">
                <SummaryTile
                  testID="inventory-summary-total"
                  label={t("inventory.summary.total")}
                  value={summary.quantity}
                />
                <SummaryTile
                  testID="inventory-summary-working"
                  label={t("inventory.condition.working")}
                  value={summary.working}
                  tone="positive"
                />
                <SummaryTile
                  testID="inventory-summary-damaged"
                  label={t("inventory.condition.damaged")}
                  value={summary.damaged}
                  tone={summary.damaged > 0 ? "negative" : "ink"}
                />
              </View>
              <View className="flex-row gap-2 px-2.5 pb-2.5">
                <SummaryTile
                  testID="inventory-summary-warehouse"
                  label={t("inventory.location.warehouse")}
                  value={summary.inWarehouse}
                />
                <SummaryTile
                  testID="inventory-summary-site"
                  label={t("inventory.location.site")}
                  value={summary.onSite}
                />
              </View>
            </Card>

            <ListRow
              testID="inventory-warehouses"
              title={t("inventory.warehouses.title")}
              subtitle={t("inventory.warehouses.count", {
                count: warehouses.data?.length ?? 0,
              })}
              left={
                <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-paper-2">
                  <Icon name="map-pin" size={16} color={tokens.ink} />
                </View>
              }
              chevron
              onPress={() => router.push("/inventory/warehouses")}
            />

            <Input
              testID="inventory-search"
              value={search}
              onChangeText={setSearch}
              placeholder={t("inventory.searchPlaceholder")}
              autoCapitalize="none"
            />
            <View className="mb-3">
              <Segmented<LocationFilter>
                testID="inventory-filter-location"
                size="sm"
                value={location}
                onChange={setLocation}
                options={[
                  { value: "all", label: t("inventory.filters.everywhere") },
                  {
                    value: "warehouse",
                    label: t("inventory.location.warehouse"),
                  },
                  { value: "site", label: t("inventory.location.site") },
                ]}
              />
            </View>
            <View className="mb-4">
              <ChipRow<ConditionFilter>
                testID="inventory-filter-condition"
                value={condition}
                onChange={setCondition}
                options={[
                  { value: "all", label: t("inventory.filters.anyCondition") },
                  {
                    value: "working",
                    label: t("inventory.condition.working"),
                  },
                  {
                    value: "damaged",
                    label: t("inventory.condition.damaged"),
                  },
                ]}
              />
            </View>

            {groups.length === 0 ? (
              <EmptyState
                message={
                  all.length === 0
                    ? t("inventory.empty")
                    : t("inventory.noResults")
                }
                action={
                  all.length === 0 ? (
                    <Button
                      testID="inventory-add-empty"
                      label={t("inventory.addItem")}
                      size="sm"
                      onPress={() => openForm(null)}
                    />
                  ) : undefined
                }
              />
            ) : null}

            {groups.map((group) => (
              <View
                key={group.key}
                className="mb-4"
                testID={`inventory-group-${group.key}`}
              >
                <View className="mb-2 flex-row items-center gap-2">
                  <Icon
                    name={group.kind === "warehouse" ? "home" : "map-pin"}
                    size={14}
                    color={tokens.muted}
                  />
                  <View className="min-w-0 flex-1">
                    <Eyebrow>
                      {group.title ?? t("inventory.unknownLocation")}
                    </Eyebrow>
                    {group.subtitle ? (
                      <Text
                        className="font-sans text-[11.5px] text-muted"
                        numberOfLines={1}
                      >
                        {group.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="font-mono text-[12px] text-muted">
                    {t("inventory.units", { count: group.quantity })}
                  </Text>
                </View>
                <Card padded={false}>
                  {group.items.map((item, index) => (
                    <InventoryItemRow
                      key={item.id}
                      item={item}
                      last={index === group.items.length - 1}
                      onPress={() => openForm(item)}
                    />
                  ))}
                </Card>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      <InventoryItemFormSheet
        key={`${editing?.id ?? "create"}-${session?.nonce ?? 0}`}
        ref={formSheet}
        warehouses={warehouses.data ?? []}
        sites={sites}
        initial={editing ?? undefined}
        defaultProjectId={projectId || null}
        submitting={create.isPending || update.isPending}
        onSubmit={submit}
        onDelete={editing ? () => setDeleting(editing) : undefined}
      />

      <ConfirmDialog
        visible={deleting !== null}
        title={t("inventory.deleteConfirm", { name: deleting?.name ?? "" })}
        message={t("inventory.deleteHint")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { id: deleting.id },
            {
              onSuccess: () => formSheet.current?.dismiss(),
              onSettled: () => setDeleting(null),
            },
          )
        }
      />
    </View>
  );
}
