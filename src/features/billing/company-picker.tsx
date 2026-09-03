import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { Select } from "@/components/ui/select";
import { useMyCompanies } from "@/features/companies/companies-api";

import type { BillingDocumentKind } from "./billing-types";

const storageKey = (kind: BillingDocumentKind) =>
  `folio.billing.lastCompany.${kind}`;

type Props = {
  kind: BillingDocumentKind;
  value: string | null;
  onChange: (companyId: string | null) => void;
  error?: string | null;
};

/**
 * Issuing-company field for new documents: 0 companies → callout, 1 → static label,
 * 2+ → picker defaulting to last used → primary → first (same rules as the web picker).
 */
export function CompanyPicker({ kind, value, onChange, error }: Props) {
  const { t } = useTranslation();
  const companies = useMyCompanies();
  const list = useMemo(() => companies.data ?? [], [companies.data]);
  // undefined = not read yet; null = nothing stored.
  const [last, setLast] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(storageKey(kind))
      .catch(() => null)
      .then((stored) => {
        if (!cancelled) setLast(stored);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  useEffect(() => {
    if (value || list.length === 0 || last === undefined) return;
    const pick =
      list.find((c) => c.id === last) ??
      list.find((c) => c.is_primary) ??
      list[0];
    onChange(pick.id);
  }, [value, list, last, onChange]);

  if (companies.isPending) return null;
  if (list.length === 0)
    return (
      <Text testID="company-picker-empty" className="mb-4 text-sm text-warning">
        {t("billing.form.noCompanies")}
      </Text>
    );
  if (list.length === 1)
    return (
      <Text className="mb-4 text-sm text-muted-foreground">
        {t("billing.form.issuedFrom", { name: list[0].legal_name })}
      </Text>
    );
  return (
    <Select
      testID="company-picker"
      label={t("billing.form.company")}
      value={value}
      options={list.map((c) => ({
        value: c.id,
        label: c.is_primary
          ? `${c.legal_name} (${t("billing.form.primary")})`
          : c.legal_name,
      }))}
      onChange={(id) => {
        void SecureStore.setItemAsync(storageKey(kind), id).catch(
          () => undefined,
        );
        onChange(id);
      }}
      error={error}
    />
  );
}
