import { useLocalSearchParams, useRouter } from "expo-router";

import { InvoiceForm } from "@/features/invoices/invoice-form";
import { useCreateInvoice } from "@/features/invoices/invoices-api";
import { useProject } from "@/features/projects/projects-api";

export default function NewInvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const project = useProject(id);
  const create = useCreateInvoice(id);

  return (
    <InvoiceForm
      projectId={id}
      companyId={project.data?.company_id}
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
