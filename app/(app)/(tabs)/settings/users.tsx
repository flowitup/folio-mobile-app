import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
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
import { isPlatformOps } from "@/auth/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import { useAdminUserSearch, useUpdateUser } from "@/features/admin/admin-api";
import type { UserSearchItem } from "@/features/admin/admin-api";
import { normalizePhone } from "@/lib/auth/phone-number";

/** Platform ops: search a user by email/name and edit their identity fields. */
export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const platformOps = isPlatformOps(user);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const results = useAdminUserSearch(query);
  const [selected, setSelected] = useState<UserSearchItem | null>(null);
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

  if (!platformOps)
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
          // Typing again means "look for someone else": without dropping the selection the
          // results stayed hidden behind the selected card and could never be reached again.
          onChangeText={(text) => {
            setSearch(text);
            setSelected(null);
          }}
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
                testID="user-change"
                label={t("common.change")}
                size="sm"
                variant="secondary"
                onPress={() => setSelected(null)}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <Sheet ref={editSheet} title={t("common.edit")} snapPoints={["55%"]}>
        <View className="p-4">
          <Input
            testID="user-edit-email"
            label={t("common.email")}
            value={editEmail}
            onChangeText={setEditEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            testID="user-edit-name"
            label={t("admin.bulkAdd.userSearch.nameLabel")}
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
            onPress={() => {
              if (!selected) return;
              // Sign-in is French-only, and rejecting the number server-side raises its own
              // English sentence in a toast over a translated screen.
              const typed = editPhone.trim();
              const phone = typed ? normalizePhone(typed) : null;
              if (typed && !phone) {
                showToast(t("login.invalidPhone"), "error");
                return;
              }
              updateUser.mutate(
                {
                  userId: selected.id,
                  email: editEmail.trim(),
                  display_name: editName.trim() || null,
                  phone,
                },
                {
                  onSuccess: (updated) => {
                    setSelected(updated);
                    editSheet.current?.dismiss();
                  },
                },
              );
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}
