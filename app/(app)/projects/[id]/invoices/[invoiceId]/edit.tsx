import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator } from "react-native";

import { InvoiceForm } from "@/features/invoices/invoice-form";
import { useInvoice, useUpdateInvoice } from "@/features/invoices/invoices-api";
import { useProject } from "@/features/projects/projects-api";

export default function EditInvoiceScreen() {
  const { id, invoiceId } = useLocalSearchParams<{
    id: string;
    invoiceId: string;
  }>();
  const router = useRouter();
  const project = useProject(id);
  const invoice = useInvoice(id, invoiceId);
  const update = useUpdateInvoice(id, invoiceId);

  if (!invoice.data) return <ActivityIndicator className="mt-8" />;

  return (
    <InvoiceForm
      projectId={id}
      companyId={project.data?.company_id}
      initial={invoice.data}
      submitting={update.isPending}
      onSubmit={(payload) =>
        update.mutate(payload, { onSuccess: () => router.back() })
      }
    />
  );
}
