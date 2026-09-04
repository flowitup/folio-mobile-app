import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { EmptyState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Sheet } from "@/components/ui/sheet";
import {
  useCreateLaborRole,
  useDeleteLaborRole,
  useLaborRoles,
  useUpdateLaborRole,
} from "@/features/labor/labor-api";
import type { LaborRole } from "@/features/labor/labor-api";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Labor roles: list with colour swatches, create from the suggested palette, rename / recolour, delete. */
export default function LaborRolesScreen() {
  const { t } = useTranslation();
  const roles = useLaborRoles();
  useRefetchOnFocus(roles.refetch);
  const create = useCreateLaborRole();
  const update = useUpdateLaborRole();
  const remove = useDeleteLaborRole();
  const sheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<LaborRole | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LaborRole | null>(null);
  const palette = roles.data?.palette ?? [];

  function open(role: LaborRole | null) {
    setEditing(role);
    setName(role?.name ?? "");
    setColor(role?.color ?? palette[0] ?? "#4B5563");
    setError(null);
    sheet.current?.present();
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t("laborRoles.nameRequired"));
    const done = { onSuccess: () => sheet.current?.dismiss() };
    if (editing)
      update.mutate({ roleId: editing.id, name: trimmed, color }, done);
    else create.mutate({ name: trimmed, color }, done);
  }

  return (
    <View className="flex-1 bg-card">
      <ScreenHeader
        title={t("laborRoles.title")}
        back
        right={
          <Button
            testID="role-create"
            label={`＋ ${t("laborRoles.new")}`}
            size="sm"
            onPress={() => open(null)}
          />
        }
      />
      <ScrollView contentContainerClassName="p-4 pb-12">
        {roles.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {roles.data && roles.data.roles.length === 0 ? (
          <EmptyState message={t("laborRoles.none")} />
        ) : null}
        {(roles.data?.roles ?? []).map((role) => (
          <Pressable key={role.id} onLongPress={() => setDeleting(role)}>
            <ListRow
              testID={`role-${role.id}`}
              title={role.name}
              subtitle={role.color}
              right={
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: role.color,
                  }}
                />
              }
              onPress={() => open(role)}
            />
          </Pressable>
        ))}
      </ScrollView>

      <Sheet
        ref={sheet}
        title={editing ? t("laborRoles.edit") : t("laborRoles.new")}
        snapPoints={["60%"]}
      >
        <View className="p-4">
          <Input
            testID="role-name"
            label={t("laborRoles.name")}
            value={name}
            onChangeText={setName}
            error={error}
          />
          <Text className="mb-1 text-sm text-muted-foreground">
            {t("laborRoles.color")}
          </Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {palette.map((value) => (
              <Pressable
                key={value}
                testID={`role-color-${value}`}
                onPress={() => setColor(value)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: value,
                  borderWidth: color === value ? 3 : 1,
                  borderColor: color === value ? "#171717" : "#e5e5e5",
                }}
              />
            ))}
          </View>
          <Input
            testID="role-color-input"
            value={color}
            onChangeText={setColor}
            autoCapitalize="none"
            placeholder="#RRGGBB"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                testID="role-submit"
                label={t("common.save")}
                loading={create.isPending || update.isPending}
                onPress={submit}
              />
            </View>
            {editing ? (
              <Button
                testID="role-delete"
                label={t("common.delete")}
                variant="danger"
                onPress={() => {
                  sheet.current?.dismiss();
                  setDeleting(editing);
                }}
              />
            ) : null}
          </View>
        </View>
      </Sheet>
      <ConfirmDialog
        visible={deleting !== null}
        title={t("laborRoles.deleteConfirm", { name: deleting?.name ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { roleId: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </View>
  );
}
