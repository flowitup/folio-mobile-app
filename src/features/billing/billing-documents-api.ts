import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { safeFilename } from "@/lib/files/download";
import { openFile } from "@/lib/files/open-file";
import { parseIsoDate } from "@/lib/format/date";
import { ApiError, unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type {
  ActivitySuggestionsResponse,
  ApplyTemplatePayload,
  BillingDocument,
  BillingDocumentKind,
  BillingDocumentStatus,
  CloneBillingDocumentPayload,
  ConvertDevisToFacturePayload,
  CreateBillingDocumentPayload,
  ImportBillingDocumentPayload,
  UpdateBillingDocumentPayload,
} from "./billing-types";

export const PAGE_SIZE = 25;

export const billingKeys = {
  all: ["billing", "documents"] as const,
  list: (kind: BillingDocumentKind, status: BillingDocumentStatus | null) =>
    ["billing", "documents", "list", kind, status ?? "all"] as const,
  recent: ["billing", "documents", "recent"] as const,
  detail: (id: string) => ["billing", "documents", "detail", id] as const,
  suggestions: (category: string | null, q: string) =>
    ["billing", "suggestions", category ?? "", q] as const,
};

type ListResponse = { items: BillingDocument[]; total: number };

async function fetchPage(query: Record<string, string | number>) {
  return unwrapAs<ListResponse>(
    await api.GET("/api/v1/billing-documents", {
      params: { query } as never,
    }),
  );
}

/** Paged list (25 per page) with optional status filter; pages accumulate like the web "load more". */
export function useBillingDocuments(
  kind: BillingDocumentKind,
  status: BillingDocumentStatus | null,
  /** Billing is company-admin gated; a denied caller must not ask for a list the API refuses. */
  enabled = true,
) {
  return useInfiniteQuery({
    enabled,
    queryKey: billingKeys.list(kind, status),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchPage({
        kind,
        ...(status ? { status } : {}),
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
}

/**
 * Newest issue date first, then newest created. `issue_date` is RFC-1123 text
 * (`Fri, 09 Oct 2026 00:00:00 GMT`), so compare instants, not strings (those sort by weekday).
 */
export function byIssueDateDesc(
  a: Pick<BillingDocument, "issue_date" | "created_at">,
  b: Pick<BillingDocument, "issue_date" | "created_at">,
): number {
  return (
    (parseIsoDate(b.issue_date)?.getTime() ?? 0) -
      (parseIsoDate(a.issue_date)?.getTime() ?? 0) ||
    (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
  );
}

/** 25 latest devis + 25 latest factures, merged by issue date (the "from existing" picker). */
export function useRecentBillingDocuments(enabled: boolean) {
  return useQuery({
    queryKey: billingKeys.recent,
    enabled,
    queryFn: async () => {
      const [devis, factures] = await Promise.all([
        fetchPage({ kind: "devis", limit: 25 }),
        fetchPage({ kind: "facture", limit: 25 }),
      ]);
      return [...devis.items, ...factures.items]
        .sort(byIssueDateDesc)
        .slice(0, 50);
    },
  });
}

export function useBillingDocument(id: string | undefined) {
  return useQuery({
    queryKey: billingKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () =>
      unwrapAs<BillingDocument>(
        await api.GET("/api/v1/billing-documents/{doc_id}", {
          params: { path: { doc_id: id! } },
        }),
      ),
  });
}

export function useActivitySuggestions(
  category: string | null,
  q: string,
  enabled = true,
) {
  return useQuery({
    queryKey: billingKeys.suggestions(category, q),
    enabled,
    queryFn: async () =>
      unwrapAs<ActivitySuggestionsResponse>(
        await api.GET("/api/v1/billing-documents/activity-suggestions", {
          params: {
            query: {
              ...(category ? { category } : {}),
              ...(q ? { q } : {}),
              limit: 20,
            },
          } as never,
        }),
      ),
  });
}

const invalidatesAll = [["billing"]];

export function useCreateBillingDocument() {
  const { t } = useTranslation();
  return useApiMutation<CreateBillingDocumentPayload, BillingDocument>({
    mutationFn: async (body) =>
      unwrapAs<BillingDocument>(
        await api.POST("/api/v1/billing-documents", { body: body as never }),
      ),
    invalidates: invalidatesAll,
    successMessage: t("billing.toast.documentCreated"),
  });
}

export function useImportBillingDocument() {
  const { t } = useTranslation();
  return useApiMutation<ImportBillingDocumentPayload, BillingDocument>({
    mutationFn: async (body) =>
      unwrapAs<BillingDocument>(
        await api.POST("/api/v1/billing-documents/import", {
          body: body as never,
        }),
      ),
    invalidates: invalidatesAll,
    successMessage: t("billing.toast.documentCreated"),
  });
}

export function useUpdateBillingDocument() {
  const { t } = useTranslation();
  return useApiMutation<
    { id: string } & UpdateBillingDocumentPayload,
    BillingDocument
  >({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<BillingDocument>(
        await api.PUT("/api/v1/billing-documents/{doc_id}", {
          params: { path: { doc_id: id } },
          body: body as never,
        }),
      ),
    invalidates: invalidatesAll,
    successMessage: t("billing.toast.documentSaved"),
  });
}

export function useDeleteBillingDocument() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/billing-documents/{doc_id}", {
          params: { path: { doc_id: id } },
        }),
      ),
    invalidates: invalidatesAll,
    successMessage: t("billing.toast.documentDeleted"),
  });
}

