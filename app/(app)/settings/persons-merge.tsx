import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { showToast } from "@/components/ui/toast";
import { useMergePersons, usePersons } from "@/features/persons/persons-api";
import type { PersonSummary } from "@/features/persons/persons-api";

type PickerProps = {
  label: string;
  value: PersonSummary | null;
  onChange: (person: PersonSummary | null) => void;
  testID: string;
};

/** Debounced person search with a tap-to-pick result list. */
function PersonPicker({ label, value, onChange, testID }: PickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);
  const persons = usePersons(q, value === null && q.length > 0);
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm text-muted-foreground">{label}</Text>
      {value ? (
        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-primary">
              {value.name}
              {value.phone ? ` · ${value.phone}` : ""}
            </Text>
            <Pressable
              testID={`${testID}-clear`}
              onPress={() => onChange(null)}
            >
              <Text className="text-sm text-danger">✕</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <>
          <TextInput
            testID={testID}
            className="rounded-lg border border-border px-4 py-2 text-base text-primary"
            placeholder={t("persons.search")}
            placeholderTextColor="#a3a3a3"
            value={search}
            onChangeText={setSearch}
          />
          {persons.isFetching ? <ActivityIndicator className="mt-2" /> : null}
          {q && persons.data && persons.data.length === 0 ? (
            <Text className="mt-1 text-xs text-muted-foreground">
              {t("persons.none")}
            </Text>
          ) : null}
          {(persons.data ?? []).map((person) => (
            <Pressable
              key={person.id}
              testID={`${testID}-pick-${person.id}`}
              onPress={() => onChange(person)}
              className="border-b border-border py-2"
            >
              <Text className="text-base text-primary">{person.name}</Text>
              {person.phone ? (
                <Text className="text-xs text-muted-foreground">
                  {person.phone}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}

/** Merge a duplicate person into another: workers move to the target, the source is deleted. */
export default function PersonsMergeScreen() {
  const { t } = useTranslation();
  const [source, setSource] = useState<PersonSummary | null>(null);
  const [target, setTarget] = useState<PersonSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const merge = useMergePersons();

  return (
    <View className="flex-1 bg-card">
      <ScreenHeader title={t("persons.title")} back />
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        <PersonPicker
          testID="merge-source"
          label={t("persons.source")}
          value={source}
          onChange={setSource}
        />
        <PersonPicker
          testID="merge-target"
          label={t("persons.target")}
          value={target}
          onChange={setTarget}
        />
        <Button
          testID="merge-submit"
          label={t("persons.merge")}
          variant="danger"
          disabled={!source || !target}
          onPress={() => {
            if (source && target && source.id === target.id)
              return showToast(t("persons.sameError"), "error");
            setConfirming(true);
          }}
        />
      </ScrollView>
      <ConfirmDialog
        visible={confirming}
        title={t("persons.confirmTitle", {
          source: source?.name ?? "",
          target: target?.name ?? "",
        })}
        message={t("persons.confirmBody")}
        confirmLabel={t("persons.merge")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={merge.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          source &&
          target &&
          merge.mutate(
            { sourceId: source.id, targetId: target.id },
            {
              onSuccess: (data) => {
                setConfirming(false);
                showToast(
                  t("persons.done", { count: data.workers_reassigned }),
                  "success",
                );
                setSource(null);
                setTarget(null);
              },
              onError: () => setConfirming(false),
            },
          )
        }
      />
    </View>
  );
}
