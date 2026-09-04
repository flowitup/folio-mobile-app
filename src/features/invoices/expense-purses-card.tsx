import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Badge, Card } from "@/components/ui/primitives";
import { EXPENSE_TYPES } from "@/lib/dashboard/overview-metrics";
import { formatMoney } from "@/lib/format/money";
import type {
  PurseBreakdown,
  PursesSummary,
} from "@/lib/invoices/expense-purses";

type Props = {
  summary: PursesSummary;
  releasedCompany: number;
  releasedPersonal: number;
  companyName: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  labor: "#f59e0b",
  materials_services: "#171717",
  others: "#737373",
};

function PurseRows({
  title,
  released,
  breakdown,
}: {
  title: string;
  released: number;
  breakdown: PurseBreakdown;
}) {
  const { t } = useTranslation();
  const left = released - breakdown.spent;
  const pct =
    released > 0
      ? Math.min(100, Math.round((breakdown.spent / released) * 100))
      : 0;
  const max = Math.max(
    1,
    ...EXPENSE_TYPES.map((type) => Math.max(breakdown.types[type].total, 0)),
  );
  return (
    <View className="mt-3 border-t border-border pt-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-primary">{title}</Text>
        <Text
          className={`text-sm font-semibold ${left < 0 ? "text-danger" : "text-primary"}`}
        >
          {formatMoney(left)} {t("invoices.summary.left")}
        </Text>
      </View>
      <Text className="text-xs text-muted-foreground">
        {t("invoices.summary.spent")} {formatMoney(breakdown.spent)} ·{" "}
        {t("invoices.summary.ofReleased", { amount: formatMoney(released) })} ·{" "}
        {pct} % ·{" "}
        {t("invoices.invoiceCount", {
          n: breakdown.count,
          count: breakdown.count,
        })}
        {breakdown.returnsCount > 0
          ? ` · ${t("invoices.summary.refundsReceived", { n: breakdown.returnsCount })} (${formatMoney(breakdown.returnsTotal)})`
          : ""}
      </Text>
      <View className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <View
          className="h-2 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </View>
      {EXPENSE_TYPES.map((type) => {
        const bucket = breakdown.types[type];
        const width = Math.max(
          0,
          Math.round((Math.max(bucket.total, 0) / max) * 100),
        );
        return (
          <View key={type} className="mt-1 flex-row items-center gap-2">
            <Text
              className="w-32 text-xs text-muted-foreground"
              numberOfLines={1}
            >
              {t(`invoices.types.${type}`)}
            </Text>
            <View className="h-2 flex-1 overflow-hidden rounded bg-muted">
              <View
                style={{
                  width: `${width}%`,
                  height: 8,
                  backgroundColor: TYPE_COLOR[type],
                }}
              />
            </View>
            <Text className="w-24 text-right text-xs text-primary">
              {formatMoney(bucket.total)} · {bucket.count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** "Two purses" summary of the expenses page: totals, per-purse type bars, refund and avoir pills. */
export function ExpensePursesCard({
  summary,
  releasedCompany,
  releasedPersonal,
  companyName,
}: Props) {
  const { t } = useTranslation();
  const spentTotal = summary.company.spent + summary.personal.spent;
  return (
    <Card className="mb-4">
      <Text className="text-xs text-muted-foreground">
        {t("invoices.summary.totalExpenses")}
      </Text>
      <Text testID="expenses-total" className="text-2xl font-bold text-primary">
        {formatMoney(spentTotal)}
      </Text>
      <Text className="text-xs text-muted-foreground">
        {t("invoices.invoiceCount", {
          n: summary.expenseCount,
          count: summary.expenseCount,
        })}{" "}
        · {t("invoices.summary.netOfReturns")}
        {summary.returnsTotal !== 0
          ? ` (${formatMoney(summary.returnsTotal)})`
          : ""}
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-1">
        {summary.refundable.count > 0 ? (
          <Badge
            label={`${t("invoices.summary.refundableByCompany")} · ${formatMoney(summary.refundable.total)} · ${t("invoices.summary.refundableCount", { n: summary.refundable.count })}`}
            tone="warning"
          />
        ) : null}
        {summary.bankOutstanding.count > 0 ? (
          <Badge
            label={`${t("invoices.summary.refundableByBank")} · ${formatMoney(summary.bankOutstanding.total)} · ${t("invoices.summary.refundableCount", { n: summary.bankOutstanding.count })}`}
          />
        ) : null}
        {summary.outstandingAvoirs.count > 0 ? (
          <Badge
            label={`${t("invoices.summary.outstandingAvoirs", { n: summary.outstandingAvoirs.count })} · ${formatMoney(summary.outstandingAvoirs.total)}`}
            tone="success"
          />
        ) : null}
      </View>
      <PurseRows
        title={companyName ?? t("invoices.summary.companyPurse")}
        released={releasedCompany}
        breakdown={summary.company}
      />
      <PurseRows
        title={t("invoices.summary.personalPurse")}
        released={releasedPersonal}
        breakdown={summary.personal}
      />
    </Card>
  );
}
