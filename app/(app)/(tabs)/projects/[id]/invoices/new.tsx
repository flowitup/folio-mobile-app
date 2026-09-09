import { useLocalSearchParams, useRouter } from "expo-router";

import { InvoiceForm } from "@/features/invoices/invoice-form";
import type { InvoiceType } from "@/features/invoices/invoice-types";
import { useCreateInvoice } from "@/features/invoices/invoices-api";
import { useProject } from "@/features/projects/projects-api";

const INVOICE_TYPES = new Set<string>([
  "released_funds",
  "labor",
  "materials_services",
  "others",
  "return",
]);
function isInvoiceType(value: string | undefined): value is InvoiceType {
  return value !== undefined && INVOICE_TYPES.has(value);
}

export default function NewInvoiceScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const project = useProject(id);
  const create = useCreateInvoice(id);

  return (
    <InvoiceForm
      projectId={id}
      companyId={project.data?.company_id}
      initialType={isInvoiceType(type) ? type : undefined}
      submitting={create.isPending}
      onSubmit={(payload) =>
        create.mutate(payload, {
          onSuccess: (created) =>
            router.replace(`/projects/${id}/invoices/${created.id}`),
        })
      }
    />
  );
}
