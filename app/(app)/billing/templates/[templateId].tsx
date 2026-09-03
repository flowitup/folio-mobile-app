import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BillingTemplateForm } from "@/features/billing/billing-template-form";
import {
  useBillingTemplate,
  useDeleteBillingTemplate,
  useUpdateBillingTemplate,
} from "@/features/billing/billing-templates-api";

export default function EditBillingTemplateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const query = useBillingTemplate(templateId);
  const update = useUpdateBillingTemplate();
  const remove = useDeleteBillingTemplate();
  const [deleting, setDeleting] = useState(false);
  const template = query.data;

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={template?.name ?? t("billing.templates.edit")}
        back
        right={
          template ? (
            <Button
              testID="template-delete"
              label={t("common.delete")}
              size="sm"
              variant="danger"
              onPress={() => setDeleting(true)}
            />
          ) : null
        }
      />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {query.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {query.isError ? (
          <ErrorState
            message={t("home.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {template ? (
          <BillingTemplateForm
            key={template.updated_at}
            initial={template}
            submitting={update.isPending}
            onSubmit={({ kind: _kind, ...payload }) =>
              update.mutate({ id: template.id, ...payload })
            }
          />
        ) : null}
      </ScrollView>
      <ConfirmDialog
        visible={deleting}
        title={t("billing.templates.deleteConfirm", {
          name: template?.name ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          template &&
          remove.mutate(
            { id: template.id },
            {
              onSuccess: () => {
                setDeleting(false);
                router.back();
              },
              onError: () => setDeleting(false),
            },
          )
        }
      />
    </View>
  );
}
