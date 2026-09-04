import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/auth/auth-context";
import { Card, EmptyState, ErrorState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ProjectFormSheet } from "@/features/projects/project-form-sheet";
import type { ProjectFormSheetHandle } from "@/features/projects/project-form-sheet";
import {
  projectCan,
  useCreateProject,
  useProjects,
} from "@/features/projects/projects-api";
import { formatMoney } from "@/lib/format/money";
import {
  computeBudgetMeta,
  personalSpendRows,
} from "@/lib/projects/budget-display";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

export default function ProjectsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const projects = useProjects();
  const createProject = useCreateProject();
  const form = useRef<ProjectFormSheetHandle>(null);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "active">("all");
  useRefetchOnFocus(projects.refetch);

  const canCreate = projectCan(undefined, "project:create", user?.permissions);

  // Same predicate as the web list: case-insensitive name match.
  const filtered = useMemo(() => {
    const rows = projects.data?.projects ?? [];
    const needle = search.trim().toLowerCase();
    return needle
      ? rows.filter((p) => p.name.toLowerCase().includes(needle))
      : rows;
  }, [projects.data, search]);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={t("tabs.projects")}
        right={
          canCreate ? (
            <Pressable
              testID="projects-create"
              hitSlop={12}
              onPress={() => form.current?.open()}
            >
              <Text className="text-2xl text-primary">＋</Text>
            </Pressable>
          ) : null
        }
      />
      <View className="px-4 pt-3">
        <TextInput
          testID="projects-search"
          className="mb-2 rounded-lg border border-border px-4 py-2 text-base text-primary"
          placeholder={t("project.searchPlaceholder")}
          placeholderTextColor="#a3a3a3"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        <View className="mb-2 flex-row gap-2">
          {(["all", "active"] as const).map((tab) => (
            <Pressable
              key={tab}
              testID={`projects-filter-${tab}`}
              onPress={() => setFilterTab(tab)}
              className={`rounded-full border px-3 py-1 ${filterTab === tab ? "border-primary bg-primary" : "border-border"}`}
            >
              <Text
                className={
                  filterTab === tab ? "text-primary-foreground" : "text-primary"
                }
              >
                {t(tab === "all" ? "project.allProjects" : "project.active")} ·{" "}
                {projects.data?.projects.length ?? 0}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {projects.isPending ? (
        <ActivityIndicator className="mt-8" />
      ) : projects.isError ? (
        <ErrorState
          message={t("home.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => projects.refetch()}
        />
      ) : (
        <FlatList
          testID="projects-list"
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="flex-grow px-4 pb-4"
          refreshing={projects.isRefetching}
          onRefresh={() => projects.refetch()}
          ListEmptyComponent={
            <EmptyState
              message={search ? t("project.noMatch") : t("home.noProjects")}
            />
          }
          renderItem={({ item }) => {
            const meta = computeBudgetMeta(
              item.budget ?? 0,
              item.spent_personal ?? 0,
              item.spent_by_credits ?? 0,
            );
            const rows = personalSpendRows(item.personal_by_type ?? undefined);
            const laborUnpaid = item.labor_unpaid ?? 0;
            return (
              <Pressable
                testID={`project-row-${item.id}`}
                onPress={() => router.push(`/projects/${item.id}`)}
              >
                <Card className="mb-3">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text
                        className="text-base font-semibold text-primary"
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.address ? (
                        <Text
                          className="text-xs text-muted-foreground"
                          numberOfLines={1}
                        >
                          {item.address}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {t("project.team")} · {item.user_count ?? 0}
                    </Text>
                  </View>
                  <View className="mt-2 flex-row items-end justify-between">
                    <Text className="text-lg font-semibold text-primary">
                      {formatMoney(item.spent ?? 0)}
                    </Text>
                    <Text
                      className={`text-xs ${meta.isOverBudget ? "text-danger" : "text-muted-foreground"}`}
                    >
                      {meta.creditTotal > 0
                        ? meta.isOverBudget
                          ? `${t("project.overBudget")} ${formatMoney(Math.abs(meta.remaining))}`
                          : `${t("project.remaining")} ${formatMoney(meta.remaining)} · ${t("project.creditTotal")} ${formatMoney(meta.creditTotal)}`
                        : t("project.budget")}
                    </Text>
                  </View>
                  <View className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <View
                      className={`h-2 rounded-full ${meta.isOverBudget ? "bg-danger" : "bg-primary"}`}
                      style={{ width: `${Math.round(meta.progress * 100)}%` }}
                    />
                  </View>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {t("project.spentByCredits")}{" "}
                    {formatMoney(meta.spentByCredits)} ·{" "}
                    {t("project.spentPersonal")}{" "}
                    {formatMoney(meta.spentPersonal)}
                  </Text>
                  {rows.length > 0 || laborUnpaid > 0 ? (
                    <View className="mt-1">
                      {rows.map((row) => (
                        <View
                          key={row.type}
                          className="flex-row justify-between"
                        >
                          <Text className="text-xs text-muted-foreground">
                            {t(`invoices.types.${row.type}`, {
                              defaultValue: row.type,
                            })}
                          </Text>
                          <Text className="text-xs text-primary">
                            {formatMoney(row.amount)}
                          </Text>
                        </View>
                      ))}
                      {laborUnpaid > 0 ? (
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-warning">
                            {t("project.laborUnpaid")}
                          </Text>
                          <Text className="text-xs text-warning">
                            {formatMoney(laborUnpaid)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          }}
        />
      )}
      <ProjectFormSheet
        ref={form}
        submitting={createProject.isPending}
        onSubmit={(values) =>
          createProject.mutate(
            {
              name: values.name,
              address: values.address,
              budget: values.budget,
              budget_source: values.budget_source,
            },
            {
              onSuccess: (created) => {
                form.current?.close();
                router.push(`/projects/${created.id}`);
              },
            },
          )
        }
      />
    </View>
  );
}
