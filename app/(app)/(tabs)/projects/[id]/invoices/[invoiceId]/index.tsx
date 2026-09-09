import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InkSheetScreen } from "@/components/ui/ink-sheet-screen";
import { showToast } from "@/components/ui/toast";
import {
  InvoiceDetailActions,
  RefundPromptBanner,
} from "@/features/invoices/detail/invoice-detail-actions";
import { InvoiceAttachmentsCard } from "@/features/invoices/detail/invoice-detail-attachments";
import {
  InvoiceDetailHeader,
  InvoiceDetailHero,
} from "@/features/invoices/detail/invoice-detail-hero";
import { InvoiceInfoCard } from "@/features/invoices/detail/invoice-detail-info-card";
import { InvoiceLinesCard } from "@/features/invoices/detail/invoice-detail-lines-card";
import { InvoiceHighlightRow } from "@/features/invoices/detail/invoice-highlight-row";
import {
  useDeleteInvoice,
  useInvoice,
  useSetRefundableStatus,
  useUpdateInvoice,
} from "@/features/invoices/invoices-api";
import { projectCan, useProject } from "@/features/projects/projects-api";
import { buildInvoicePrintHtml } from "@/lib/invoices/invoice-print-html";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { INK_BLOCK } from "@/theme/tokens";

/**
 * Chi tiết hoá đơn (design 1b): ink header + hero (total, recipient, status), then the paper
 * sheet — round actions, refund prompt, lines, details, attachments, highlight palette.
 */
export default function InvoiceDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, invoiceId } = useLocalSearchParams<{
    id: string;
    invoiceId: string;
  }>();
  const { user } = useAuth();
  const project = useProject(id);
  const invoice = useInvoice(id, invoiceId);
  // Every write on this screen needs project:manage_invoices (the backend answers 403 otherwise);
  // a member reaching the detail through a push or a deep link gets a read-only sheet.
  const canManage = projectCan(
    project.data,
    "project:manage_invoices",
    user?.permissions,
  );
  const update = useUpdateInvoice(id, invoiceId);
  const remove = useDeleteInvoice(id);
  const setRefundable = useSetRefundableStatus(id);
  const addSheet = useRef<BottomSheetModal>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [printing, setPrinting] = useState(false);

  const goBack = () =>
    router.canGoBack()
      ? router.back()
      : router.navigate("/(app)/(tabs)/expenses");

  async function printPdf() {
    if (!invoice.data) return;
    setPrinting(true);
    try {
      const html = buildInvoicePrintHtml(
        invoice.data,
        project.data ? projectDisplayName(project.data) : "",
        {
          title: t("invoices.print.title"),
          issueDate: t("invoices.form.issueDate"),
          recipient: t("invoices.form.recipient"),
          description: t("invoices.form.description"),
          quantity: t("invoices.form.quantity"),
          unitPrice: t("invoices.form.unitPrice"),
          vatRate: t("invoices.form.vatRate"),
          total: t("invoices.total"),
          totalHt: t("invoices.totalHt"),
          totalTva: t("invoices.totalTva"),
          totalTtc: t("invoices.totalTtc"),
          notes: t("invoices.form.notes"),
        },
      );
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          UTI: "com.adobe.pdf",
          mimeType: "application/pdf",
        });
    } catch (caught) {
      showToast((caught as Error).message, "error");
    } finally {
      setPrinting(false);
    }
  }

  if (invoice.isPending)
    return (
      <View className="flex-1 items-center justify-center bg-ink-block">
        <ActivityIndicator color={INK_BLOCK.text} />
      </View>
    );
  // A failed refetch keeps showing the cached invoice; only a miss with nothing cached is an error.
  if (!invoice.data)
    return (
      <View className="flex-1 bg-paper">
        <Text className="p-4 text-danger">{t("home.loadError")}</Text>
      </View>
    );

  const data = invoice.data;
  const canTransferToCompany =
    canManage &&
    data.type === "materials_services" &&
    !data.refundable_status &&
    Boolean(project.data?.company_id);
  const awaitingRefund =
    canManage &&
    Boolean(data.refundable_status) &&
    data.refundable_status !== "refunded";

  return (
    <>
      <InkSheetScreen
        header={<InvoiceDetailHeader invoice={data} onBack={goBack} />}
        hero={<InvoiceDetailHero invoice={data} />}
      >
        <InvoiceDetailActions
          printing={printing}
          canManage={canManage}
          onPrint={() => void printPdf()}
          onAttach={() => addSheet.current?.present()}
          onEdit={() =>
            router.push(`/projects/${id}/invoices/${invoiceId}/edit`)
          }
          onDelete={() => setConfirmDelete(true)}
        />
        {canTransferToCompany ? (
          <RefundPromptBanner
            testID="invoice-transfer-company"
            question={t("invoices.detail.transferPrompt")}
            action={t("invoices.detail.transferConfirm")}
            loading={setRefundable.isPending}
            onPress={() =>
              setRefundable.mutate({ invoiceId, status: "refundable" })
            }
          />
        ) : null}
        {awaitingRefund ? (
          <RefundPromptBanner
            testID="invoice-mark-refunded"
            question={t("invoices.detail.refundPrompt")}
            action={t("invoices.detail.refundConfirm")}
            loading={setRefundable.isPending}
            onPress={() =>
              setRefundable.mutate({
                invoiceId,
                status: "refunded",
                refundedBy: "company",
              })
            }
          />
        ) : null}
        <InvoiceLinesCard items={data.items} />
        <InvoiceInfoCard invoice={data} />
        <InvoiceAttachmentsCard
          projectId={id}
          invoiceId={invoiceId}
          addSheet={addSheet}
          readOnly={!canManage}
        />
        <InvoiceHighlightRow
          value={data.highlight_color}
          disabled={!canManage}
          onChange={(color) => update.mutate({ highlight_color: color })}
        />
      </InkSheetScreen>
      <ConfirmDialog
        visible={confirmDelete}
        title={t("invoices.deleteConfirm", { number: data.invoice_number })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(
            { invoiceId },
            {
              onSuccess: () => router.back(),
              onSettled: () => setConfirmDelete(false),
            },
          )
        }
      />
    </>
  );
}
