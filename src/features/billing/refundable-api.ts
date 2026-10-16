import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import type {
  RefundableExpense,
  RefundableStatus,
  RefundableSummary,
  RefundedBy,
} from "@/features/invoices/invoice-types";
import { unwrapAs } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

/** One page of the list; more pages load on demand ("Load more"), never a silent cut-off. */
export const REFUNDABLE_PAGE_SIZE = 50;

export const refundableKeys = {
  all: ["billing", "refundable"] as const,
  list: (refundable: boolean, companyId: string | null, q = "") =>
    ["billing", "refundable", refundable, companyId ?? "all", q] as const,
};

export type RefundableListResponse = {
  items: RefundableExpense[];
  total: number;
  summary: RefundableSummary | null;
};

async function fetchExpenses(
  refundable: boolean,
  companyId: string | null,
  offset: number,
  q: string,
) {
  return unwrapAs<RefundableListResponse>(
    await api.GET("/api/v1/billing/materials-expenses", {
      params: {
        query: {
          refundable: refundable ? "true" : "false",
          limit: REFUNDABLE_PAGE_SIZE,
          offset,
          ...(companyId ? { company_id: companyId } : {}),
          // Searched server side (number, supplier, project): rows past the first page match too.
          ...(q ? { q } : {}),
        },
      } as never,
    }),
  );
}

/** Offset of the next page, or undefined once every row is loaded. */
export function nextRefundableOffset(
  last: RefundableListResponse,
  pages: RefundableListResponse[],
): number | undefined {
  const loaded = pages.reduce((n, p) => n + p.items.length, 0);
  return last.items.length > 0 && loaded < last.total ? loaded : undefined;
}

function useExpensePages(
  refundable: boolean,
  companyId: string | null,
  enabled: boolean,
  q: string,
) {
  const search = q.trim().slice(0, 100);
  return useInfiniteQuery({
    queryKey: refundableKeys.list(refundable, companyId, search),
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchExpenses(refundable, companyId, pageParam, search),
    getNextPageParam: nextRefundableOffset,
  });
}

/** Expenses already tracked for reimbursement (+ aggregated summary, on every page). */
export function useRefundableExpenses(
  companyId: string | null = null,
  enabled = true,
) {
  return useExpensePages(true, companyId, enabled, "");
}

/** Materials & services expenses not flagged yet (the "add" picker), searched by `q`. */
export function useRefundableCandidates(
  companyId: string | null,
  enabled: boolean,
  q = "",
) {
  return useExpensePages(false, companyId, enabled, q);
}

/**
 * Set (or clear with null) the refundable status; `refundedBy` only matters for "refunded".
 * `silent` drops the per-call toast and the default error toast: a bulk caller reports once
 * for the whole batch instead of once per expense.
 */
export function useSetRefundable(silent = false) {
  const { t } = useTranslation();
  return useApiMutation<{
    invoiceId: string;
    status: RefundableStatus | null;
    refundedBy?: RefundedBy | null;
  }>({
    mutationFn: async ({ invoiceId, status, refundedBy }) =>
      unwrapAs<unknown>(
        await api.PATCH("/api/v1/billing/materials-expenses/{invoice_id}", {
          params: { path: { invoice_id: invoiceId } },
          body: {
            refundable_status: status,
            refunded_by: refundedBy ?? null,
          } as never,
        }),
      ),
    invalidates: [refundableKeys.all, ["projects"]],
    successMessage: silent ? undefined : t("common.saved"),
    onError: () => silent,
  });
}
