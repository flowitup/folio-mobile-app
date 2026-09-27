import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { EmptyState } from "@/components/ui/primitives";
import { InvoiceForm } from "@/features/invoices/invoice-form";
import type { InvoiceType } from "@/features/invoices/invoice-types";
import { useCreateInvoice } from "@/features/invoices/invoices-api";
import { useProject, useProjects } from "@/features/projects/projects-api";
import { useProjectCan } from "@/features/projects/use-project-can";

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
  const { t } = useTranslation();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const project = useProject(id);
  const create = useCreateInvoice(id);
  // The screen is reachable by deep link even for a member: writing needs
  // `project:manage_invoices`, so without it the form is replaced by the reason.
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
