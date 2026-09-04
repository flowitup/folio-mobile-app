import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/primitives";
import {
  ProjectFormSheet,
  toUpdateBody,
} from "@/features/projects/project-form-sheet";
import type { ProjectFormSheetHandle } from "@/features/projects/project-form-sheet";
import {
  projectCan,
  useDeleteProject,
  useProject,
  useUpdateProject,
} from "@/features/projects/projects-api";
import { formatMoney } from "@/lib/format/money";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="py-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-base text-primary">{value || "—"}</Text>
    </View>
  );
}

/** Project settings: the editable fields of the web settings page, plus delete. */
export default function ProjectSettingsSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const project = useProject(id);
  const update = useUpdateProject(id);
  const remove = useDeleteProject(id);
  const form = useRef<ProjectFormSheetHandle>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (project.isPending) return <ActivityIndicator className="mt-8" />;
  if (project.isError || !project.data)
    return <Text className="p-4 text-danger">{t("home.loadError")}</Text>;

  const data = project.data;
  const canEdit =
    projectCan(data, "project:update", user?.permissions) ||
    data.owner_id === user?.id;
  const canDelete =
    projectCan(data, "project:delete", user?.permissions) ||
    data.owner_id === user?.id;

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="p-4">
      <Card className="mb-4">
        <Field label={t("project.form.name")} value={data.name} />
        <Field label={t("project.form.address")} value={data.address ?? ""} />
        <Field
          label={t("project.form.budget")}
          value={data.budget != null ? formatMoney(data.budget) : ""}
        />
        <Field
          label={t("project.form.budgetSource")}
          value={data.budget_source ?? ""}
        />
        <Field
          label={t("project.form.invoicePrefix")}
          value={data.invoice_prefix ?? ""}
        />
      </Card>
      {canEdit ? (
        <Button
          testID="project-edit"
          label={t("project.edit")}
          variant="secondary"
          className="mb-3"
          onPress={() => form.current?.open()}
        />
      ) : null}
      {canDelete ? (
        <Button
          testID="project-delete"
          label={t("project.delete")}
          variant="danger"
          onPress={() => setConfirmDelete(true)}
        />
      ) : null}

      <ProjectFormSheet
        ref={form}
        project={data}
        submitting={update.isPending}
        onSubmit={(values) =>
          update.mutate(toUpdateBody(values), {
            onSuccess: () => form.current?.close(),
          })
        }
      />
      <ConfirmDialog
        visible={confirmDelete}
        title={t("project.deleteConfirmTitle", { name: data.name })}
        message={t("project.deleteConfirmMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(undefined, { onSettled: () => setConfirmDelete(false) })
        }
      />
    </ScrollView>
  );
}
