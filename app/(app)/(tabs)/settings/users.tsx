import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Card, Checkbox, EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import {
  useAdminUserSearch,
  useBulkAddMemberships,
  useGlobalRoles,
  useUpdateUser,
} from "@/features/admin/admin-api";
import type {
  BulkAddResultItem,
  UserSearchItem,
} from "@/features/admin/admin-api";
import { useProjects } from "@/features/projects/projects-api";

const MAX_PROJECTS = 50;
const STATUS_KEY: Record<BulkAddResultItem["status"], string> = {
  added: "added",
  already_member_same_role: "alreadyMember",
  already_member_different_role: "differentRole",
  project_not_found: "notFound",
};

/** Superadmin: search a user (≥ 3 chars), edit them, and bulk-add them to projects with one role. */
export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const superadmin = user?.permissions.includes("*:*") ?? false;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const results = useAdminUserSearch(query);
  const [selected, setSelected] = useState<UserSearchItem | null>(null);
  const roles = useGlobalRoles(superadmin);
  const projects = useProjects();
  const [roleId, setRoleId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [projectIds, setProjectIds] = useState<Set<string>>(new Set());
  const bulkAdd = useBulkAddMemberships();
  const [outcome, setOutcome] = useState<BulkAddResultItem[] | null>(null);
  const updateUser = useUpdateUser();
  const editSheet = useRef<BottomSheetModal>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  useEffect(() => {
    const handle = setTimeout(
      () => setQuery(search.trim().length >= 3 ? search.trim() : ""),
      300,
    );
    return () => clearTimeout(handle);
  }, [search]);

  const visibleProjects = useMemo(() => {
    const needle = projectFilter.trim().toLowerCase();
    const all = projects.data?.projects ?? [];
    return needle
      ? all.filter((p) => p.name.toLowerCase().includes(needle))
      : all;
  }, [projects.data, projectFilter]);

  if (!superadmin)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title={t("admin.bulkAdd.title")} back />
        <EmptyState message={t("settings.users.permissionDenied")} />
      </View>
    );

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("admin.bulkAdd.title")} back />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-3 text-xs text-muted-foreground">
          {t("admin.bulkAdd.subtitle")}
        </Text>
        <TextInput
          testID="user-search"
          className="mb-2 rounded-lg border border-border px-4 py-2 text-base text-primary"
          placeholder={t("admin.bulkAdd.userSearch.placeholder")}
          placeholderTextColor="#a3a3a3"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.trim().length > 0 && search.trim().length < 3 ? (
          <Text className="mb-2 text-xs text-muted-foreground">
            {t("admin.bulkAdd.userSearch.minChars")}
          </Text>
        ) : null}
        {results.isFetching ? <ActivityIndicator /> : null}
        {query && results.data && results.data.length === 0 ? (
          <Text className="mb-2 text-xs text-muted-foreground">
            {t("admin.bulkAdd.userSearch.empty")}
          </Text>
        ) : null}
        {!selected
          ? (results.data ?? []).map((item) => (
              <Pressable
                key={item.id}
                testID={`user-pick-${item.id}`}
                onPress={() => setSelected(item)}
                className="mb-1 rounded-lg border border-border px-3 py-2"
              >
                <Text className="text-base text-primary">
                  {item.display_name ?? item.email}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {item.email}
                  {item.phone ? ` · ${item.phone}` : ""}
                </Text>
              </Pressable>
            ))
          : null}
        {selected ? (
          <Card className="mb-3">
            <Text className="text-sm text-primary">
              {t("admin.bulkAdd.userSearch.selected", {
                email: selected.email,
              })}
            </Text>
            <View className="mt-2 flex-row gap-2">
              <Button
                testID="user-edit"
                label={t("common.edit")}
                size="sm"
                variant="secondary"
                onPress={() => {
                  setEditEmail(selected.email);
                  setEditName(selected.display_name ?? "");
                  setEditPhone(selected.phone ?? "");
                  editSheet.current?.present();
                }}
              />
              <Button
                testID="user-clear"
                label={t("admin.bulkAdd.userSearch.clear")}
                size="sm"
                variant="ghost"
                onPress={() => setSelected(null)}
              />
            </View>
          </Card>
        ) : null}

        <Select
          testID="bulk-role"
          label={t("admin.bulkAdd.role.label")}
          placeholder={t("admin.bulkAdd.role.placeholder")}
          value={roleId}
          options={(roles.data ?? []).map((role) => ({
            value: role.id,
            label: role.name,
          }))}
          onChange={setRoleId}
        />
        <Text className="mb-1 text-sm text-muted-foreground">
          {t("admin.bulkAdd.projects.label")} ·{" "}
          {t("admin.bulkAdd.projects.selectedCount", {
            count: projectIds.size,
            max: MAX_PROJECTS,
          })}
        </Text>
        <TextInput
          testID="bulk-project-filter"
          className="mb-2 rounded-lg border border-border px-4 py-2 text-base text-primary"
          placeholder={t("admin.bulkAdd.projects.placeholder")}
          placeholderTextColor="#a3a3a3"
          value={projectFilter}
          onChangeText={setProjectFilter}
        />
        {visibleProjects.map((project) => (
          <Checkbox
            key={project.id}
            testID={`bulk-project-${project.id}`}
            label={project.name}
            value={projectIds.has(project.id)}
            onChange={(next) =>
              setProjectIds((prev) => {
                const copy = new Set(prev);
                if (next) {
                  if (copy.size >= MAX_PROJECTS) return prev;
                  copy.add(project.id);
                } else copy.delete(project.id);
                return copy;
              })
            }
          />
        ))}
        <Button
          testID="bulk-submit"
          label={t("admin.bulkAdd.submit")}
          loading={bulkAdd.isPending}
          disabled={!selected || !roleId || projectIds.size === 0}
          onPress={() =>
            selected &&
            roleId &&
            bulkAdd.mutate(
              {
                userId: selected.id,
                project_ids: [...projectIds],
                role_id: roleId,
              },
              {
                onSuccess: (data) => {
                  setOutcome(data.results);
                  setProjectIds(new Set());
                },
              },
            )
          }
        />
        {outcome ? (
          <Card className="mt-4">
            {outcome.map((item) => (
              <View
                key={item.project_id}
                className="mb-1 flex-row items-center justify-between"
              >
                <Text
                  className="flex-1 pr-2 text-sm text-primary"
                  numberOfLines={1}
                >
                  {item.project_name ?? item.project_id}
                </Text>
                <Badge
                  label={t(`admin.bulkAdd.toast.${STATUS_KEY[item.status]}`, {
                    project: item.project_name ?? "",
                    count: 1,
                  })}
                  tone={item.status === "added" ? "success" : "neutral"}
                />
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <Sheet ref={editSheet} title={t("common.edit")} snapPoints={["55%"]}>
        <View className="p-4">
          <Input
            testID="user-edit-email"
            label={t("login.email")}
            value={editEmail}
            onChangeText={setEditEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            testID="user-edit-name"
            label={t("admin.bulkAdd.userSearch.label")}
            value={editName}
            onChangeText={setEditName}
          />
          <Input
            testID="user-edit-phone"
            label={t("admin.bulkAdd.userSearch.phone")}
            value={editPhone}
            onChangeText={setEditPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="06 12 34 56 78"
          />
          <Button
            testID="user-edit-submit"
            label={t("common.save")}
            loading={updateUser.isPending}
            onPress={() =>
              selected &&
              updateUser.mutate(
                {
                  userId: selected.id,
                  email: editEmail.trim(),
                  display_name: editName.trim() || null,
                  phone: editPhone.trim() || null,
                },
                {
                  onSuccess: (updated) => {
                    setSelected(updated);
                    editSheet.current?.dismiss();
                  },
                },
              )
            }
          />
        </View>
      </Sheet>
    </View>
  );
}
