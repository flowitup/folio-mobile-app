import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { downloadAndShare } from "@/lib/files/download";
import type { PickedFile } from "@/lib/files/pick";
import { uploadMultipart } from "@/lib/files/upload";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";
import type {
  CreateInvoicePayload,
  Invoice,
  InvoiceAttachment,
  InvoiceExportFormat,
  InvoiceType,
  RefundableStatus,
  RefundedBy,
  UpdateInvoicePayload,
} from "./invoice-types";

/** List envelope (invoices/invoice_routes.py) — the purse totals feed the summary header. */
export type InvoiceListResponse = {
  invoices: Invoice[];
  total: number;
  company_name?: string | null;
  company_spent_total?: number;
  personal_spent_total?: number;
  funds_released_total?: number;
  funds_released_company_total?: number;
  funds_released_personal_total?: number;
};

export type InvoiceListFilters = {
  type?: InvoiceType;
  tagId?: string | null;
  serviceMonth?: string | null;
  workerId?: string | null;
};

export type PaymentMethod = {
  id: string;
  label: string;
  is_active: boolean;
  is_company_payment?: boolean;
  is_personal_payment?: boolean;
};

export type Worker = components["schemas"]["WorkerResponse"];
export type LaborPaymentsSummary =
  components["schemas"]["LaborPaymentsSummarySchema"];

export const invoiceKeys = {
  list: (projectId: string, filters: InvoiceListFilters = {}) =>
    [
      "projects",
      projectId,
      "invoices",
      filters.type ?? "all",
      filters.tagId ?? "",
      filters.serviceMonth ?? "",
      filters.workerId ?? "",
    ] as const,
  all: (projectId: string) => ["projects", projectId, "invoices"] as const,
  detail: (projectId: string, invoiceId: string) =>
    ["projects", projectId, "invoice", invoiceId] as const,
  attachments: (projectId: string, invoiceId: string) =>
    ["projects", projectId, "invoice", invoiceId, "attachments"] as const,
  laborPayments: (projectId: string) =>
    ["projects", projectId, "labor-payments-summary"] as const,
  paymentMethods: (companyId: string) =>
    ["companies", companyId, "payment-methods"] as const,
  workers: (projectId: string) => ["projects", projectId, "workers"] as const,
};

export function useInvoices(
  projectId: string,
  filters: InvoiceListFilters = {},
) {
  return useQuery({
    queryKey: invoiceKeys.list(projectId, filters),
    queryFn: async () =>
      unwrapAs<InvoiceListResponse>(
        await api.GET("/api/v1/projects/{project_id}/invoices", {
          params: {
            path: { project_id: projectId },
            query: {
              type: filters.type,
              tag_id: filters.tagId ?? undefined,
              service_month: filters.serviceMonth ?? undefined,
              worker_id: filters.workerId ?? undefined,
            } as never,
          },
        }),
      ),
  });
}

export function useInvoice(projectId: string, invoiceId: string | undefined) {
  return useQuery({
    queryKey: invoiceKeys.detail(projectId, invoiceId ?? ""),
    enabled: Boolean(invoiceId),
    queryFn: async () =>
      unwrapAs<Invoice>(
        await api.GET("/api/v1/projects/{project_id}/invoices/{invoice_id}", {
          params: { path: { project_id: projectId, invoice_id: invoiceId! } },
        }),
      ),
  });
}

export function useCreateInvoice(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<CreateInvoicePayload, Invoice>({
    mutationFn: async (body) =>
      unwrapAs<Invoice>(
        await api.POST("/api/v1/projects/{project_id}/invoices", {
          params: { path: { project_id: projectId } },
          body: body as never,
        }),
      ),
    invalidates: [invoiceKeys.all(projectId), ["projects", projectId]],
    successMessage: t("invoices.created"),
  });
}

export function useUpdateInvoice(projectId: string, invoiceId: string) {
  const { t } = useTranslation();
  return useApiMutation<UpdateInvoicePayload, Invoice>({
    mutationFn: async (body) =>
      unwrapAs<Invoice>(
        await api.PUT("/api/v1/projects/{project_id}/invoices/{invoice_id}", {
          params: { path: { project_id: projectId, invoice_id: invoiceId } },
          body: body as never,
        }),
      ),
    invalidates: [
      invoiceKeys.all(projectId),
      invoiceKeys.detail(projectId, invoiceId),
      ["projects", projectId],
    ],
    successMessage: t("common.saved"),
  });
}

export function useDeleteInvoice(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ invoiceId: string }>({
    mutationFn: async ({ invoiceId }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/projects/{project_id}/invoices/{invoice_id}",
          {
            params: { path: { project_id: projectId, invoice_id: invoiceId } },
          },
        ),
      ),
    invalidates: [invoiceKeys.all(projectId), ["projects", projectId]],
    successMessage: t("invoices.deleted"),
  });
}

