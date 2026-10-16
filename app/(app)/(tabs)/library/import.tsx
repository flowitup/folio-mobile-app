import { File } from "expo-file-system";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Select } from "@/components/ui/select";
import { showToast } from "@/components/ui/toast";
import {
  useCompanyCan,
  useMyCompanies,
} from "@/features/companies/companies-api";
import { useImportLibrary } from "@/features/library/library-api";
import {
  IMPORT_SAMPLE,
  parseImportPayload,
} from "@/features/library/library-helpers";
import type { ImportResult } from "@/features/library/library-types";
import { pickDocuments } from "@/lib/files/pick";

/** Purchase import: paste or pick the JSON export, send it to POST /bibliotheque/import, show the counts. */
export default function LibraryImportScreen() {
  const { t } = useTranslation();
  const companies = useMyCompanies();
  // The library screen hands over the company it was showing; without it the first one wins.
  const params = useLocalSearchParams<{ companyId?: string }>();
  const [companyId, setCompanyId] = useState<string | null>(
    params.companyId ?? null,
  );
  const effectiveCompany = companyId ?? companies.data?.[0]?.id ?? null;
  const canManage = useCompanyCan("bibliotheque:manage", effectiveCompany);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showSample, setShowSample] = useState(false);
  const importLibrary = useImportLibrary();

  async function pickFile() {
    const picked = await pickDocuments(false, [
      "application/json",
      "text/*",
      "*/*",
    ]);
    if (picked.status !== "picked") return;
    try {
      setText(await new File(picked.files[0].uri).text());
    } catch {
      showToast(t("common.networkError"), "error");
    }
  }

  function submit() {
    if (!effectiveCompany) return;
    const payload = parseImportPayload(text, effectiveCompany);
    if (!payload) return showToast(t("library.importInvalid"), "error");
    importLibrary.mutate(payload, { onSuccess: setResult });
  }

  if (!canManage)
    return (
      <View className="flex-1 bg-paper">
        <ScreenHeader title={t("library.import")} back />
        <EmptyState message={t("library.toast.forbidden")} />
      </View>
    );

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("library.import")} back />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        {(companies.data?.length ?? 0) > 1 ? (
          <Select
            testID="import-company"
            label={t("library.company")}
            value={effectiveCompany}
            options={(companies.data ?? []).map((c) => ({
              value: c.id,
              label: c.legal_name,
            }))}
            onChange={setCompanyId}
          />
        ) : null}
        {/* Plain words first: what this imports and where the file comes from. */}
        <Card className="mb-3">
          <Text testID="import-help" className="text-sm text-primary">
            {t("library.importHelp")}
          </Text>
          <Text className="mt-2 text-xs text-muted-foreground">
            {t("library.importHint")}
          </Text>
        </Card>
        <View className="mb-3 flex-row gap-2">
          <Button
            testID="import-pick"
            label={t("invoices.attachments.document")}
            variant="secondary"
            className="flex-1"
            onPress={() => void pickFile()}
          />
          <Button
            testID="import-sample"
            label={t("library.importSample")}
            variant="ghost"
            className="flex-1"
            onPress={() => setShowSample((v) => !v)}
          />
        </View>
        {/* Shown, never pasted: importing the example would add a fake product. */}
        {showSample ? (
          <Card className="mb-3">
            <Text
              testID="import-sample-text"
              selectable
              className="font-mono text-xs text-primary"
            >
              {IMPORT_SAMPLE}
            </Text>
          </Card>
        ) : null}
        <Input
          testID="import-text"
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={10}
          autoCapitalize="none"
          autoCorrect={false}
          className="min-h-48 font-mono text-xs"
          placeholder='{"supplier_name": "...", "supplier_slug": "...", "records": [...]}'
        />
        <Button
          testID="import-submit"
          label={t("library.import")}
          loading={importLibrary.isPending}
          disabled={!text.trim() || !effectiveCompany}
          onPress={submit}
        />
        {result ? (
          <Card className="mt-4">
            <Text testID="import-result" className="text-sm text-primary">
              {t("library.importDone", {
                created: result.created,
                updated: result.updated,
                purchases: result.purchases_added,
                skipped: result.skipped,
              })}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
