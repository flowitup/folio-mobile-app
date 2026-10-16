import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { Select } from "@/components/ui/select";
import {
  type MyCompany,
  useMyCompanies,
} from "@/features/companies/companies-api";
import { useOptionalSelectedProject } from "@/features/projects/selected-project";

/**
 * The company a company-wide settings screen (labor roles, hidden sections) works on: the one
 * picked on screen, else the selected project's company, else the primary, else the oldest
 * attachment — always among the companies the screen may manage.
 */
export function pickSettingsCompany<T extends Pick<MyCompany, "id" | "is_primary">>(
  eligible: readonly T[],
  requested: string | null | undefined,
  projectCompanyId: string | null | undefined,
): T | undefined {
  return (
    eligible.find((c) => c.id === requested) ??
    eligible.find((c) => c.id === projectCompanyId) ??
    eligible.find((c) => c.is_primary) ??
    eligible[0]
  );
}

export function useSettingsCompany(isEligible: (company: MyCompany) => boolean) {
  const companies = useMyCompanies();
  const projectCompanyId = useOptionalSelectedProject()?.project?.company_id;
  const [companyId, setCompanyId] = useState<string | null>(null);
  const eligible = useMemo(
    () => (companies.data ?? []).filter(isEligible),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the predicate is a fixed rule per screen
    [companies.data],
  );
  const selected = pickSettingsCompany(eligible, companyId, projectCompanyId);
  return { companies, eligible, selected, setCompanyId };
}

/**
 * A picker when several companies may be managed, else the company's name, so the screen always
 * says whose settings it edits.
 */
export function SettingsCompanyPicker({
  testID,
  eligible,
  selected,
  onChange,
}: {
  testID: string;
  eligible: readonly MyCompany[];
  selected: MyCompany | undefined;
  onChange: (companyId: string) => void;
}) {
  const { t } = useTranslation();
  if (!selected) return null;
  if (eligible.length > 1)
    return (
      <Select
        testID={testID}
        label={t("settings.company.label")}
        value={selected.id}
        options={eligible.map((c) => ({ value: c.id, label: c.legal_name }))}
        onChange={onChange}
      />
    );
  return (
    <Text testID={`${testID}-name`} className="mb-3 text-sm text-muted-foreground">
      {t("settings.company.single", { company: selected.legal_name })}
    </Text>
  );
}
