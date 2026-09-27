import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { Icon } from "@/components/ui/icon";
import { Card, EmptyState } from "@/components/ui/primitives";
import { ScreenTitle } from "@/components/ui/typography";
import { exportLabor, useWorkers } from "@/features/labor/labor-api";
import { LaborExportSheet } from "@/features/labor/labor-tab-sheets";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useTokens } from "@/theme/tokens";

import ProjectSalariesSection from "../../../app/(app)/(tabs)/projects/[id]/salaries";

/**
 * Worker mode · Lương: the worker's own salary on the selected project — totals (earned,
 * paid, outstanding), then one card per month with the payments received. Reuses the
 * salaries section; the backend narrows workers/invoices to the linked worker, so the
 * picker shows only them and the pay actions stay hidden (no manage_invoices).
 */
export function WorkerSalaryTab() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { projectId, project, isPending } = useSelectedProject();
  const workers = useWorkers(projectId);
  // Worker mode also covers a company member nobody linked to a worker yet. The list the
  // backend narrows to that account then comes back empty, and the shared salaries section
  // reads it as "this site has no workers" — which is about the site, not about them. Say
  // what the attendance and profile tabs say instead.
  const ownWorker = workers.data?.find((w) => w.user_id === user?.id);
  const notLinked = workers.isSuccess && !ownWorker;
  const tokens = useTokens();
  const exportSheet = useRef<BottomSheetModal>(null);

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
        {/* The backend serves a linked worker their own timesheet (never the project's). */}
        {ownWorker ? (
          <Pressable
            testID="worker-salary-export"
            accessibilityRole="button"
            onPress={() => exportSheet.current?.present()}
            className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-line-2 active:opacity-70"
          >
            <Icon name="download" size={15} color={tokens.ink} />
            <Text className="font-sans-medium text-[13px] text-ink">
              {t("expenses.export")}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {notLinked ? (
        <View className="px-4 pt-4">
          <Card radius={14} testID="worker-salary-not-linked">
            <Text className="font-sans text-[13px] text-muted">
              {t("worker.notLinked")}
            </Text>
          </Card>
        </View>
      ) : projectId ? (
        <ProjectSalariesSection key={projectId} projectId={projectId} />
      ) : null}
      {ownWorker ? (
        <LaborExportSheet
          ref={exportSheet}
          projectId={projectId}
          workers={[ownWorker]}
          allowAllWorkers={false}
          onExport={exportLabor}
        />
      ) : null}
    </View>
  );
}
