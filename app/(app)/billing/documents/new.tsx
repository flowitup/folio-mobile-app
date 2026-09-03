import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Sheet } from "@/components/ui/sheet";
import {
  BillingDocumentForm,
  draftFromSeed,
  draftToCreatePayload,
  draftToImportPayload,
} from "@/features/billing/billing-document-form";
import type { DocumentDraft } from "@/features/billing/billing-document-form";
import {
  useCreateBillingDocument,
  useCreateFromTemplate,
  useImportBillingDocument,
  useRecentBillingDocuments,
} from "@/features/billing/billing-documents-api";
import { BillingStatusBadge } from "@/features/billing/billing-status-badge";
import { useBillingTemplates } from "@/features/billing/billing-templates-api";
import type {
  BillingDocument,
  BillingDocumentKind,
  BillingDocumentTemplate,
} from "@/features/billing/billing-types";
import { CompanyPicker } from "@/features/billing/company-picker";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

/** New devis / facture: blank, copied from an existing document, created from a template, or imported. */
export default function NewBillingDocumentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    mode?: string;
    template?: string;
  }>();
  const kind: BillingDocumentKind =
    params.kind === "facture" ? "facture" : "devis";
  const importing = params.mode === "import";
  const create = useCreateBillingDocument();
  const importDoc = useImportBillingDocument();
  const fromTemplate = useCreateFromTemplate();

  const [seed, setSeed] = useState<Partial<BillingDocument> | null>(null);
  const [seedKey, setSeedKey] = useState("blank");
  const existingSheet = useRef<BottomSheetModal>(null);
  const templateSheet = useRef<BottomSheetModal>(null);
  const [existingOpen, setExistingOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(Boolean(params.template));
  const recent = useRecentBillingDocuments(existingOpen);
  const templates = useBillingTemplates(kind);
  const [template, setTemplate] = useState<BillingDocumentTemplate | null>(
    null,
  );
  const [recipient, setRecipient] = useState("");
  const [templateCompany, setTemplateCompany] = useState<string | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  // "Use" from the templates list lands here with the template preselected.
  const preselected =
    template ??
    (params.template
      ? (templates.data?.find((x) => x.id === params.template) ?? null)
      : null);
  const presented = useRef(false);
  useEffect(() => {
    if (params.template && preselected && !presented.current) {
      presented.current = true;
      templateSheet.current?.present();
    }
  }, [params.template, preselected]);

  const openDoc = (doc: BillingDocument) =>
    router.replace(`/billing/documents/${doc.id}`);

  function submit(draft: DocumentDraft) {
    if (importing)
      importDoc.mutate(draftToImportPayload(kind, draft), {
        onSuccess: openDoc,
      });
    else
      create.mutate(draftToCreatePayload(kind, draft), { onSuccess: openDoc });
  }

  function applyTemplate() {
    if (!preselected) return;
    const name = recipient.trim();
    if (!name)
      return setRecipientError(t("billing.form.errors.recipientRequired"));
    setRecipientError(null);
    fromTemplate.mutate(
      {
        templateId: preselected.id,
        recipient_name: name,
        company_id: templateCompany,
      },
      {
        onSuccess: (doc) => {
          templateSheet.current?.dismiss();
          openDoc(doc);
        },
      },
    );
  }

  const title = importing
    ? t("billing.list.import")
    : `${t("billing.list.new")} · ${t(`billing.kind.${kind}`)}`;

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={title} back />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {!importing ? (
          <View className="mb-4 flex-row flex-wrap gap-2">
            <Button
              testID="mode-blank"
              label={t("billing.form.modes.blank")}
              size="sm"
              variant={seed ? "secondary" : "primary"}
              onPress={() => {
                setSeed(null);
                setSeedKey("blank");
              }}
            />
            <Button
              testID="mode-existing"
              label={t("billing.form.modes.fromExisting")}
              size="sm"
              variant="secondary"
              onPress={() => {
                setExistingOpen(true);
                existingSheet.current?.present();
              }}
            />
            <Button
              testID="mode-template"
              label={t("billing.form.modes.fromTemplate")}
              size="sm"
              variant="secondary"
              onPress={() => {
                setTemplatesOpen(true);
                templateSheet.current?.present();
              }}
            />
          </View>
        ) : null}
        <BillingDocumentForm
          key={seedKey}
          kind={kind}
          mode={importing ? "import" : "create"}
          initial={draftFromSeed(kind, seed, { resetDates: true })}
          submitting={create.isPending || importDoc.isPending}
          submitLabel={
            importing
              ? t("billing.form.importAction")
              : t("billing.form.create")
          }
          onSubmit={submit}
        />
      </ScrollView>

      <Sheet
        ref={existingSheet}
        title={t("billing.fromExisting.title")}
        snapPoints={["80%"]}
      >
        <View className="p-4">
          <Text className="mb-3 text-xs text-muted-foreground">
            {t("billing.fromExisting.hint")}
          </Text>
          {recent.isPending && existingOpen ? <ActivityIndicator /> : null}
          {recent.data && recent.data.length === 0 ? (
            <EmptyState message={t("billing.fromExisting.none")} />
          ) : null}
          {(recent.data ?? []).map((doc) => (
            <ListRow
              key={doc.id}
              testID={`existing-${doc.id}`}
              title={`${doc.document_number} · ${doc.recipient_name}`}
              subtitle={`${t(`billing.kind.${doc.kind}`)} · ${formatDate(doc.issue_date)} · ${formatMoney(doc.total_ttc)} TTC`}
              right={<BillingStatusBadge status={doc.status} />}
              onPress={() => {
                setSeed(doc);
                setSeedKey(`existing-${doc.id}`);
                existingSheet.current?.dismiss();
              }}
            />
          ))}
        </View>
      </Sheet>

      <Sheet
        ref={templateSheet}
        title={t("billing.fromTemplate.title")}
        snapPoints={["80%"]}
      >
        <View className="p-4">
          {templates.isPending && templatesOpen ? <ActivityIndicator /> : null}
          {templates.data && templates.data.length === 0 ? (
            <EmptyState message={t("billing.fromTemplate.none")} />
          ) : null}
          {(templates.data ?? []).map((item) => (
            <Pressable
              key={item.id}
              testID={`template-pick-${item.id}`}
              onPress={() => setTemplate(item)}
              className={`mb-2 rounded-lg border px-4 py-3 ${preselected?.id === item.id ? "border-primary bg-muted" : "border-border"}`}
            >
              <Text className="text-base font-medium text-primary">
                {item.name}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {t("billing.templates.itemsCount", {
                  count: item.items.length,
                })}
              </Text>
            </Pressable>
          ))}
          {preselected ? (
            <View className="mt-3">
              <CompanyPicker
                kind={kind}
                value={templateCompany}
                onChange={setTemplateCompany}
              />
              <Input
                testID="template-recipient"
                label={t("billing.fromTemplate.recipient")}
                value={recipient}
                onChangeText={setRecipient}
                error={recipientError}
              />
              <Button
                testID="template-create"
                label={t("billing.fromTemplate.create")}
                loading={fromTemplate.isPending}
                onPress={applyTemplate}
              />
            </View>
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}
