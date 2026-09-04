import { useRouter } from "expo-router";
import { useState } from "react";
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
import { EmptyState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  useBillingTemplates,
  useDeleteBillingTemplate,
} from "@/features/billing/billing-templates-api";
import type {
  BillingDocumentKind,
  BillingDocumentTemplate,
} from "@/features/billing/billing-types";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Templates grouped by kind; tap to edit, "Use" starts a document from it, long-press deletes. */
export default function BillingTemplatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const templates = useBillingTemplates();
  const remove = useDeleteBillingTemplate();
  useRefetchOnFocus(templates.refetch);
  const [deleting, setDeleting] = useState<BillingDocumentTemplate | null>(
    null,
  );

  const groups: { kind: BillingDocumentKind; label: string }[] = [
    { kind: "devis", label: t("billing.templates.devisGroup") },
    { kind: "facture", label: t("billing.templates.factureGroup") },
  ];

  return (
    <View className="flex-1 bg-card">
      <ScreenHeader
        title={t("billing.templates.title")}
        back
        right={
          <Button
            testID="template-new"
            label={`＋ ${t("billing.list.new")}`}
            size="sm"
            onPress={() => router.push("/billing/templates/new")}
          />
        }
      />
      <ScrollView contentContainerClassName="p-4 pb-12">
        {templates.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {templates.data && templates.data.length === 0 ? (
          <EmptyState message={t("billing.templates.none")} />
        ) : null}
        {groups.map(({ kind, label }) => {
          const items = (templates.data ?? []).filter((x) => x.kind === kind);
          if (items.length === 0) return null;
          return (
            <View key={kind} className="mb-4">
              <Text className="mb-2 text-base font-semibold text-primary">
                {label}
              </Text>
              {items.map((item) => (
                <Pressable key={item.id} onLongPress={() => setDeleting(item)}>
                  <ListRow
                    testID={`template-${item.id}`}
                    title={item.name}
                    subtitle={`${t("billing.templates.itemsCount", { count: item.items.length })} · ${item.default_vat_rate ? `${t("billing.templates.defaultVatRate")} ${item.default_vat_rate}` : t("billing.templates.vatRateNone")} · ${formatDate(item.updated_at)}`}
                    right={
                      <Pressable
                        testID={`template-use-${item.id}`}
                        hitSlop={8}
                        onPress={() =>
                          router.push({
                            pathname: "/billing/documents/new",
                            params: { kind: item.kind, template: item.id },
                          })
                        }
                      >
                        <Text className="text-sm text-primary">
                          {t("billing.templates.use")}
                        </Text>
                      </Pressable>
                    }
                    onPress={() => router.push(`/billing/templates/${item.id}`)}
                  />
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
      <ConfirmDialog
        visible={deleting !== null}
        title={t("billing.templates.deleteConfirm", {
          name: deleting?.name ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { id: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </View>
  );
}
