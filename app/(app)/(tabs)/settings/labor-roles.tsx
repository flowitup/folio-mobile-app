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

import { useAuth } from "@/auth/auth-context";
import { isCompanyAdminOrManager, isPlatformOps } from "@/auth/permissions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Sheet } from "@/components/ui/sheet";
import {
  SettingsCompanyPicker,
  useSettingsCompany,
} from "@/features/companies/settings-company";
import {
  useCreateLaborRole,
  useDeleteLaborRole,
  useLaborRoles,
  useUpdateLaborRole,
} from "@/features/labor/labor-api";
import type { LaborRole } from "@/features/labor/labor-api";
import { isHexColor, laborRoleLabel } from "@/lib/labor/labor-role-label";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { refreshKeys, usePullToRefresh } from "@/lib/query/use-pull-to-refresh";

/** The API's limit on a role name. */
const NAME_MAX = 100;

/** Every company the user belongs to shows its roles; writing needs admin or manager there. */
const anyCompany = () => true;

/**
 * Labor roles of one company — the one picked here, by default the selected project's, then the
 * primary, then the oldest attachment: list with colour swatches, create from the suggested
 * palette, rename / recolour, delete. Writing is reserved to an admin or manager of that company
 * — the backend answers 403 to anyone else, so the list stays readable but the controls are
 * hidden.
 */
export default function LaborRolesScreen() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { companies, eligible, selected, setCompanyId } =
    useSettingsCompany(anyCompany);
  const companyId = selected?.id;
  // The role from the company list (the one the picker shows), not `user.companies`: the list
  // is refetched before a company creation resolves, while `user` is re-read after it, so a
  // company just created showed no "+ New role" until the app was relaunched.
  const mayManage = selected?.role
    ? isPlatformOps(user) ||
      selected.role === "admin" ||
      selected.role === "manager"
    : isCompanyAdminOrManager(user, companyId);
  const roles = useLaborRoles(companyId);
  useRefetchOnFocus(roles.refetch);
  const pullToRefresh = usePullToRefresh(
    [refreshKeys.laborRoles, refreshKeys.companies],
    {
      refetch: [refreshUser],
    },
  );
  const create = useCreateLaborRole(companyId);
  const update = useUpdateLaborRole();
  const remove = useDeleteLaborRole();
  const sheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<LaborRole | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LaborRole | null>(null);
  const palette = roles.data?.palette ?? [];

  function open(role: LaborRole | null) {
    setEditing(role);
    // A seed role reads in the viewer's language; saving that label unchanged keeps the seed
    // name (and its translation for everyone else).
    setName(role ? laborRoleLabel(role, t) : "");
    setColor(role?.color ?? palette[0] ?? "#4B5563");
    setError(null);
    setColorError(null);
    sheet.current?.present();
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t("laborRoles.nameRequired"));
    if (trimmed.length > NAME_MAX)
      return setError(t("laborRoles.nameTooLong", { max: NAME_MAX }));
    if (!isHexColor(color)) return setColorError(t("laborRoles.colorInvalid"));
    const done = { onSuccess: () => sheet.current?.dismiss() };
    if (editing) {
      const renamed = trimmed !== laborRoleLabel(editing, t);
      update.mutate(
        { roleId: editing.id, ...(renamed ? { name: trimmed } : {}), color },
        done,
      );
    } else create.mutate({ name: trimmed, color }, done);
  }

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader
        title={t("laborRoles.title")}
        back
        right={
          mayManage ? (
            <Button
              testID="role-create"
              label={`＋ ${t("laborRoles.new")}`}
              size="sm"
              onPress={() => open(null)}
            />
          ) : undefined
        }
      />
      <ScrollView
        refreshControl={pullToRefresh}
        contentContainerClassName="p-4 pb-12"
      >
        <SettingsCompanyPicker
          testID="roles-company"
          eligible={eligible}
          selected={selected}
          onChange={setCompanyId}
        />
        {companies.data && companies.data.length === 0 ? (
          <EmptyState message={t("laborRoles.noCompany")} />
        ) : null}
        {companyId && roles.isPending ? (
          <ActivityIndicator className="mt-8" />
        ) : null}
        {roles.isError && !roles.data ? (
          <ErrorState
            message={t("common.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void roles.refetch()}
          />
        ) : null}
        {roles.data && roles.data.roles.length === 0 ? (
          <EmptyState message={t("laborRoles.none")} />
        ) : null}
        {(roles.data?.roles ?? []).map((role) => (
          <Pressable
            key={role.id}
            onLongPress={mayManage ? () => setDeleting(role) : undefined}
          >
            <ListRow
              testID={`role-${role.id}`}
              title={laborRoleLabel(role, t)}
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
              onPress={mayManage ? () => open(role) : undefined}
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
            onChangeText={(value) => {
              setError(null);
              setName(value);
            }}
            maxLength={NAME_MAX}
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
                onPress={() => {
                  setColorError(null);
                  setColor(value);
                }}
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
            onChangeText={(value) => {
              setColorError(null);
              setColor(value);
            }}
            error={colorError}
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
        title={t("laborRoles.deleteConfirm", {
          name: deleting ? laborRoleLabel(deleting, t) : "",
        })}
        message={t("laborRoles.deleteWarning")}
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
