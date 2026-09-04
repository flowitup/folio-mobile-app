import { useTranslation } from "react-i18next";

import { api } from "@/api/client";
import { invoiceKeys } from "@/features/invoices/invoices-api";
import type { PaymentMethod } from "@/features/invoices/invoices-api";
import { unwrapAs, unwrapVoid } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

export { usePaymentMethods } from "@/features/invoices/invoices-api";

export type UpdatePaymentMethodPayload = {
  label?: string;
  is_active?: boolean;
  is_company_payment?: boolean;
  is_personal_payment?: boolean;
};

const invalidates = (companyId: string) => [
  invoiceKeys.paymentMethods(companyId),
];

export function useCreatePaymentMethod(companyId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ label: string }, PaymentMethod>({
    mutationFn: async (body) =>
      unwrapAs<PaymentMethod>(
        await api.POST("/api/v1/companies/{company_id}/payment-methods", {
          params: { path: { company_id: companyId } },
          body: body as never,
        }),
      ),
    invalidates: invalidates(companyId),
    successMessage: t("common.saved"),
  });
}

export function useUpdatePaymentMethod(companyId: string) {
  const { t } = useTranslation();
  return useApiMutation<
    { id: string } & UpdatePaymentMethodPayload,
    PaymentMethod
  >({
    mutationFn: async ({ id, ...body }) =>
      unwrapAs<PaymentMethod>(
        await api.PATCH(
          "/api/v1/companies/{company_id}/payment-methods/{payment_method_id}",
          {
            params: { path: { company_id: companyId, payment_method_id: id } },
            body: body as never,
          },
        ),
      ),
    invalidates: invalidates(companyId),
    successMessage: t("common.saved"),
  });
}

/** Soft delete: the method disappears from pickers but stays on historical invoices. */
export function useDeletePaymentMethod(companyId: string) {
  const { t } = useTranslation();
  return useApiMutation<{ id: string }>({
    mutationFn: async ({ id }) =>
      unwrapVoid(
        await api.DELETE(
          "/api/v1/companies/{company_id}/payment-methods/{payment_method_id}",
          {
            params: { path: { company_id: companyId, payment_method_id: id } },
          },
        ),
      ),
    invalidates: invalidates(companyId),
    successMessage: t("common.saved"),
  });
}
