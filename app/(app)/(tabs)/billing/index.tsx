import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { Segmented } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Card, EmptyState, ErrorState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { useBillingDocuments } from "@/features/billing/billing-documents-api";
import type {
  BillingDocumentKind,
  BillingDocumentStatus,
} from "@/features/billing/billing-types";
import { useBillingAccess } from "@/features/companies/companies-api";
import {
  STATUSES_BY_KIND,
  statusLabelKey,
} from "@/lib/billing/billing-status-transitions";
import { formatMoney } from "@/lib/format/money";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens } from "@/theme/tokens";

const SEARCH_DEBOUNCE_MS = 300;

/** Keeps the focus hook's dependency stable while the caller has no access to the list. */
const NOOP_REFETCH = () => {};

/** Status colors of the 2a list: sent warning, accepted / paid positive, overdue negative, rest muted. */
const STATUS_CLASS: Record<BillingDocumentStatus, string> = {
  draft: "text-muted",
  sent: "text-warning",
  accepted: "text-positive",
  rejected: "text-negative",
  expired: "text-muted",
  paid: "text-positive",
  overdue: "text-negative",
  cancelled: "text-muted",
};

/** `dd/mm/yyyy` mono date of the billing list rows (RFC-1123 or ISO input). */
function longDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${String(parsed.getUTCDate()).padStart(2, "0")}/${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${parsed.getUTCFullYear()}`;
}

/** Báo giá & hóa đơn: segmented kind, search + status filter, list card, footer actions. */
export default function BillingHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const tokens = useTokens();
  const access = useBillingAccess();
  const [kind, setKind] = useState<BillingDocumentKind>("devis");
  const [status, setStatus] = useState<BillingDocumentStatus | null>(null);
  const [search, setSearch] = useState("");
  // Two companies can both have a FAC-2026-001: with several, each row names its issuer and the
  // list can be narrowed to one company.
  const issuerCompanies = access.companies.filter((c) => c.role === "admin");
  const multiCompany = issuerCompanies.length > 1;
  const [companyId, setCompanyId] = useState<string | null>(null);
  // The API searches every page (`q`); wait for a typing pause before asking it.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useBillingDocuments(
    kind,
    status,
    access.allowed,
    companyId,
    query,
  );
  // `refetch()` fetches even a disabled query, so the focus hook has to respect the gate too —
  // otherwise a refused caller re-issues the company-wide query every time the screen regains
  // focus, which is exactly what `enabled` is there to prevent.
  useRefetchOnFocus(access.allowed ? list.refetch : NOOP_REFETCH);

  const needle = search.trim().toLowerCase();
  // While a new search, kind or status loads, the previous result stays on screen: narrow it
  // to what the new request will return so typing and switching feel immediate.
  const stale = list.isPlaceholderData;
  const documents = useMemo(() => {
    const all = list.data?.pages.flatMap((page) => page.items) ?? [];
    return all.filter(
      (d) =>
        (!stale ||
          (d.kind === kind &&
            (status === null || d.status === status) &&
            (companyId === null || d.company_id === companyId))) &&
        (!needle ||
          d.document_number.toLowerCase().includes(needle) ||
          d.recipient_name.toLowerCase().includes(needle)),
    );
  }, [list.data, needle, kind, status, companyId, stale]);
  const searching = needle !== query.toLowerCase() || stale;

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("shell.billingTitle")} back />
      {access.loading ? (
        <ActivityIndicator className="mt-8" color={tokens.ink} />
      ) : null}
      {!access.loading && !access.allowed ? (
        <EmptyState message={t("billing.accessDenied")} />
      ) : null}
      {access.allowed ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-6 pt-3.5"
          contentContainerStyle={{ gap: 16 }}
        >
          <Segmented<BillingDocumentKind>
            testID="billing-kind"
            size="sm"
            value={kind}
            onChange={(value) => {
              setKind(value);
              setStatus(null);
            }}
            options={[
              { value: "devis", label: t("billing.devis") },
              { value: "facture", label: t("billing.factures") },
            ]}
          />
          {multiCompany ? (
            <Select
              testID="billing-company"
              compact
              value={companyId ?? "__all__"}
              options={[
                { value: "__all__", label: t("billing.list.allCompanies") },
                ...issuerCompanies.map((c) => ({
                  value: c.id,
                  label: c.legal_name,
                })),
              ]}
              onChange={(value) =>
                setCompanyId(value === "__all__" ? null : value)
              }
            />
          ) : null}
          {/* The actions lead the screen: as a list footer, "+ New" sank below the fold and
              under the floating tab bar once a company had more than a handful of documents. */}
          <View className="flex-row gap-2">
            <Pressable
              testID="billing-templates"
              accessibilityRole="button"
              onPress={() => router.push("/billing/templates")}
              className="h-10 flex-1 items-center justify-center rounded-[9px] border border-line-2 active:opacity-70"
            >
              <Text className="font-sans-medium text-[13px] text-ink">
                {t("billing.list.templates")}
              </Text>
            </Pressable>
            <Pressable
              testID="billing-refundable"
              accessibilityRole="button"
              onPress={() => router.push("/billing/refundable")}
              className="h-10 flex-1 items-center justify-center rounded-[9px] border border-line-2 active:opacity-70"
            >
              <Text
                className="font-sans-medium text-[13px] text-ink"
                numberOfLines={1}
              >
                {t("billing.list.refundable")}
              </Text>
            </Pressable>
            <Pressable
              testID="billing-new"
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/billing/documents/new",
                  params: { kind },
                })
              }
              className="h-10 flex-1 items-center justify-center rounded-[9px] bg-ink active:opacity-70"
            >
              <Text className="font-sans-semibold text-[13px] text-on-ink">
                + {t("billing.list.new")}
              </Text>
            </Pressable>
          </View>
          <Pressable
            testID="billing-import"
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/billing/documents/new",
                params: { kind, mode: "import" },
              })
            }
            className="items-center active:opacity-70"
          >
            <Text className="font-sans text-xs text-accent-ink">
              {t("billing.list.import")} ›
            </Text>
          </Pressable>
          <View className="flex-row gap-1.5">
            <View className="h-[38px] flex-1 flex-row items-center gap-2 rounded-[9px] border border-line-2 bg-card px-3">
              <Icon name="search" size={14} color={tokens.muted} />
              <TextInput
                testID="billing-search"
                className="flex-1 font-sans text-[13px] text-ink"
                placeholder={t("billing.list.searchPlaceholder")}
                placeholderTextColor={tokens.muted}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
            </View>
            <Select
              testID="billing-status"
              compact
              value={status ?? "__all__"}
              options={[
                { value: "__all__", label: t("billing.list.allStatuses") },
                ...STATUSES_BY_KIND[kind].map((value) => ({
                  value,
                  label: t(`billing.status.${statusLabelKey(kind, value)}`),
                })),
              ]}
              onChange={(value) =>
                setStatus(
                  value === "__all__" ? null : (value as BillingDocumentStatus),
                )
              }
            />
          </View>

          {list.isPending || searching ? (
            <ActivityIndicator className="mt-4" color={tokens.ink} />
          ) : null}
          {list.isError ? (
            <ErrorState
              message={t("common.loadError")}
              retryLabel={t("common.retry")}
              onRetry={() => void list.refetch()}
            />
          ) : null}
          {list.data && documents.length === 0 && !searching ? (
            <EmptyState
              message={
                needle ? t("billing.list.noResults") : t("billing.list.none")
              }
            />
          ) : null}
          {documents.length > 0 ? (
            <Card
              padded={false}
              className="overflow-hidden"
              testID="billing-list"
            >
              {documents.map((doc) => (
                <Pressable
                  key={doc.id}
                  testID={`billing-doc-${doc.id}`}
                  accessibilityRole="button"
                  onPress={() => router.push(`/billing/documents/${doc.id}`)}
                  className="border-b border-line px-3.5 py-2.5 active:opacity-70"
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text
                      className="min-w-0 flex-1 font-sans-medium text-[14px] text-ink"
                      numberOfLines={1}
                    >
                      {doc.recipient_name}
                    </Text>
                    <Text className="font-mono-regular text-[14px] text-ink">
                      {formatMoney(doc.total_ttc)}
                    </Text>
                  </View>
                  {multiCompany ? (
                    <Text
                      testID={`billing-doc-issuer-${doc.id}`}
                      className="font-sans text-[12px] text-muted"
                      numberOfLines={1}
                    >
                      {doc.issuer_legal_name}
                    </Text>
                  ) : null}
                  <View className="mt-0.5 flex-row items-center justify-between gap-3">
                    <Text className="font-mono-regular text-[11.5px] text-muted">
                      {doc.document_number} · {longDate(doc.issue_date)}
                    </Text>
                    <Text
                      className={`font-sans-semibold text-[11px] uppercase tracking-[0.44px] ${STATUS_CLASS[doc.status]}`}
                    >
                      {t(
                        `billing.status.${statusLabelKey(doc.kind, doc.status)}`,
                      )}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : null}
          {list.hasNextPage && !searching ? (
            <Button
              testID="billing-load-more"
              label={t("billing.list.loadMore")}
              variant="secondary"
              size="sm"
              loading={list.isFetchingNextPage}
              onPress={() => void list.fetchNextPage()}
            />
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}
