import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { RefObject } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import { Eyebrow } from "@/components/ui/typography";
import type { InvoiceAttachment } from "@/features/invoices/invoice-types";
import {
  openAttachment,
  useDeleteAttachment,
  useInvoiceAttachments,
  useRenameAttachment,
  useUploadAttachment,
} from "@/features/invoices/invoices-api";
import { captureImage, pickDocuments, pickImages } from "@/lib/files/pick";
import type { PickResult } from "@/lib/files/pick";
import { formatDate } from "@/lib/format/date";
import { useTokens } from "@/theme/tokens";

/** Short tile label: file extension (`PDF`, `JPG`) or the mime subtype. */
function tileLabel(attachment: InvoiceAttachment): string {
  const ext = /\.([a-z0-9]{1,4})$/i.exec(attachment.filename)?.[1];
  return (ext ?? attachment.mime_type.split("/")[1] ?? "?")
    .slice(0, 4)
    .toUpperCase();
}

type Props = {
  projectId: string;
  invoiceId: string;
  /** Owned by the screen so the "Đính kèm" action button can open the picker sheet. */
  addSheet: RefObject<BottomSheetModal | null>;
};

/**
 * 1b attachments: one r20 card row per file — 40×48 extension tile, name, "312 KB · date" —
 * tapping opens the file, the trailing dots open a menu (open / rename / delete). Also hosts the
 * add (camera / library / document), rename and delete flows.
 */
export function InvoiceAttachmentsCard({
  projectId,
  invoiceId,
  addSheet,
}: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const attachments = useInvoiceAttachments(projectId, invoiceId);
  const upload = useUploadAttachment(projectId, invoiceId);
  const rename = useRenameAttachment(projectId, invoiceId);
  const remove = useDeleteAttachment(projectId, invoiceId);
  const menuSheet = useRef<BottomSheetModal>(null);
  const renameSheet = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<InvoiceAttachment | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<InvoiceAttachment | null>(null);

  async function handlePick(result: PickResult) {
    addSheet.current?.dismiss();
    if (result.status === "denied")
      return showToast(t("invoices.attachments.permissionDenied"), "error");
    if (result.status === "canceled") return;
    for (const file of result.files)
      await upload.mutateAsync({ file }).catch(() => undefined);
  }
  const open = (attachment: InvoiceAttachment) =>
    openAttachment(attachment).catch((e: Error) =>
      showToast(e.message, "error"),
    );
  const list = attachments.data ?? [];

  return (
    <View>
      <Eyebrow className="mb-2">
        {t("invoices.attachments.title", { count: list.length })}
      </Eyebrow>
      <Card radius={20} elevated padded={false} className="overflow-hidden">
        {list.length === 0 ? (
          <Text className="px-4 py-3.5 font-sans text-[13px] text-muted">
            {upload.isPending
              ? t("common.loading")
              : t("invoices.detail.attachmentsEmpty")}
          </Text>
        ) : null}
        {list.map((attachment, index) => (
          <Pressable
            key={attachment.id}
            testID={`attachment-open-${attachment.id}`}
            accessibilityRole="button"
            onPress={() => void open(attachment)}
            className={`flex-row items-center gap-3 px-4 py-3.5 active:opacity-70 ${index === 0 ? "" : "border-t border-line"}`}
          >
            <View className="h-12 w-10 items-center justify-center rounded-md bg-paper-2">
              <Text className="font-sans-bold text-[9px] text-muted">
                {tileLabel(attachment)}
              </Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="font-sans-medium text-[14px] leading-[18px] text-ink"
                numberOfLines={1}
              >
                {attachment.filename}
              </Text>
              <Text className="font-sans text-[11.5px] leading-[14px] text-muted">
                {Math.round(attachment.size_bytes / 1024)} KB ·{" "}
                {formatDate(attachment.uploaded_at)}
              </Text>
            </View>
            <Pressable
              testID={`attachment-menu-${attachment.id}`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setSelected(attachment);
                menuSheet.current?.present();
              }}
              className="h-8 w-8 items-center justify-center active:opacity-70"
            >
              <Icon name="more-horizontal" size={18} color={tokens.muted2} />
            </Pressable>
          </Pressable>
        ))}
      </Card>

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
      <Sheet ref={menuSheet} title={selected?.filename} snapPoints={["35%"]}>
        <View className="gap-3 p-4">
          <Button
            label={t("invoices.detail.open")}
            variant="secondary"
            onPress={() => {
              menuSheet.current?.dismiss();
              if (selected) void open(selected);
            }}
          />
          <Button
            testID={selected ? `attachment-rename-${selected.id}` : undefined}
            label={t("invoices.attachments.rename")}
            variant="secondary"
            onPress={() => {
              if (!selected) return;
              setRenameValue(selected.filename);
              menuSheet.current?.dismiss();
              renameSheet.current?.present();
            }}
          />
          <Button
            testID={selected ? `attachment-delete-${selected.id}` : undefined}
            label={t("common.delete")}
            variant="danger"
            onPress={() => {
              menuSheet.current?.dismiss();
              setDeleting(selected);
            }}
          />
        </View>
      </Sheet>
      <Sheet
        ref={renameSheet}
        title={t("invoices.attachments.rename")}
        snapPoints={["40%"]}
      >
        <View className="gap-3 p-4">
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
              selected &&
              rename.mutate(
                { attachmentId: selected.id, filename: renameValue.trim() },
                { onSuccess: () => renameSheet.current?.dismiss() },
              )
            }
          />
        </View>
      </Sheet>
      <ConfirmDialog
        visible={deleting !== null}
        title={t("invoices.attachments.deleteConfirm", {
          name: deleting?.filename ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { attachmentId: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </View>
  );
}
