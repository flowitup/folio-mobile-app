import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateCompany } from "@/features/companies/companies-api";

/**
 * Onboarding · create a company: legal name + address only (D1 — the caller becomes its
 * admin, `is_primary`; SIRET/IBAN/etc. can be filled in later from Settings). Full-screen
 * variant of `CompanyFormSheet`'s minimum fields, reached from the onboarding hub.
 */
export default function OnboardingCreateCompanyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const create = useCreateCompany();
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<{
    legalName?: string;
    address?: string;
  }>({});

  function submit() {
    const nextErrors: typeof errors = {};
    if (!legalName.trim())
      nextErrors.legalName = t("companies.form.errors.legalNameRequired");
    if (!address.trim())
      nextErrors.address = t("companies.form.errors.addressRequired");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    create.mutate(
      { legal_name: legalName.trim(), address: address.trim() },
      { onSuccess: () => router.replace("/") },
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-7 pb-10"
      >
        <Text className="mb-1.5 font-serif text-[32px] tracking-[-0.32px] text-ink">
          {t("onboarding.createOption")}
        </Text>
        <Text className="mb-6 font-sans text-[14px] text-muted">
          {t("onboarding.createSubtitle")}
        </Text>
        <Input
          testID="onboarding-legal-name"
          label={t("companies.form.fields.legalName.label")}
          placeholder={t("companies.form.fields.legalName.placeholder")}
          value={legalName}
          onChangeText={setLegalName}
          error={errors.legalName}
        />
        <Input
          testID="onboarding-address"
          label={t("companies.form.fields.address.label")}
          placeholder={t("companies.form.fields.address.placeholder")}
          value={address}
          onChangeText={setAddress}
          multiline
          error={errors.address}
        />
        <Button
          testID="onboarding-create-submit"
          label={t("companies.form.actions.save")}
          loading={create.isPending}
          onPress={submit}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
