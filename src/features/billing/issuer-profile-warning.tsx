import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useMyCompanies } from "@/features/companies/companies-api";
import type { Company } from "@/features/companies/companies-api";

export type IssuerField = "siret" | "tva_number" | "iban";

const FIELDS: IssuerField[] = ["siret", "tva_number", "iban"];

/** The legal mentions a devis / facture prints for its issuer that the company has left blank. */
export function missingIssuerFields(
  company: Pick<Company, IssuerField> | null | undefined,
): IssuerField[] {
  if (!company) return [];
  return FIELDS.filter((field) => !(company[field] ?? "").trim());
}

/**
 * Warns, before a new document is issued, that the issuing company has no SIRET, VAT number
 * or IBAN (so the PDF would print none), with a way to the company profile to fill them in.
 */
export function IssuerProfileWarning({
  companyId,
}: {
  companyId: string | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const companies = useMyCompanies();
  const company = (companies.data ?? []).find((c) => c.id === companyId);
  const missing = missingIssuerFields(company);
  if (!company || missing.length === 0) return null;
  const labels = missing.map((field) =>
    t(`billing.form.issuerProfile.fields.${field}`),
  );
  return (
    <View
      testID="issuer-profile-warning"
      className="mb-4 rounded-[10px] bg-warning-tint p-3"
    >
      <Text className="text-sm text-warning">
        {t("billing.form.issuerProfile.missing", {
          name: company.legal_name,
          fields: labels.join(", "),
        })}
      </Text>
      <Pressable
        testID="issuer-profile-open"
        accessibilityRole="link"
        hitSlop={8}
        className="mt-2 min-h-[44px] justify-center"
        onPress={() => router.push(`/settings/companies/${company.id}`)}
      >
        <Text className="text-sm font-medium text-primary underline">
          {t("billing.form.issuerProfile.open")}
        </Text>
      </Pressable>
    </View>
  );
}
