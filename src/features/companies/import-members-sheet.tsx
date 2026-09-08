import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useMemo, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text } from "react-native";

import { Button } from "@/components/ui/button";
import { Checkbox, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { useMyCompanies } from "@/features/companies/companies-api";
import {
  useCompanyPersons,
  useImportMembers,
} from "@/features/companies/company-members-api";

type Props = { companyId: string };

/** Import member profiles (no pay data) from another company the caller also admins. */
export const ImportMembersSheet = forwardRef<BottomSheetModal, Props>(
  function ImportMembersSheet({ companyId }, ref) {
    const { t } = useTranslation();
    const companies = useMyCompanies();
    const sourceOptions = useMemo(
      () =>
        (companies.data ?? []).filter(
          (company) => company.role === "admin" && company.id !== companyId,
        ),
      [companies.data, companyId],
    );
    const [sourceId, setSourceId] = useState<string | null>(null);
    const directory = useCompanyPersons(sourceId ?? undefined);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const importMembers = useImportMembers();

    function toggle(personId: string) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(personId)) next.delete(personId);
        else next.add(personId);
        return next;
      });
    }

    function submit() {
      if (!sourceId || selected.size === 0) return;
      importMembers.mutate(
        {
          companyId,
          from_company_id: sourceId,
          person_ids: [...selected],
        },
        {
          onSuccess: () => {
            setSelected(new Set());
            (
              ref as RefObject<BottomSheetModal | null> | null
            )?.current?.dismiss();
          },
        },
      );
    }

    return (
      <Sheet
        ref={ref}
        title={t("companies.members.import.title")}
        snapPoints={["80%"]}
      >
        <ScrollView className="p-4">
          {/* The nested Select must mount together with the Sheet: registering a stacked
              bottom-sheet modal after the parent is presented corrupts gorhom's push stack
              (same root cause as the grants sheet). So the picker is always rendered and the
              empty state is shown alongside it. */}
          {sourceOptions.length === 0 ? (
            <EmptyState message={t("companies.members.import.noSource")} />
          ) : null}
          {
            <>
              <Select
                testID="import-source-company"
                label={t("companies.members.import.sourceLabel")}
                placeholder={t("companies.members.import.sourcePlaceholder")}
                value={sourceId}
                options={sourceOptions.map((company) => ({
                  value: company.id,
                  label: company.legal_name,
                }))}
                onChange={(value) => {
                  setSourceId(value);
                  setSelected(new Set());
                }}
              />
              {sourceId && directory.isPending ? (
                <ActivityIndicator className="my-4" />
              ) : null}
              {sourceId && directory.data && directory.data.length === 0 ? (
                <EmptyState message={t("companies.members.import.empty")} />
              ) : null}
              {(directory.data ?? []).map((person) => (
                <Checkbox
                  key={person.person_id}
                  testID={`import-person-${person.person_id}`}
                  label={person.name}
                  value={selected.has(person.person_id)}
                  onChange={() => toggle(person.person_id)}
                />
              ))}
              {sourceId ? (
                <Text className="mb-3 font-sans text-[12px] text-muted">
                  {t("companies.members.import.selectedCount", {
                    count: selected.size,
                  })}
                </Text>
              ) : null}
              <Button
                testID="import-submit"
                label={t("companies.members.import.submit")}
                loading={importMembers.isPending}
                disabled={!sourceId || selected.size === 0}
                onPress={submit}
              />
            </>
          }
        </ScrollView>
      </Sheet>
    );
  },
);
