import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Card } from "@/components/ui/primitives";
import { Eyebrow } from "@/components/ui/typography";
import type { Invoice } from "@/features/invoices/invoice-types";
import { formatMoney } from "@/lib/format/money";
import { invoiceTotals, lineTotalTtc } from "@/lib/invoices/invoice-totals";

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View
      className={`flex-row justify-between ${strong ? "border-t border-ink pb-3.5 pt-3" : "py-1"}`}
    >
      <Text
        className={
          strong
            ? "font-sans-semibold text-[15px] leading-[18px] text-ink"
            : "font-sans text-[13px] leading-[18px] text-muted"
        }
      >
        {label}
      </Text>
      <Text
        className={
          strong
            ? "font-mono-semibold text-[15px] text-ink"
            : "font-mono-regular text-[13px] text-muted"
        }
      >
        {value}
      </Text>
    </View>
  );
}

/** 1b "Dòng" card (r20): one row per item — description, `120 × 47,50 · VAT 20 %`, mono total — then HT / VAT / TTC. */
export function InvoiceLinesCard({ items }: { items: Invoice["items"] }) {
  const { t } = useTranslation();
  const totals = invoiceTotals(items);
  return (
    <Card
      radius={20}
      elevated
      padded={false}
      className="px-4 pt-3"
      testID="invoice-lines"
    >
      <Eyebrow className="pb-2">{t("invoices.form.items")}</Eyebrow>
      {items.map((item, index) => (
        <View
          key={index}
          className="flex-row items-center gap-3 border-t border-line py-2.5"
        >
          <View className="min-w-0 flex-1">
            <Text className="font-sans text-[14px] leading-[18px] text-ink">
              {item.description}
            </Text>
            <Text className="mt-0.5 font-mono-regular text-[11.5px] leading-[14px] text-muted">
              {item.quantity} × {formatMoney(item.unit_price)} ·{" "}
              {t("invoices.tvaShort")} {item.vat_rate ?? 0} %
            </Text>
          </View>
          <Text className="font-mono text-[14px] text-ink">
            {formatMoney(lineTotalTtc(item))}
          </Text>
        </View>
      ))}
      <View className="border-t border-line pt-2">
        <TotalRow
          label={t("invoices.totalHt")}
          value={formatMoney(totals.ht)}
        />
        <TotalRow
          label={t("invoices.totalTva")}
          value={formatMoney(totals.tva)}
        />
      </View>
      <View className="mt-1">
        <TotalRow
          label={t("invoices.totalTtc")}
          value={formatMoney(totals.ttc)}
          strong
        />
      </View>
    </Card>
  );
}
