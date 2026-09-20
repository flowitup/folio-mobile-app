import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";

import type {
  CreateWarehousePayload,
  UpdateWarehousePayload,
  Warehouse,
} from "./inventory-types";

type Props = {
  initial?: Warehouse;
  submitting: boolean;
  onSubmit: (payload: CreateWarehousePayload | UpdateWarehousePayload) => void;
};

/** Create / edit a warehouse: a name and the address the crew drives to. Edit sends the diff. */
export const WarehouseFormSheet = forwardRef<BottomSheetModal, Props>(
  function WarehouseFormSheet({ initial, submitting, onSubmit }, ref) {
    const { t } = useTranslation();
    const editing = Boolean(initial);
    const [name, setName] = useState(initial?.name ?? "");
    const [address, setAddress] = useState(initial?.address ?? "");
    const [nameError, setNameError] = useState<string | null>(null);

    function submit() {
      const trimmedName = name.trim();
      if (!trimmedName)
        return setNameError(t("inventory.validation.warehouseNameRequired"));
      setNameError(null);
      const trimmedAddress = address.trim() || null;
      if (!initial)
        return onSubmit({ name: trimmedName, address: trimmedAddress });
      const diff: UpdateWarehousePayload = {};
      if (trimmedName !== initial.name) diff.name = trimmedName;
      if (trimmedAddress !== initial.address) diff.address = trimmedAddress;
      onSubmit(diff);
    }

    return (
      <Sheet
        ref={ref}
        title={
          editing
            ? t("inventory.warehouses.editTitle")
            : t("inventory.warehouses.createTitle")
        }
        snapPoints={["55%"]}
      >
        <View className="p-4">
          <Input
            testID="warehouse-name"
            label={t("inventory.warehouses.fields.name")}
            value={name}
            onChangeText={setName}
            error={nameError}
            placeholder={t("inventory.warehouses.fields.namePlaceholder")}
          />
          <Input
            testID="warehouse-address"
            label={t("inventory.warehouses.fields.address")}
            value={address}
            onChangeText={setAddress}
            multiline
            placeholder={t("inventory.warehouses.fields.addressPlaceholder")}
          />
          <Button
            testID="warehouse-submit"
            label={
              editing
                ? t("common.save")
                : t("inventory.warehouses.actions.create")
            }
            loading={submitting}
            onPress={submit}
          />
        </View>
      </Sheet>
    );
  },
);
