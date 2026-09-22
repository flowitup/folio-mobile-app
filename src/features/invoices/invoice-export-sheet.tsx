import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import { Eyebrow } from "@/components/ui/typography";
import { INVOICE_TYPES } from "@/features/invoices/invoice-form";
import type {
  InvoiceExportFormat,
  InvoiceType,
} from "@/features/invoices/invoice-types";
import { exportInvoices } from "@/features/invoices/invoices-api";
import { currentMonth } from "@/lib/format/date";
import { MAX_EXPORT_MONTHS, monthSpan } from "@/lib/labor/month-range";

type ExportType = "all" | InvoiceType;

/** "Xuất Excel / PDF" sheet of the expenses ledger: format, month range, type filter. */
export const InvoiceExportSheet = forwardRef<
  BottomSheetModal,
  { projectId: string }
>(function InvoiceExportSheet({ projectId }, ref) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<InvoiceExportFormat>("xlsx");
  const [from, setFrom] = useState(currentMonth());
  const [to, setTo] = useState(currentMonth());
  const [type, setType] = useState<ExportType>("all");
  const [exporting, setExporting] = useState(false);
  const span = useMemo(() => monthSpan(from, to), [from, to]);
  const rangeError =
    span < 1
      ? t("invoices.export.rangeInvalid")
      : span > MAX_EXPORT_MONTHS
        ? t("invoices.export.rangeTooLong", { max: MAX_EXPORT_MONTHS })
        : null;

  async function run() {
    setExporting(true);
    try {
      await exportInvoices(
        projectId,
        format,
        from,
        to,
        type === "all" ? undefined : type,
      );
      (ref as React.RefObject<BottomSheetModal | null>).current?.dismiss();
    } catch (caught) {
      showToast((caught as Error).message, "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Sheet ref={ref} title={t("invoices.export.title")} snapPoints={["70%"]}>
      <View className="p-4">
        <Select<InvoiceExportFormat>
          testID="export-format"
          label={t("invoices.export.format")}
          value={format}
          options={[
            { value: "xlsx", label: "Excel (.xlsx)" },
            { value: "pdf", label: "PDF" },
          ]}
          onChange={setFormat}
        />
        <Eyebrow className="mb-1.5">{t("invoices.export.from")}</Eyebrow>
        <MonthPicker
          testID="export-from"
          value={from}
          onChange={setFrom}
          max={to}
        />
        <Eyebrow className="mb-1.5">{t("invoices.export.to")}</Eyebrow>
        <MonthPicker
          testID="export-to"
          value={to}
          onChange={setTo}
          min={from}
        />
        <Select<ExportType>
          testID="export-type"
          label={t("invoices.form.type")}
          value={type}
          options={[
            { value: "all", label: t("invoices.all") },
            ...INVOICE_TYPES.map((value) => ({
              value,
              label: t(`invoices.types.${value}`),
            })),
          ]}
          onChange={setType}
        />
        {rangeError ? (
          <Text
            testID="export-range-error"
            className="mb-2 font-sans text-xs text-negative"
          >
            {rangeError}
          </Text>
        ) : null}
        <Button
          testID="export-run"
          label={t("invoices.export.run")}
          loading={exporting}
          disabled={rangeError !== null}
          onPress={() => void run()}
        />
      </View>
    </Sheet>
  );
});
