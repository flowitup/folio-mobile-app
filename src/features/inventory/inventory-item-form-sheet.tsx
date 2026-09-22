import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Eyebrow } from "@/components/ui/typography";
import {
  defaultSiteId,
  parseQuantity,
} from "@/lib/inventory/inventory-helpers";
import type { SiteRef } from "@/lib/inventory/inventory-helpers";

import {
  INVENTORY_CATEGORY_SLUGS,
  isInventoryCategorySlug,
} from "./inventory-types";
import type {
  CreateInventoryItemPayload,
  InventoryCondition,
  InventoryItem,
  InventoryLocationType,
  UpdateInventoryItemPayload,
  Warehouse,
} from "./inventory-types";

type Props = {
  warehouses: Warehouse[];
  sites: SiteRef[];
  initial?: InventoryItem;
  /** Where a new row lands by default (the selected project when there is one). */
  defaultProjectId?: string | null;
  submitting: boolean;
  /** Create: full payload. Edit: diff-only payload (empty when nothing changed). */
  onSubmit: (
    payload: CreateInventoryItemPayload | UpdateInventoryItemPayload,
  ) => void;
  /** Edit only: shown as a danger button under the form. */
  onDelete?: () => void;
};

const orNull = (value: string) => value.trim() || null;

/**
 * Create / edit an inventory row: what it is, how many, usable or broken, and where it is —
 * a warehouse of the company or one of its sites. Edit sends only the changed keys.
 */
