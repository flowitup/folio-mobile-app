import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/format/money";

import type { Project } from "@/features/projects/projects-api";

function Row({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-primary" testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/** Overview figures: budget, spend split, labor balance, members — same numbers as the web project card. */
export function ProjectSummaryCard({ project }: { project: Project }) {
  const { t } = useTranslation();
  const remaining =
    project.budget != null ? project.budget - (project.spent ?? 0) : null;

  return (
    <Card>
      <Text
        className="text-lg font-semibold text-primary"
        testID="project-overview-name"
      >
        {project.name}
      </Text>
      {project.address ? (
        <Text className="mb-2 text-sm text-muted-foreground">
          {project.address}
        </Text>
      ) : null}
      <Row
        label={t("project.budget")}
        value={project.budget != null ? formatMoney(project.budget) : "—"}
      />
      {project.budget_source ? (
        <Row
          label={t("project.form.budgetSource")}
          value={project.budget_source}
        />
      ) : null}
      <Row
        label={t("project.spent")}
        value={formatMoney(project.spent ?? 0)}
        testID="project-overview-spent"
      />
      {remaining != null ? (
        <Row label={t("project.remaining")} value={formatMoney(remaining)} />
      ) : null}
      <Row
        label={t("project.spentPersonal")}
        value={formatMoney(project.spent_personal ?? 0)}
      />
      <Row
        label={t("project.spentByCredits")}
        value={formatMoney(project.spent_by_credits ?? 0)}
      />
      <View className="my-2 border-t border-border" />
      <Row
        label={t("project.laborAccrued")}
        value={formatMoney(project.labor_accrued ?? 0)}
      />
      <Row
        label={t("project.laborPaid")}
        value={formatMoney(project.labor_paid ?? 0)}
      />
      <Row
        label={t("project.laborUnpaid")}
        value={formatMoney(project.labor_unpaid ?? 0)}
      />
      <View className="my-2 border-t border-border" />
      <Row label={t("project.members")} value={String(project.user_count)} />
      {project.invoice_prefix ? (
        <Row
          label={t("project.form.invoicePrefix")}
          value={project.invoice_prefix}
        />
      ) : null}
    </Card>
  );
}