export function useCloneBillingDocument() {
  return useApiMutation<
    { id: string } & CloneBillingDocumentPayload,
    BillingDocument
  >({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<BillingDocument>(
        await api.POST("/api/v1/billing-documents/{doc_id}/clone", {
          params: { path: { doc_id: id } },
          body: body as never,
        }),
      ),
    invalidates: invalidatesAll,
  });
}

export function useConvertDevisToFacture() {
  const { t } = useTranslation();
  return useApiMutation<
    { id: string } & ConvertDevisToFacturePayload,
    BillingDocument
  >({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<BillingDocument>(
        await api.POST(
          "/api/v1/billing-documents/{doc_id}/convert-to-facture",
          { params: { path: { doc_id: id } }, body: body as never },
        ),
      ),
    invalidates: invalidatesAll,
    successMessage: t("billing.toast.devisConverted"),
  });
}

export function useSetBillingStatus() {
  return useApiMutation<
    { id: string; new_status: BillingDocumentStatus },
    BillingDocument
  >({
    mutationFn: async ({ id, new_status }) =>
      unwrapAs<BillingDocument>(
        await api.PATCH("/api/v1/billing-documents/{doc_id}/status", {
          params: { path: { doc_id: id } },
          body: { new_status } as never,
        }),
      ),
    invalidates: invalidatesAll,
    // A refused transition (409) is explained by the caller in the UI language; the default
    // toast would add a second one carrying the API's raw English text.
    onError: (error) => error instanceof ApiError && error.status === 409,
  });
}

export function useCreateFromTemplate() {
  const { t } = useTranslation();
  return useApiMutation<
    { templateId: string } & ApplyTemplatePayload,
    BillingDocument
  >({
    mutationFn: async ({ templateId, ...body }) =>
      unwrapAs<BillingDocument>(
        await api.POST(
          "/api/v1/billing-documents/from-template/{template_id}",
          {
            params: { path: { template_id: templateId } },
            body: body as never,
          },
        ),
      ),
    invalidates: invalidatesAll,
    successMessage: t("billing.toast.documentCreated"),
  });
}

/** Rendered PDF opens in the in-app viewer; XLSX goes through the OS share sheet. */
export function openBillingFile(
  doc: Pick<BillingDocument, "id" | "document_number">,
  format: "pdf" | "xlsx",
) {
  return openFile(
    `/api/v1/billing-documents/${encodeURIComponent(doc.id)}/${format}`,
    safeFilename(`${doc.document_number}.${format}`),
  );
}