export const InventoryItemFormSheet = forwardRef<BottomSheetModal, Props>(
  function InventoryItemFormSheet(
    {
      warehouses,
      sites,
      initial,
      defaultProjectId,
      submitting,
      onSubmit,
      onDelete,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const editing = Boolean(initial);
    const [name, setName] = useState(initial?.name ?? "");
    const [category, setCategory] = useState<string>(
      initial?.category ?? "__none__",
    );
    const [quantity, setQuantity] = useState(
      initial ? String(initial.quantity) : "1",
    );
    const [condition, setCondition] = useState<InventoryCondition>(
      initial?.condition ?? "working",
    );
    const [locationType, setLocationType] = useState<InventoryLocationType>(
      initial?.location_type ??
        (warehouses.length > 0 || !defaultProjectId ? "warehouse" : "site"),
    );
    const [warehouseId, setWarehouseId] = useState<string | null>(
      initial?.warehouse_id ?? warehouses[0]?.id ?? null,
    );
    // A row being edited keeps its own site even if it is no longer listed; a new row only
    // ever starts on a site of this company.
    const [projectId, setProjectId] = useState<string | null>(
      initial?.project_id ?? defaultSiteId(defaultProjectId, sites),
    );
    const [reference, setReference] = useState(initial?.reference ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [errors, setErrors] = useState<Record<string, string>>({});

    function submit() {
      const next: Record<string, string> = {};
      const parsedQuantity = parseQuantity(quantity);
      if (!name.trim()) next.name = t("inventory.validation.nameRequired");
      if (parsedQuantity === null)
        next.quantity = t("inventory.validation.quantityInvalid");
      if (locationType === "warehouse" && !warehouseId)
        next.location = t("inventory.validation.warehouseRequired");
      if (locationType === "site" && !projectId)
        next.location = t("inventory.validation.siteRequired");
      setErrors(next);
      if (Object.keys(next).length > 0 || parsedQuantity === null) return;

      const categoryValue = isInventoryCategorySlug(category) ? category : null;
      const payload: CreateInventoryItemPayload = {
        name: name.trim(),
        category: categoryValue,
        reference: orNull(reference),
        description: orNull(description),
        quantity: parsedQuantity,
        condition,
        location_type: locationType,
        warehouse_id: locationType === "warehouse" ? warehouseId : null,
        project_id: locationType === "site" ? projectId : null,
      };
      if (!initial) return onSubmit(payload);

      const diff: UpdateInventoryItemPayload = {};
      if (payload.name !== initial.name) diff.name = payload.name;
      if (payload.category !== initial.category)
        diff.category = payload.category;
      if (payload.reference !== initial.reference)
        diff.reference = payload.reference;
      if (payload.description !== initial.description)
        diff.description = payload.description;
      if (payload.quantity !== initial.quantity)
        diff.quantity = payload.quantity;
      if (payload.condition !== initial.condition)
        diff.condition = payload.condition;
      if (
        payload.location_type !== initial.location_type ||
        payload.warehouse_id !== initial.warehouse_id ||
        payload.project_id !== initial.project_id
      ) {
        diff.location_type = payload.location_type;
        diff.warehouse_id = payload.warehouse_id;
        diff.project_id = payload.project_id;
      }
      onSubmit(diff);
    }

    return (
      <Sheet
        ref={ref}
        title={editing ? t("inventory.editTitle") : t("inventory.createTitle")}
        snapPoints={["90%"]}
      >
        <View className="p-4">
          <Input
            testID="inventory-name"
            label={t("inventory.fields.name")}
            value={name}
            onChangeText={setName}
            error={errors.name}
            placeholder={t("inventory.fields.namePlaceholder")}
          />
          <Select
            testID="inventory-category"
            label={t("inventory.fields.category")}
            value={category}
            options={[
              { value: "__none__", label: t("inventory.uncategorized") },
              ...INVENTORY_CATEGORY_SLUGS.map((slug) => ({
                value: slug,
                label: t(`inventory.categories.${slug}`),
              })),
            ]}
            onChange={setCategory}
          />
          <Input
            testID="inventory-quantity"
            label={t("inventory.fields.quantity")}
            value={quantity}
            onChangeText={setQuantity}
            error={errors.quantity}
            keyboardType="number-pad"
          />
          <Eyebrow className="mb-1.5">
            {t("inventory.fields.condition")}
          </Eyebrow>
          <View className="mb-4">
            <Segmented<InventoryCondition>
              testID="inventory-condition"
              value={condition}
              onChange={setCondition}
              options={[
                { value: "working", label: t("inventory.condition.working") },
                { value: "damaged", label: t("inventory.condition.damaged") },
              ]}
            />
          </View>
          <Eyebrow className="mb-1.5">{t("inventory.fields.location")}</Eyebrow>
          <View className="mb-4">
            <Segmented<InventoryLocationType>
              testID="inventory-location-type"
              value={locationType}
              onChange={setLocationType}
              options={[
                {
                  value: "warehouse",
                  label: t("inventory.location.warehouse"),
                },
                { value: "site", label: t("inventory.location.site") },
              ]}
            />
          </View>
          {locationType === "warehouse" ? (
            warehouses.length > 0 ? (
              <Select
                testID="inventory-warehouse"
                label={t("inventory.fields.warehouse")}
                value={warehouseId}
                options={warehouses.map((warehouse) => ({
                  value: warehouse.id,
                  label: warehouse.name,
                  description: warehouse.address ?? undefined,
                }))}
                onChange={setWarehouseId}
                error={errors.location}
              />
            ) : (
              <Text
                testID="inventory-no-warehouse"
                className="mb-4 font-sans text-xs text-negative"
              >
                {t("inventory.validation.noWarehouseYet")}
              </Text>
            )
          ) : sites.length > 0 ? (
            <Select
              testID="inventory-site"
              label={t("inventory.fields.site")}
              value={projectId}
              placeholder={t("inventory.fields.sitePlaceholder")}
              options={sites.map((site) => ({
                value: site.id,
                label: site.name,
                description: site.address ?? undefined,
              }))}
              onChange={setProjectId}
              error={errors.location}
            />
          ) : (
            <Text
              testID="inventory-no-site"
              className="mb-4 font-sans text-xs text-negative"
            >
              {t("inventory.validation.noSiteYet")}
            </Text>
          )}
          <Input
            testID="inventory-reference"
            label={t("inventory.fields.reference")}
            value={reference}
            onChangeText={setReference}
            hint={t("inventory.fields.referenceHint")}
            autoCapitalize="characters"
          />
          <Input
            testID="inventory-description"
            label={t("inventory.fields.description")}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Button
            testID="inventory-submit"
            label={editing ? t("common.save") : t("inventory.actions.create")}
            loading={submitting}
            onPress={submit}
          />
          {editing && onDelete ? (
            <Button
              testID="inventory-delete"
              label={t("common.delete")}
              variant="danger"
              className="mt-3"
              onPress={onDelete}
            />
          ) : null}
        </View>
      </Sheet>
    );
  },
);
