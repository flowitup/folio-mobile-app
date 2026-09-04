import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
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
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Card, EmptyState } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { projectCan, useProject } from "@/features/projects/projects-api";
import {
  useCreateTag,
  useDeleteTag,
  useTagSummary,
  useTags,
  useUpdateTag,
} from "@/features/projects/tags-api";
import type { Tag } from "@/features/projects/tags-api";
import { formatMoney } from "@/lib/format/money";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

// Same palette the web TagManager offers.
const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#737373",
];

/** Phase tags: CRUD + per-tag cost rollup (labor + expenses). */
export default function ProjectTagsSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const project = useProject(id);
  const tags = useTags(id);
  const summary = useTagSummary(id);
  const createTag = useCreateTag(id);
  const updateTag = useUpdateTag(id);
  const deleteTag = useDeleteTag(id);
  useRefetchOnFocus(tags.refetch);

  const sheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[5]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const canManage =
    projectCan(project.data, "project:update", user?.permissions) ||
    project.data?.owner_id === user?.id;

  function openForm(tag: Tag | null) {
    setEditing(tag);
    setName(tag?.name ?? "");
    setColor(tag?.color ?? TAG_COLORS[5]);
    setNameError(null);
    sheet.current?.present();
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return setNameError(t("tags.nameRequired"));
    const done = { onSuccess: () => sheet.current?.dismiss() };
    if (editing)
      updateTag.mutate({ tagId: editing.id, name: trimmed, color }, done);
    else createTag.mutate({ name: trimmed, color }, done);
  }

  if (tags.isPending) return <ActivityIndicator className="mt-8" />;

  const rows = summary.data ?? [];

  return (
    <ScrollView className="flex-1 bg-card" contentContainerClassName="p-4">
      {canManage ? (
        <Button
          testID="tags-create"
          label={t("tags.create")}
          className="mb-4"
          onPress={() => openForm(null)}
        />
      ) : null}

      {tags.data?.length === 0 ? <EmptyState message={t("tags.none")} /> : null}
      {tags.data?.map((tag) => (
        <Pressable
          key={tag.id}
          testID={`tag-row-${tag.id}`}
          disabled={!canManage}
          onPress={() => openForm(tag)}
        >
          <Card className="mb-2 flex-row items-center">
            <View
              className="mr-3 h-4 w-4 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <Text className="flex-1 text-base text-primary">{tag.name}</Text>
            {canManage ? (
              <Pressable
                testID={`tag-delete-${tag.id}`}
                hitSlop={8}
                onPress={() => setDeleting(tag)}
              >
                <Text className="text-sm text-danger">
                  {t("common.delete")}
                </Text>
              </Pressable>
            ) : null}
          </Card>
        </Pressable>
      ))}

      {rows.length > 0 ? (
        <>
          <Text className="mb-2 mt-4 text-sm font-medium text-muted-foreground">
            {t("tags.summary")}
          </Text>
          {rows.map((row) => (
            <Card key={row.tag_id ?? "untagged"} className="mb-2">
              <View className="flex-row items-center">
                <View
                  className="mr-2 h-3 w-3 rounded-full"
                  style={{ backgroundColor: row.tag_color ?? "#d4d4d4" }}
                />
                <Text className="flex-1 text-base font-medium text-primary">
                  {row.tag_name ?? t("tags.untagged")}
                </Text>
                <Text className="text-base font-semibold text-primary">
                  {formatMoney(row.labor_cost + row.expense_total)}
                </Text>
              </View>
              <Text className="mt-1 text-xs text-muted-foreground">
                {t("tags.summaryLine", {
                  labor: formatMoney(row.labor_cost),
                  entries: row.labor_entry_count,
                  expenses: formatMoney(row.expense_total),
                  invoices: row.invoice_count,
                })}
              </Text>
            </Card>
          ))}
        </>
      ) : null}

      <Sheet
        ref={sheet}
        title={editing ? t("tags.edit") : t("tags.create")}
        snapPoints={["55%"]}
      >
        <View className="p-4">
          <Input
            testID="tag-name"
            label={t("tags.name")}
            value={name}
            onChangeText={setName}
            error={nameError}
            autoFocus
          />
          <Text className="mb-2 text-sm text-muted-foreground">
            {t("tags.color")}
          </Text>
          <View className="mb-4 flex-row flex-wrap">
            {TAG_COLORS.map((option) => (
              <Pressable
                key={option}
                testID={`tag-color-${option}`}
                onPress={() => setColor(option)}
                className={`mb-2 mr-2 h-9 w-9 rounded-full ${option === color ? "border-4 border-primary" : ""}`}
                style={{ backgroundColor: option }}
              />
            ))}
          </View>
          <Button
            testID="tag-submit"
            label={t("common.save")}
            loading={createTag.isPending || updateTag.isPending}
            onPress={submit}
          />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={deleting !== null}
        title={t("tags.deleteConfirm", { name: deleting?.name ?? "" })}
        message={t("tags.deleteHint")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={deleteTag.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          deleteTag.mutate(
            { tagId: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </ScrollView>
  );
}
