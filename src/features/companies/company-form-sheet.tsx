import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";

import type { Company, CreateCompanyPayload } from "./companies-api";

type Props = {
  initial?: Company;
  submitting: boolean;
  onSubmit: (payload: CreateCompanyPayload) => void;
};

const FIELDS = [
  "siret",
  "tva_number",
  "iban",
  "bic",
  "logo_url",
  "default_payment_terms",
  "prefix_override",
] as const;
const LABEL_KEY: Record<(typeof FIELDS)[number], string> = {
  siret: "siret",
  tva_number: "tvaNumber",
  iban: "iban",
  bic: "bic",
  logo_url: "logoUrl",
  default_payment_terms: "defaultPaymentTerms",
  prefix_override: "prefixOverride",
};

/** Company create / edit form with the web validation rules (name + address, logo scheme, prefix A-Z0-9 ≤ 8). */
export const CompanyFormSheet = forwardRef<BottomSheetModal, Props>(
  function CompanyFormSheet({ initial, submitting, onSubmit }, ref) {
    const { t } = useTranslation();
    const [values, setValues] = useState<Record<string, string>>({
      legal_name: initial?.legal_name ?? "",
      address: initial?.address ?? "",
      ...Object.fromEntries(FIELDS.map((f) => [f, initial?.[f] ?? ""])),
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const set = (key: string) => (value: string) =>
      setValues((v) => ({ ...v, [key]: value }));

    function submit() {
      const next: Record<string, string> = {};
      if (!values.legal_name.trim())
        next.legal_name = t("companies.form.errors.legalNameRequired");
      if (!values.address.trim())
        next.address = t("companies.form.errors.addressRequired");
      const logo = values.logo_url.trim();
      if (logo && !/^https?:\/\//i.test(logo))
        next.logo_url = t("companies.form.errors.logoUrlInvalidScheme");
      const prefix = values.prefix_override.trim();
      if (prefix.length > 8)
        next.prefix_override = t("companies.form.errors.prefixTooLong");
      else if (prefix && !/^[A-Z0-9]+$/.test(prefix))
        next.prefix_override = t("companies.form.errors.prefixInvalidChars");
      setErrors(next);
      if (Object.keys(next).length > 0) return;
      onSubmit({
        legal_name: values.legal_name.trim(),
        address: values.address.trim(),
        ...Object.fromEntries(FIELDS.map((f) => [f, values[f].trim() || null])),
      });
    }

    return (
      <Sheet
        ref={ref}
        title={
          initial
            ? t("companies.admin.manage.tabs.edit")
            : t("companies.x.create")
        }
        snapPoints={["90%"]}
      >
        <View className="p-4">
          <Input
            testID="company-legal-name"
            label={t("companies.form.fields.legalName.label")}
            placeholder={t("companies.form.fields.legalName.placeholder")}
            value={values.legal_name}
            onChangeText={set("legal_name")}
            error={errors.legal_name}
          />
          <Input
            testID="company-address"
            label={t("companies.form.fields.address.label")}
            placeholder={t("companies.form.fields.address.placeholder")}
            value={values.address}
            onChangeText={set("address")}
            multiline
            error={errors.address}
          />
          {FIELDS.map((field) => (
            <Input
              key={field}
              testID={`company-${field}`}
              label={t(`companies.form.fields.${LABEL_KEY[field]}.label`)}
              placeholder={t(
                `companies.form.fields.${LABEL_KEY[field]}.placeholder`,
              )}
              value={values[field]}
              onChangeText={set(field)}
              error={errors[field]}
              autoCapitalize={
                field === "prefix_override" ? "characters" : "none"
              }
              multiline={field === "default_payment_terms"}
            />
          ))}
          <Button
            testID="company-submit"
            label={t("companies.form.actions.save")}
            loading={submitting}
            onPress={submit}
          />
        </View>
      </Sheet>
    );
  },
);
