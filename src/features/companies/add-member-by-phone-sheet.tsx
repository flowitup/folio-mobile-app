import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import {
  AddMemberConflictError,
  useAddMemberByPhone,
} from "@/features/companies/company-members-api";
import type { AddMemberRole } from "@/features/companies/company-members-api";

type Props = { companyId: string };

/**
 * Add-by-phone sheet (D1 onboarding): admin types a phone (+ optional name/role); the backend
 * either attaches an existing account, links a pending profile, or creates a brand new one. A
 * 409 with several un-linked candidates is resolved here by picking one and resending.
 */
export const AddMemberByPhoneSheet = forwardRef<BottomSheetModal, Props>(
  function AddMemberByPhoneSheet({ companyId }, ref) {
    const { t } = useTranslation();
    const add = useAddMemberByPhone();
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [role, setRole] = useState<AddMemberRole>("member");
    const [candidates, setCandidates] = useState<
      { person_id: string; name: string }[] | null
    >(null);
    const [error, setError] = useState<string | null>(null);

    function reset() {
      setPhone("");
      setName("");
      setRole("member");
      setCandidates(null);
      setError(null);
    }

    function submit(personId?: string) {
      setError(null);
      add.mutate(
        {
          companyId,
          phone: phone.trim(),
          name: name.trim() || undefined,
          role,
          person_id: personId,
        },
        {
          onSuccess: () => {
            reset();
            (
              ref as RefObject<BottomSheetModal | null> | null
            )?.current?.dismiss();
          },
          onError: (caught) => {
            if (caught instanceof AddMemberConflictError) {
              setCandidates(caught.candidates);
              return;
            }
            setError((caught as Error).message);
          },
        },
      );
    }

    return (
      <Sheet
        ref={ref}
        title={t("companies.members.addByPhone.title")}
        snapPoints={["65%"]}
      >
        <View className="p-4">
          {!candidates ? (
            <>
              <Input
                testID="add-member-phone"
                label={t("companies.members.addByPhone.phoneLabel")}
                placeholder="06 12 34 56 78"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Input
                testID="add-member-name"
                label={t("companies.members.addByPhone.nameLabel")}
                value={name}
                onChangeText={setName}
              />
              <Segmented<AddMemberRole>
                testID="add-member-role"
                value={role}
                onChange={setRole}
                options={[
                  { value: "member", label: t("companies.x.member") },
                  { value: "manager", label: t("companies.x.manager") },
                ]}
              />
              {error ? (
                <Text
                  testID="add-member-error"
                  className="mt-3 font-sans text-sm text-negative"
                >
                  {error}
                </Text>
              ) : null}
              <Button
                testID="add-member-submit"
                label={t("companies.members.addByPhone.submit")}
                className="mt-4"
                loading={add.isPending}
                disabled={!phone.trim()}
                onPress={() => submit()}
              />
            </>
          ) : (
            <>
              <Text className="mb-3 font-sans text-[13px] text-muted">
                {t("companies.members.addByPhone.conflictHint")}
              </Text>
              {candidates.map((candidate) => (
                <Pressable
                  key={candidate.person_id}
                  testID={`add-member-candidate-${candidate.person_id}`}
                  accessibilityRole="button"
                  onPress={() => submit(candidate.person_id)}
                  className="mb-2 rounded-[10px] border border-line-2 bg-card px-3.5 py-3 active:opacity-70"
                >
                  <Text className="font-sans-medium text-[14px] text-ink">
                    {candidate.name}
                  </Text>
                </Pressable>
              ))}
              <Button
                testID="add-member-candidates-cancel"
                label={t("common.cancel")}
                variant="secondary"
                onPress={() => setCandidates(null)}
              />
            </>
          )}
        </View>
      </Sheet>
    );
  },
);