/** Materials & services refund workflow (transfer to company payment / mark refunded). */
export function useSetRefundableStatus(projectId: string) {
  const { t } = useTranslation();
  return useApiMutation<{
    invoiceId: string;
    status: RefundableStatus | null;
    refundedBy?: RefundedBy | null;
  }>({
    mutationFn: async ({ invoiceId, status, refundedBy }) =>
      unwrapAs<Invoice>(
        await api.PATCH("/api/v1/billing/materials-expenses/{invoice_id}", {
          params: { path: { invoice_id: invoiceId } },
          body: {
            refundable_status: status,
            refunded_by: refundedBy ?? undefined,
          } as never,
        }),
      ),
    invalidates: [invoiceKeys.all(projectId), ["projects", projectId]],
    successMessage: t("invoices.refundStatusUpdated"),
  });
}

// ---- attachments -----------------------------------------------------------

export function useInvoiceAttachments(
  projectId: string,
  invoiceId: string | undefined,
) {
  return useQuery({
    queryKey: invoiceKeys.attachments(projectId, invoiceId ?? ""),
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      // The API returns a bare array today; tolerate an envelope in case it gets one.
      const data = unwrapAs<
        InvoiceAttachment[] | { attachments?: InvoiceAttachment[] }
      >(
        await api.GET(
          "/api/v1/projects/{project_id}/invoices/{invoice_id}/attachments",
          {
            params: { path: { project_id: projectId, invoice_id: invoiceId! } },
          },
        ),
      );
      return Array.isArray(data) ? data : (data.attachments ?? []);
    },
  });
}

export function useUploadAttachment(projectId: string, invoiceId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ file: PickedFile }, InvoiceAttachment>({
    mutationFn: ({ file }) =>
      uploadMultipart<InvoiceAttachment>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/invoices/${encodeURIComponent(invoiceId)}/attachments`,
        [{ field: "file", file }],
      ),
    invalidates: [invoiceKeys.attachments(projectId, invoiceId)],
    successMessage: t("invoices.attachments.uploaded"),
  });
}

export function useRenameAttachment(projectId: string, invoiceId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ attachmentId: string; filename: string }>({
    mutationFn: async ({ attachmentId, filename }) =>
      unwrapAs<InvoiceAttachment>(
        await api.PATCH("/api/v1/attachments/{attachment_id}/rename", {
          params: { path: { attachment_id: attachmentId } },
          body: { filename } as never,
        }),
      ),
    invalidates: [invoiceKeys.attachments(projectId, invoiceId)],
    successMessage: t("common.saved"),
  });
}

export function useDeleteAttachment(projectId: string, invoiceId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ attachmentId: string }>({
    mutationFn: async ({ attachmentId }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/attachments/{attachment_id}", {
          params: { path: { attachment_id: attachmentId } },
        }),
      ),
    invalidates: [invoiceKeys.attachments(projectId, invoiceId)],
    successMessage: t("invoices.attachments.deleted"),
  });
}

/** Opens the attachment in the OS share/preview sheet. */
export function openAttachment(attachment: InvoiceAttachment): Promise<string> {
  return downloadAndShare(
    `/api/v1/attachments/${encodeURIComponent(attachment.id)}/download`,
    attachment.filename,
  );
}

// ---- export / summaries / lookups -------------------------------------------

export function exportInvoices(
  projectId: string,
  format: InvoiceExportFormat,
  from: string,
  to: string,
  type?: InvoiceType,
) {
  const query = new URLSearchParams({ from, to, format });
  if (type) query.set("type", type);
  return downloadAndShare(
    `/api/v1/projects/${encodeURIComponent(projectId)}/invoices-export?${query.toString()}`,
    `invoices-${from}-${to}.${format}`,
  );
}

export function useLaborPaymentsSummary(projectId: string, enabled = true) {
  return useQuery({
    queryKey: invoiceKeys.laborPayments(projectId),
    enabled,
    queryFn: async () =>
      unwrapAs<LaborPaymentsSummary>(
        await api.GET("/api/v1/projects/{project_id}/labor-payments-summary", {
          params: { path: { project_id: projectId } },
        }),
      ),
  });
}

export function usePaymentMethods(companyId: string | null | undefined) {
  return useQuery({
    queryKey: invoiceKeys.paymentMethods(companyId ?? ""),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const data = unwrapAs<{ items?: PaymentMethod[] }>(
        await api.GET("/api/v1/companies/{company_id}/payment-methods", {
          params: { path: { company_id: companyId! } },
        }),
      );
      return data.items ?? [];
    },
  });
}

export function useWorkers(projectId: string) {
  return useQuery({
    queryKey: invoiceKeys.workers(projectId),
    queryFn: async () => {
      const data = unwrapAs<{ workers?: Worker[] }>(
        await api.GET("/api/v1/projects/{project_id}/workers", {
          params: { path: { project_id: projectId } },
        }),
      );
      return data.workers ?? [];
    },
  });
}
