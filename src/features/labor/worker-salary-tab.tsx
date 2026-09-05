import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { EmptyState } from "@/components/ui/primitives";
import { ScreenTitle } from "@/components/ui/typography";
import { useSelectedProject } from "@/features/projects/selected-project";

import ProjectSalariesSection from "../../../app/(app)/(tabs)/projects/[id]/salaries";

/**
 * Worker mode · Lương: the worker's own salary on the selected project — totals (earned,
 * paid, outstanding), then one card per month with the payments received. Reuses the
 * salaries section; the backend narrows workers/invoices to the linked worker, so the
 * picker shows only them and the pay actions stay hidden (no manage_invoices).
 */
export function WorkerSalaryTab() {
  const { t } = useTranslation();
  const { projectId, project, isPending } = useSelectedProject();

  if (!isPending && !project)
    return (
      <View className="flex-1 bg-paper">
        <ProjectTopBar />
        <EmptyState message={t("dashboard.noProjects")} />
      </View>
    );

  return (
    <View className="flex-1 bg-paper">
      <ProjectTopBar />
      <View className="px-4 pt-3.5">
        <ScreenTitle testID="worker-salary-title">
          {t("worker.salaryTitle")}
        </ScreenTitle>
        <Text className="mt-1 font-sans text-[12.5px] text-muted">
          {t("worker.salarySub")}
        </Text>
      </View>
      {projectId ? (
        <ProjectSalariesSection key={projectId} projectId={projectId} />
      ) : null}
    </View>
  );
}
