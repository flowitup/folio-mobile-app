import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { EmptyState, ErrorState } from "@/components/ui/primitives";
import { InvoiceForm } from "@/features/invoices/invoice-form";
import { useInvoice, useUpdateInvoice } from "@/features/invoices/invoices-api";
import { useProject, useProjects } from "@/features/projects/projects-api";
import { useProjectCan } from "@/features/projects/use-project-can";

export default function EditInvoiceScreen() {
  const { t } = useTranslation();
  const { id, invoiceId } = useLocalSearchParams<{
    id: string;
    invoiceId: string;
  }>();
  const router = useRouter();
  const project = useProject(id);
  const invoice = useInvoice(id, invoiceId);
  const update = useUpdateInvoice(id, invoiceId);
  // Same gate as the detail sheet's "Sửa": a member reaching this route by deep link
  // would otherwise fill a form the backend answers 403 to.
  const canManage = useProjectCan(id, "project:manage_invoices");
  // The scoped permission comes from the projects list; on a cold deep link it is still
  // loading, and the JWT-wide fallback must not flash the restricted message meanwhile.
  const projects = useProjects();

  if (!canManage)
    return (
      <View className="flex-1 bg-paper">
        {projects.isPending ? (
          <ActivityIndicator className="mt-8" />
        ) : (
          <EmptyState message={t("invoices.restricted")} />
        )}
      </View>
    );
  // A failed refetch keeps serving the cached invoice; only a miss with nothing cached fails.
  if (invoice.isError && !invoice.data)
    return (
      <View className="flex-1 bg-paper">
        <ErrorState
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void invoice.refetch()}
        />
      </View>
    );
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
