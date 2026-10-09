import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Card, EmptyState, ErrorState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Sheet } from "@/components/ui/sheet";
import { showToast } from "@/components/ui/toast";
import {
  BillingDocumentForm,
  draftFromSeed,
  draftToUpdatePayload,
} from "@/features/billing/billing-document-form";
import {
  billingKeys,
  openBillingFile,
  useBillingDocument,
  useCloneBillingDocument,
  useConvertDevisToFacture,
  useDeleteBillingDocument,
  useSetBillingStatus,
  useUpdateBillingDocument,
} from "@/features/billing/billing-documents-api";
import { BillingStatusBadge } from "@/features/billing/billing-status-badge";
import type { BillingDocumentKind } from "@/features/billing/billing-types";
import {
  allowedTransitions,
  transitionLabelKey,
} from "@/lib/billing/billing-status-transitions";
import { formatMoney } from "@/lib/format/money";
import { ApiError } from "@/lib/query/api-error";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { toIsoDate } from "@/lib/format/date";
import { MAX_BUSINESS_DATE } from "@/lib/format/date-bounds";
import { apiErrorMessage } from "@/lib/query/api-error-message";

/** Document detail: status transitions, PDF / XLSX share, duplicate, convert, delete, and the edit form. */
export default function BillingDocumentScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { docId } = useLocalSearchParams<{ docId: string }>();
  const query = useBillingDocument(docId);
  useRefetchOnFocus(query.refetch);
  const update = useUpdateBillingDocument();
  const remove = useDeleteBillingDocument();
  const clone = useCloneBillingDocument();
  const convert = useConvertDevisToFacture();
  const setStatus = useSetBillingStatus();
  const [sharing, setSharing] = useState<"pdf" | "xlsx" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const cloneSheet = useRef<BottomSheetModal>(null);
  const convertSheet = useRef<BottomSheetModal>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [paymentTerms, setPaymentTerms] = useState("");
  const queryClient = useQueryClient();
  // A 4xx is final: the document was deleted (or is hidden from this caller, which the API also
  // answers with a 404), so a Retry could never succeed.
  const unavailable =
    query.error instanceof ApiError &&
    query.error.status >= 400 &&
    query.error.status < 500;
  useEffect(() => {
    // Drop it from the lists it was opened from; not this detail, which would only 404 again.
    if (unavailable)
      void queryClient.invalidateQueries({
        queryKey: billingKeys.all,
        predicate: (q) => q.queryKey[2] !== "detail",
      });
  }, [unavailable, queryClient]);

  const doc = query.data;
  if (query.isPending)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title="…" back />
        <ActivityIndicator className="mt-8" />
      </View>
    );
  if (!doc)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title={t("billing.title")} back />
        {unavailable ? (
          <EmptyState message={t("common.errors.notFound")} />
        ) : (
          <ErrorState
            message={t("common.loadError")}
            retryLabel={t("common.retry")}
            onRetry={() => void query.refetch()}
          />
        )}
      </View>
    );

  async function share(format: "pdf" | "xlsx") {
    if (!doc) return;
    setSharing(format);
    try {
      await openBillingFile(doc, format);
    } catch (error) {
      showToast(apiErrorMessage(error, t, i18n.language), "error");
    } finally {
      setSharing(null);
    }
  }

  const otherKind: BillingDocumentKind =
    doc.kind === "devis" ? "facture" : "devis";
  const busy = clone.isPending || convert.isPending || setStatus.isPending;
  // The API refuses any change to a converted devis (409) until its facture is cancelled.
  const lockedByFacture =
    doc.kind === "devis" &&
    Boolean(doc.converted_to_facture_id) &&
    doc.converted_facture_status !== "cancelled";

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={doc.document_number} back />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        <Card className="mb-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-primary">
              {t(`billing.kind.${doc.kind}`)}
            </Text>
            <BillingStatusBadge kind={doc.kind} status={doc.status} />
          </View>
          <Text className="mt-1 text-xs text-muted-foreground">
            {doc.issuer_legal_name} → {doc.recipient_name}
          </Text>
          <Text testID="doc-totals" className="mt-1 text-sm text-primary">
            {t("billing.form.amountHt", { amount: formatMoney(doc.total_ht) })}{" "}
            ·{" "}
            {t("billing.form.amountTva", {
              amount: formatMoney(doc.total_tva),
            })}{" "}
            ·{" "}
            <Text className="font-semibold">
              {t("billing.form.amountTtc", {
                amount: formatMoney(doc.total_ttc),
              })}
            </Text>
          </Text>
        </Card>

        {lockedByFacture ? (
          <Card className="mb-3" testID="doc-locked-by-facture">
            <Text className="mb-2 text-sm text-muted-foreground">
              {t("billing.actions.convertedLocked")}
            </Text>
            <Button
              testID="doc-open-facture"
              label={t("billing.actions.openFacture")}
              size="sm"
              variant="secondary"
              onPress={() =>
                router.push(`/billing/documents/${doc.converted_to_facture_id}`)
              }
            />
          </Card>
        ) : (
          <>
            <Text className="mb-1 text-xs text-muted-foreground">
              {t("billing.actions.changeStatus")}
            </Text>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {allowedTransitions(doc.kind, doc.status).map((next) => (
                <Button
                  key={next}
                  testID={`status-${next}`}
                  label={t(
                    `billing.transitions.${transitionLabelKey(doc.kind, doc.status, next)}`,
                  )}
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    setStatus.mutate(
                      { id: doc.id, new_status: next },
                      {
                        onError: (error) => {
                          if (error instanceof ApiError && error.status === 409)
                            showToast(
                              t("billing.actions.invalidTransition"),
                              "error",
                            );
                        },
                      },
                    )
                  }
                />
              ))}
            </View>
          </>
        )}
        <View className="mb-4 flex-row flex-wrap gap-2">
          <Button
            testID="doc-pdf"
            label={t("billing.actions.pdf")}
            size="sm"
            variant="secondary"
            loading={sharing === "pdf"}
            onPress={() => void share("pdf")}
          />
          <Button
            testID="doc-xlsx"
            label={t("billing.actions.xlsx")}
            size="sm"
            variant="secondary"
            loading={sharing === "xlsx"}
            onPress={() => void share("xlsx")}
          />
          <Button
            testID="doc-clone"
            label={t("billing.actions.clone")}
            size="sm"
            variant="secondary"
            onPress={() => cloneSheet.current?.present()}
          />
          {doc.kind === "devis" &&
          doc.status === "accepted" &&
          !doc.converted_to_facture_id ? (
            <Button
              testID="doc-convert"
              label={t("billing.actions.convert")}
              size="sm"
              onPress={() => {
                setDueDate(toIsoDate(new Date(Date.now() + 30 * 86_400_000)));
                convertSheet.current?.present();
              }}
            />
          ) : null}
          <Button
            testID="doc-delete"
            label={t("common.delete")}
            size="sm"
            variant="danger"
            onPress={() => setDeleting(true)}
          />
        </View>

        <BillingDocumentForm
          key={doc.updated_at}
          kind={doc.kind}
          mode="edit"
          initial={draftFromSeed(doc.kind, doc)}
          documentNumber={doc.document_number}
          readOnly={lockedByFacture}
          submitting={update.isPending}
          submitLabel={t("common.save")}
          onSubmit={(draft) =>
            update.mutate({
              id: doc.id,
              ...draftToUpdatePayload(doc.kind, draft),
            })
          }
        />
      </ScrollView>

      <Sheet
        ref={cloneSheet}
        title={t("billing.actions.clone")}
        snapPoints={["35%"]}
      >
        <View className="gap-2 p-4">
          <Button
            testID="clone-same"
            label={t("billing.actions.cloneAs", {
              kind: t(`billing.kind.${doc.kind}`),
            })}
            loading={clone.isPending}
            onPress={() =>
              clone.mutate(
                { id: doc.id },
                {
                  onSuccess: (created) => {
                    cloneSheet.current?.dismiss();
                    router.push(`/billing/documents/${created.id}`);
                  },
                },
              )
            }
          />
          <Button
            testID="clone-other"
            label={t("billing.actions.cloneAs", {
              kind: t(`billing.kind.${otherKind}`),
            })}
            variant="secondary"
            loading={clone.isPending}
            onPress={() =>
              clone.mutate(
                { id: doc.id, override_kind: otherKind },
                {
                  onSuccess: (created) => {
                    cloneSheet.current?.dismiss();
                    router.push(`/billing/documents/${created.id}`);
                  },
                },
              )
            }
          />
        </View>
      </Sheet>

      <Sheet
        ref={convertSheet}
        title={t("billing.actions.convertTitle")}
        snapPoints={["55%"]}
      >
        <View className="p-4">
          <DatePicker
            testID="convert-due"
            label={t("billing.form.paymentDue")}
            value={dueDate}
            onChange={setDueDate}
            clearable
            // The facture is issued today; the API refuses a due date before it.
            minimumDate={toIsoDate(new Date())}
            maximumDate={MAX_BUSINESS_DATE}
            doneLabel={t("common.ok")}
          />
          <Input
            testID="convert-terms"
            label={t("billing.form.paymentTerms")}
            value={paymentTerms}
            onChangeText={setPaymentTerms}
            maxLength={500}
          />
          <Button
            testID="convert-submit"
            label={t("billing.actions.convert")}
            loading={convert.isPending}
            onPress={() =>
              convert.mutate(
                {
                  id: doc.id,
                  payment_due_date: dueDate,
                  payment_terms: paymentTerms.trim() || null,
                },
                {
                  onSuccess: (created) => {
                    convertSheet.current?.dismiss();
                    router.push(`/billing/documents/${created.id}`);
                  },
                },
              )
            }
          />
        </View>
      </Sheet>

      <ConfirmDialog
        visible={deleting}
        title={t("billing.actions.deleteConfirm", {
          number: doc.document_number,
        })}
        // A paid facture recorded a funds release in its project; the delete removes it too.
        message={
          doc.kind === "facture" && doc.status === "paid"
            ? t("billing.actions.deletePaidWarning")
            : undefined
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          remove.mutate(
            { id: doc.id },
            {
              onSuccess: () => {
                setDeleting(false);
                router.back();
              },
              onError: () => setDeleting(false),
            },
          )
        }
      />
    </View>
  );
}
