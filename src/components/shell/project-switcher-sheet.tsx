import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { useShell } from "@/components/shell/shell-context";
import { ShellSheet } from "@/components/shell/shell-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Eyebrow } from "@/components/ui/typography";
import { ProjectFormSheet } from "@/features/projects/project-form-sheet";
import type { ProjectFormSheetHandle } from "@/features/projects/project-form-sheet";
import { projectCan, useCreateProject } from "@/features/projects/projects-api";
import type { Project } from "@/features/projects/projects-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { formatMoney } from "@/lib/format/money";
import { computeBudgetMeta } from "@/lib/projects/budget-display";

/** Second line of a switcher row: address · members · budget state (README "Đổi công trình"). */
export function projectRowMeta(
  project: Project,
  t: (key: string, options?: Record<string, unknown>) => string,
): {
  meta: string;
  remain: string;
  tone: "ink" | "negative" | "muted";
  pct: number;
} {
  const meta = computeBudgetMeta(
    project.budget ?? 0,
    project.spent_personal ?? 0,
    project.spent_by_credits ?? 0,
  );
  const parts = [
    project.address,
    t("shell.membersCount", { count: project.user_count ?? 0 }),
  ].filter(Boolean) as string[];
  if (meta.creditTotal <= 0) {
    parts.push(t("shell.noBudget"));
    return {
      meta: parts.join(" · "),
      remain: t("shell.spentNoBudget", {
        amount: formatMoney(project.spent ?? 0),
      }),
      tone: "muted",
      pct: 0,
    };
  }
  if (meta.isOverBudget) {
    parts.push(t("shell.overBudget"));
    return {
      meta: parts.join(" · "),
      remain: formatMoney(meta.remaining),
      tone: "negative",
      pct: 100,
    };
  }
  const pct = Math.round(meta.progress * 100);
  parts.push(t("shell.pctSpent", { pct }));
  return {
    meta: parts.join(" · "),
    remain: formatMoney(meta.remaining),
    tone: "ink",
    pct,
  };
}

const REMAIN_CLASS = {
  ink: "text-ink",
  negative: "text-negative",
  muted: "text-muted",
} as const;

/** "Đổi công trình" sheet: every project with its remaining budget, current row highlighted, "+ new". */
export function ProjectSwitcherSheet() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { sheet, closeSheet } = useShell();
  const { projects, projectId, select } = useSelectedProject();
  const createProject = useCreateProject();
  const form = useRef<ProjectFormSheetHandle>(null);
  const canCreate = projectCan(undefined, "project:create", user?.permissions);

  return (
    <>
      <ShellSheet open={sheet === "switcher"} testID="switcher-sheet">
        <Eyebrow className="mb-2">
          {t("shell.projectsCount", { count: projects.length })}
        </Eyebrow>
        <View className="overflow-hidden rounded-xl border border-line bg-card">
          <ScrollView style={{ maxHeight: 340 }} bounces={false}>
            {projects.map((project) => {
              const row = projectRowMeta(project, t);
              const current = project.id === projectId;
              return (
                <Pressable
                  key={project.id}
                  testID={`switcher-project-${project.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  onPress={() => {
                    select(project.id);
                    closeSheet();
                  }}
                  className={`flex-row items-center gap-3 border-b border-line px-3.5 py-3 active:opacity-70 ${current ? "bg-paper-2" : ""}`}
                >
                  <Avatar name={project.name} size={34} square />
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="min-w-0 flex-1 font-sans-medium text-[14px] text-ink"
                        numberOfLines={1}
                      >
                        {project.name}
                      </Text>
                      <Text
                        className={`ml-2 font-mono text-[14px] ${REMAIN_CLASS[row.tone]}`}
                      >
                        {row.remain}
                      </Text>
                    </View>
                    <View className="mt-[5px] h-[3px] overflow-hidden rounded-sm bg-paper-2">
                      <View
                        className={`h-[3px] ${row.tone === "negative" ? "bg-negative" : "bg-ink"}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </View>
                    <Text
                      className="mt-1 font-sans text-[11px] text-muted"
                      numberOfLines={1}
                    >
                      {row.meta}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {canCreate ? (
            <Pressable
              testID="switcher-new-project"
              accessibilityRole="button"
              onPress={() => form.current?.open()}
              className="px-3.5 py-3 active:opacity-70"
            >
              <Text className="font-sans-medium text-[14px] text-accent-ink">
                {t("shell.newProject")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ShellSheet>
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
                select(created.id);
                closeSheet();
              },
            },
          )
        }
      />
    </>
  );
}
