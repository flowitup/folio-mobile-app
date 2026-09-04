import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge, Card } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import type {
  HighlightColor,
  InvoiceAttachment,
} from "@/features/invoices/invoice-types";
import {
  openAttachment,
  useDeleteAttachment,
  useDeleteInvoice,
  useInvoice,
  useInvoiceAttachments,
  useRenameAttachment,
  useSetRefundableStatus,
  useUpdateInvoice,
  useUploadAttachment,
} from "@/features/invoices/invoices-api";
import { useProject } from "@/features/projects/projects-api";
import { captureImage, pickDocuments, pickImages } from "@/lib/files/pick";
import type { PickResult } from "@/lib/files/pick";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { buildInvoicePrintHtml } from "@/lib/invoices/invoice-print-html";
import {
  HIGHLIGHT_COLORS,
  invoiceTotals,
  lineTotalTtc,
} from "@/lib/invoices/invoice-totals";

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between py-1">
      <Text className="pr-3 text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm text-primary">{value}</Text>
    </View>
  );
}

/** Invoice detail: rows, items, totals, attachments, print, highlight, refund transfer, edit, delete. */
export default function InvoiceDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, invoiceId } = useLocalSearchParams<{
    id: string;
    invoiceId: string;
  }>();
  const project = useProject(id);
  const invoice = useInvoice(id, invoiceId);
  const attachments = useInvoiceAttachments(id, invoiceId);
  const upload = useUploadAttachment(id, invoiceId);
  const rename = useRenameAttachment(id, invoiceId);
  const removeAttachment = useDeleteAttachment(id, invoiceId);
  const update = useUpdateInvoice(id, invoiceId);
  const remove = useDeleteInvoice(id);
  const setRefundable = useSetRefundableStatus(id);

  const addSheet = useRef<BottomSheetModal>(null);
  const renameSheet = useRef<BottomSheetModal>(null);
  const [renaming, setRenaming] = useState<InvoiceAttachment | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingAttachment, setDeletingAttachment] =
    useState<InvoiceAttachment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function handlePick(result: PickResult) {
    addSheet.current?.dismiss();
    if (result.status === "denied")
      return showToast(t("invoices.attachments.permissionDenied"), "error");
    if (result.status === "canceled") return;
    for (const file of result.files)
      await upload.mutateAsync({ file }).catch(() => undefined);
  }

  async function printPdf() {
    if (!invoice.data) return;
    setPrinting(true);
    try {
      const html = buildInvoicePrintHtml(
        invoice.data,
        project.data?.name ?? "",
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

  if (invoice.isPending) return <ActivityIndicator className="mt-8" />;
  if (invoice.isError || !invoice.data)
    return <Text className="p-4 text-danger">{t("home.loadError")}</Text>;

  const data = invoice.data;
  const totals = invoiceTotals(data.items);
  const canTransferToCompany =
    data.type === "materials_services" &&
    !data.refundable_status &&
    Boolean(project.data?.company_id);

  return (
    <ScrollView
      className="flex-1 bg-card"
      contentContainerClassName="p-4 pb-12"
    >
      <Card
        className="mb-4"
        style={{
          backgroundColor: data.highlight_color
            ? HIGHLIGHT_COLORS[data.highlight_color]
            : undefined,
        }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-primary">
            {data.invoice_number}
          </Text>
          <Badge label={t(`invoices.types.${data.type}`)} />
        </View>
        <Text
          className="mb-2 text-2xl font-bold text-primary"
          testID="invoice-detail-total"
        >
          {formatMoney(data.total_amount)}
        </Text>
        <Row
          label={t("invoices.form.issueDate")}
          value={formatDate(data.issue_date)}
        />
        <Row label={t("invoices.form.recipient")} value={data.recipient_name} />
        <Row
          label={t("invoices.form.recipientAddress")}
          value={data.recipient_address}
        />
        <Row
          label={t("invoices.form.paymentMethod")}
          value={
            data.payment_method_label ?? t("invoices.form.paymentMethodNone")
          }
        />
        <Row
          label={t("invoices.form.serviceMonth")}
          value={data.service_month?.slice(0, 7)}
        />
        <Row
          label={t("invoices.refundOf")}
          value={data.refunds_invoice_number}
        />
        <Row
          label={t("invoices.form.settledVia")}
          value={
            data.settled_via
              ? t(
                  `invoices.form.settledVia${data.settled_via === "avoir" ? "Avoir" : "Cash"}`,
                )
              : null
          }
        />
        <Row
          label={t("invoices.form.appliedTo")}
          value={data.applied_to_invoice_number}
        />
        {data.paid_with_returns?.length ? (
          <Row
            label={t("invoices.paidWithAvoir")}
            value={data.paid_with_returns
              .map(
                (r) => `${r.invoice_number} (${formatMoney(r.total_amount)})`,
              )
              .join(", ")}
          />
        ) : null}
        {data.refundable_status ? (
          <View className="mt-2 flex-row gap-1">
            <Badge
              label={t(`invoices.refund.${data.refundable_status}`)}
              tone={
                data.refundable_status === "refunded" ? "success" : "warning"
              }
            />
            {data.refunded_by ? (
              <Badge label={t(`invoices.refund.by.${data.refunded_by}`)} />
            ) : null}
          </View>
        ) : null}
        {data.notes ? (
          <Text className="mt-2 text-sm text-primary">{data.notes}</Text>
        ) : null}
      </Card>

      <Text className="mb-2 text-sm font-medium text-muted-foreground">
        {t("invoices.form.items")}
      </Text>
      {data.items.map((item, index) => (
        <Card key={index} className="mb-2">
          <Text className="text-base text-primary">{item.description}</Text>
          <Text className="text-xs text-muted-foreground">
            {item.quantity} × {formatMoney(item.unit_price)} ·{" "}
            {t("invoices.form.vatRate")} {item.vat_rate ?? 0} %
          </Text>
          <Text className="text-right text-sm font-medium text-primary">
            {formatMoney(lineTotalTtc(item))}
          </Text>
        </Card>
      ))}
      <Card className="mb-4">
        <View className="flex-row justify-between py-1">
          <Text className="text-muted-foreground">{t("invoices.totalHt")}</Text>
          <Text className="text-primary">{formatMoney(totals.ht)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-muted-foreground">
            {t("invoices.totalTva")}
          </Text>
          <Text className="text-primary">{formatMoney(totals.tva)}</Text>
        </View>
        <View className="flex-row justify-between border-t border-border py-1">
          <Text className="font-semibold text-primary">
            {t("invoices.totalTtc")}
          </Text>
          <Text className="font-semibold text-primary">
            {formatMoney(totals.ttc)}
          </Text>
        </View>
      </Card>

      <Text className="mb-2 text-sm text-muted-foreground">
        {t("invoices.form.highlight")}
      </Text>
      <View className="mb-4 flex-row flex-wrap">
        <Pressable
          testID="detail-highlight-none"
          onPress={() => update.mutate({ highlight_color: null })}
          className={`mb-2 mr-2 h-8 w-8 items-center justify-center rounded-full border ${!data.highlight_color ? "border-4 border-primary" : "border-border"}`}
        >
          <Text className="text-muted-foreground">✕</Text>
        </Pressable>
        {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => (
          <Pressable
            key={color}
            testID={`detail-highlight-${color}`}
            onPress={() => update.mutate({ highlight_color: color })}
            className={`mb-2 mr-2 h-8 w-8 rounded-full ${data.highlight_color === color ? "border-4 border-primary" : ""}`}
            style={{ backgroundColor: HIGHLIGHT_COLORS[color] }}
          />
        ))}
      </View>

      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-muted-foreground">
          {t("invoices.attachments.title", {
            count: attachments.data?.length ?? 0,
          })}
        </Text>
        <Button
          testID="attachment-add"
          label={t("invoices.attachments.add")}
          variant="secondary"
          size="sm"
          onPress={() => addSheet.current?.present()}
          loading={upload.isPending}
        />
      </View>
      {(attachments.data ?? []).map((attachment) => (
        <Card key={attachment.id} className="mb-2">
          <Pressable
            testID={`attachment-open-${attachment.id}`}
            onPress={() =>
              openAttachment(attachment).catch((e: Error) =>
                showToast(e.message, "error"),
              )
            }
          >
            <Text className="text-base text-primary" numberOfLines={1}>
              {attachment.filename}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {attachment.mime_type} ·{" "}
              {Math.round(attachment.size_bytes / 1024)} KB ·{" "}
              {formatDate(attachment.uploaded_at)}
            </Text>
          </Pressable>
          <View className="mt-2 flex-row gap-4">
            <Pressable
              testID={`attachment-rename-${attachment.id}`}
              onPress={() => {
                setRenaming(attachment);
                setRenameValue(attachment.filename);
                renameSheet.current?.present();
              }}
            >
              <Text className="text-sm text-primary">
                {t("invoices.attachments.rename")}
              </Text>
            </Pressable>
            <Pressable
              testID={`attachment-delete-${attachment.id}`}
              onPress={() => setDeletingAttachment(attachment)}
            >
              <Text className="text-sm text-danger">{t("common.delete")}</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      <View className="mt-4 gap-3">
        <Button
          testID="invoice-print"
          label={t("invoices.printPdf")}
          variant="secondary"
          loading={printing}
          onPress={() => void printPdf()}
        />
        {canTransferToCompany ? (
          <Button
            testID="invoice-transfer-company"
            label={t("invoices.transferToCompany")}
            variant="secondary"
            loading={setRefundable.isPending}
            onPress={() =>
              setRefundable.mutate({ invoiceId, status: "refundable" })
            }
          />
        ) : null}
        {data.refundable_status && data.refundable_status !== "refunded" ? (
          <Button
            testID="invoice-mark-refunded"
            label={t("invoices.markRefunded")}
            variant="secondary"
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
        <Button
          testID="invoice-edit"
          label={t("common.edit")}
          onPress={() =>
            router.push(`/projects/${id}/invoices/${invoiceId}/edit`)
          }
        />
        <Button
          testID="invoice-delete"
          label={t("common.delete")}
          variant="danger"
          onPress={() => setConfirmDelete(true)}
        />
      </View>

      <Sheet
        ref={addSheet}
        title={t("invoices.attachments.add")}
        snapPoints={["35%"]}
      >
        <View className="gap-3 p-4">
          <Button
            testID="attachment-camera"
            label={t("invoices.attachments.camera")}
            variant="secondary"
            onPress={() => captureImage().then(handlePick)}
          />
          <Button
            testID="attachment-library"
            label={t("invoices.attachments.library")}
            variant="secondary"
            onPress={() => pickImages(true).then(handlePick)}
          />
          <Button
            testID="attachment-document"
            label={t("invoices.attachments.document")}
            variant="secondary"
            onPress={() => pickDocuments(true).then(handlePick)}
          />
        </View>
      </Sheet>
      <Sheet
        ref={renameSheet}
        title={t("invoices.attachments.rename")}
        snapPoints={["40%"]}
      >
        <View className="p-4">
          <Input
            testID="attachment-rename-input"
            value={renameValue}
            onChangeText={setRenameValue}
            autoFocus
          />
          <Button
            testID="attachment-rename-save"
            label={t("common.save")}
            loading={rename.isPending}
            onPress={() =>
              renaming &&
              rename.mutate(
                { attachmentId: renaming.id, filename: renameValue.trim() },
                { onSuccess: () => renameSheet.current?.dismiss() },
              )
            }
          />
        </View>
      </Sheet>
      <ConfirmDialog
        visible={deletingAttachment !== null}
        title={t("invoices.attachments.deleteConfirm", {
          name: deletingAttachment?.filename ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={removeAttachment.isPending}
        onCancel={() => setDeletingAttachment(null)}
        onConfirm={() =>
          deletingAttachment &&
          removeAttachment.mutate(
            { attachmentId: deletingAttachment.id },
            { onSettled: () => setDeletingAttachment(null) },
          )
        }
      />
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
    </ScrollView>
  );
}
