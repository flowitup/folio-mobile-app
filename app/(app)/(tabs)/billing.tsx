import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { useBillingDocuments } from "@/features/billing/billing-documents-api";
import { BillingStatusBadge } from "@/features/billing/billing-status-badge";
import type {
  BillingDocumentKind,
  BillingDocumentStatus,
} from "@/features/billing/billing-types";
import { useBillingAccess } from "@/features/companies/companies-api";
import { STATUSES_BY_KIND } from "@/lib/billing/billing-status-transitions";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Billing hub: devis / factures lists with status filter, search and load-more; links to templates, refundable, import. */
export default function BillingTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const access = useBillingAccess();
  const [kind, setKind] = useState<BillingDocumentKind>("devis");
  const [status, setStatus] = useState<BillingDocumentStatus | null>(null);
  const [search, setSearch] = useState("");
  const list = useBillingDocuments(kind, status);
  useRefetchOnFocus(list.refetch);

  const documents = useMemo(() => {
    const all = list.data?.pages.flatMap((page) => page.items) ?? [];
    const needle = search.trim().toLowerCase();
    return needle
      ? all.filter(
          (d) =>
            d.document_number.toLowerCase().includes(needle) ||
            d.recipient_name.toLowerCase().includes(needle),
        )
      : all;
  }, [list.data, search]);

  if (access.loading)
    return (
      <View className="flex-1 bg-card">
        <ScreenHeader title={t("billing.title")} />
        <ActivityIndicator className="mt-8" />
      </View>
    );
  if (!access.allowed)
    return (
      <View className="flex-1 bg-card">
        <ScreenHeader title={t("billing.title")} />
        <EmptyState message={t("billing.accessDenied")} />
      </View>
    );

  return (
    <View className="flex-1 bg-card">
      <ScreenHeader
        title={t("billing.title")}
        right={
          <Button
            testID="billing-new"
            label={`＋ ${t("billing.list.new")}`}
            size="sm"
            onPress={() =>
              router.push({
                pathname: "/billing/documents/new",
                params: { kind },
              })
            }
          />
        }
      />
      <View className="flex-row border-b border-border">
        {(["devis", "facture"] as const).map((value) => (
          <Pressable
            key={value}
            testID={`billing-kind-${value}`}
            onPress={() => {
              setKind(value);
              setStatus(null);
            }}
            className={`flex-1 items-center border-b-2 py-3 ${kind === value ? "border-primary" : "border-transparent"}`}
          >
            <Text
              className={
                kind === value
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
            >
              {t(`billing.${value === "devis" ? "devis" : "factures"}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerClassName="p-4 pb-12">
        <View className="mb-3 flex-row flex-wrap gap-2">
          <Button
            testID="billing-templates"
            label={t("billing.list.templates")}
            size="sm"
            variant="secondary"
            onPress={() => router.push("/billing/templates")}
          />
          <Button
            testID="billing-refundable"
            label={t("billing.list.refundable")}
            size="sm"
            variant="secondary"
            onPress={() => router.push("/billing/refundable")}
          />
          <Button
            testID="billing-import"
            label={t("billing.list.import")}
            size="sm"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/billing/documents/new",
                params: { kind, mode: "import" },
              })
            }
          />
        </View>
        <TextInput
          testID="billing-search"
          className="mb-3 rounded-lg border border-border px-4 py-2 text-base text-primary"
          placeholder={t("billing.list.searchPlaceholder")}
          placeholderTextColor="#a3a3a3"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        <Select
          testID="billing-status"
          value={status ?? "__all__"}
          options={[
            { value: "__all__", label: t("billing.list.allStatuses") },
            ...STATUSES_BY_KIND[kind].map((value) => ({
              value,
              label: t(`billing.status.${value}`),
            })),
          ]}
          onChange={(value) =>
            setStatus(
              value === "__all__" ? null : (value as BillingDocumentStatus),
            )
          }
        />
        {list.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {list.isError ? (
          <ErrorState
            message={t("home.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void list.refetch()}
          />
        ) : null}
        {list.data && documents.length === 0 ? (
          <EmptyState message={t("billing.list.none")} />
        ) : null}
        {documents.map((doc) => (
          <ListRow
            key={doc.id}
            testID={`billing-doc-${doc.id}`}
            title={`${doc.document_number} · ${doc.recipient_name}`}
            subtitle={`${formatDate(doc.issue_date)} · ${formatMoney(doc.total_ttc)} TTC`}
            right={<BillingStatusBadge status={doc.status} />}
            onPress={() => router.push(`/billing/documents/${doc.id}`)}
          />
        ))}
        {list.hasNextPage ? (
          <Button
            testID="billing-load-more"
            label={t("billing.list.loadMore")}
            variant="secondary"
            loading={list.isFetchingNextPage}
            onPress={() => void list.fetchNextPage()}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
