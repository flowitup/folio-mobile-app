import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type {
  BillingDocumentKind,
  BillingDocumentTemplate,
  CreateBillingTemplatePayload,
  UpdateBillingTemplatePayload,
} from "./billing-types";

export const templateKeys = {
  all: ["billing", "templates"] as const,
  list: (kind: BillingDocumentKind | null, companyId: string | null) =>
    [
      "billing",
      "templates",
      "list",
      kind ?? "all",
      companyId ?? "default",
    ] as const,
  detail: (id: string) => ["billing", "templates", "detail", id] as const,
};

/**
 * Templates belong to a company. Without `companyId` the API answers for the caller's primary
 * admin company, so a multi-company admin passes the company being viewed or issued from.
 */
export function useBillingTemplates(
  kind: BillingDocumentKind | null = null,
  companyId: string | null = null,
  enabled = true,
) {
  return useQuery({
    queryKey: templateKeys.list(kind, companyId),
    enabled,
    queryFn: async () =>
      unwrapAs<{ items: BillingDocumentTemplate[] }>(
        await api.GET("/api/v1/billing-document-templates", {
          params: {
            query: {
              ...(kind ? { kind } : {}),
              ...(companyId ? { company_id: companyId } : {}),
            },
          } as never,
        }),
      ).items,
  });
}

export function useBillingTemplate(id: string | undefined) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () =>
      unwrapAs<BillingDocumentTemplate>(
        await api.GET("/api/v1/billing-document-templates/{template_id}", {
          params: { path: { template_id: id! } },
        }),
      ),
  });
}

export function useCreateBillingTemplate() {
  const { t } = useTranslation();
  return useApiMutation<CreateBillingTemplatePayload, BillingDocumentTemplate>({
    mutationFn: async (body) =>
      unwrapAs<BillingDocumentTemplate>(
        await api.POST("/api/v1/billing-document-templates", {
          body: body as never,
        }),
      ),
    invalidates: [templateKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useUpdateBillingTemplate() {
  const { t } = useTranslation();
  return useApiMutation<
    { id: string } & UpdateBillingTemplatePayload,
    BillingDocumentTemplate
  >({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<BillingDocumentTemplate>(
        await api.PUT("/api/v1/billing-document-templates/{template_id}", {
          params: { path: { template_id: id } },
          body: body as never,
        }),
      ),
    invalidates: [templateKeys.all],
    successMessage: t("common.saved"),
  });
}

export function useDeleteBillingTemplate() {
  const { t } = useTranslation();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE("/api/v1/billing-document-templates/{template_id}", {
          params: { path: { template_id: id } },
        }),
      ),
    invalidates: [templateKeys.all],
    successMessage: t("billing.templates.deleted"),
  });
}
