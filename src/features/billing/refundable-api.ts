import { useQuery } from "@tanstack/react-query";
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

export const refundableKeys = {
  all: ["billing", "refundable"] as const,
  list: (refundable: boolean, companyId: string | null) =>
    ["billing", "refundable", refundable, companyId ?? "all"] as const,
};

type ListResponse = {
  items: RefundableExpense[];
  total: number;
  summary: RefundableSummary | null;
};

async function fetchExpenses(refundable: boolean, companyId: string | null) {
  return unwrapAs<ListResponse>(
    await api.GET("/api/v1/billing/materials-expenses", {
      params: {
        query: {
          refundable: refundable ? "true" : "false",
          // 200 is the backend max: large companies must not get a silently truncated list.
          limit: 200,
          ...(companyId ? { company_id: companyId } : {}),
        },
      } as never,
    }),
  );
}

/** Expenses already tracked for reimbursement (+ aggregated summary). */
export function useRefundableExpenses(companyId: string | null = null) {
  return useQuery({
    queryKey: refundableKeys.list(true, companyId),
    queryFn: () => fetchExpenses(true, companyId),
  });
}

/** Materials & services expenses not flagged yet (the "add" picker). */
export function useRefundableCandidates(
  companyId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: refundableKeys.list(false, companyId),
    enabled,
    queryFn: () => fetchExpenses(false, companyId),
  });
}

/** Set (or clear with null) the refundable status; `refundedBy` only matters for "refunded". */
export function useSetRefundable() {
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
    successMessage: t("common.saved"),
  });
}
