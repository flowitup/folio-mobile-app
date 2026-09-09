import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
} from "@/components/ui/primitives";
import { ScreenTitle } from "@/components/ui/typography";
import { useRateChanges, useWorkers } from "@/features/labor/labor-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { projectDisplayName } from "@/lib/projects/project-display-name";
import { formatDate, toIsoDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { buildRateHistory, currentDailyRate } from "@/lib/labor/rate-history";
import type { RateHistoryRow } from "@/lib/labor/rate-history";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens, workerColor } from "@/theme/tokens";

/**
 * Worker mode · Hồ sơ: the signed-in worker's own profile on the selected project — identity
 * (name, labor role, phone), the daily rate in force today and the history of rate changes.
 * The backend narrows `/workers` and `/workers/{id}/rate-changes` to the worker linked to this
 * account (D3: a member only ever sees their own pay), so the screen is read-only: changing a
 * rate needs `project:manage_labor`, which a worker-mode user does not hold.
 */
export function WorkerProfileTab() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { user } = useAuth();
  const {
    projectId,
    project,
    isPending: projectPending,
  } = useSelectedProject();
  const today = useMemo(() => toIsoDate(new Date()), []);

  const workers = useWorkers(projectId);
  // Only the worker linked to this account — never a first-row fallback: a member granted
  // `project:view_pay` (D8) is still in worker mode here but receives every worker from the
  // backend, and this screen must show their own pay only.
  const myWorker = user?.id
    ? (workers.data ?? []).find((w) => w.user_id === user.id)
    : undefined;
  const changes = useRateChanges(projectId, myWorker?.id ?? null);
  // A manager's rate change lands here on the next visit without a pull-to-refresh. The
  // history query is disabled without a linked worker; `refetch` would still run it (with an
  // unsubstituted path), so it is only re-issued while there is a worker to ask for.
  const refetchChanges = changes.refetch;
  const hasWorker = Boolean(myWorker);
  useRefetchOnFocus(workers.refetch);
  useRefetchOnFocus(
    useCallback(() => {
      if (hasWorker) void refetchChanges();
    }, [hasWorker, refetchChanges]),
  );

  const history = useMemo(
    () =>
      myWorker
        ? buildRateHistory(changes.data ?? [], myWorker.daily_rate, today)
        : [],
    [changes.data, myWorker, today],
  );
  // With the history unavailable and no backend `current_daily_rate`, today's rate cannot be
  // resolved — show a dash rather than the starting rate presented as current.
  const rateToday = myWorker
    ? changes.isError && !((myWorker.current_daily_rate ?? 0) > 0)
      ? null
      : currentDailyRate(myWorker, changes.data ?? [], today)
    : null;
  const roleName = myWorker?.role_name ?? null;
  const phone = myWorker?.person_phone ?? myWorker?.phone ?? null;

  if (!projectPending && !project)
    return (
      <View className="flex-1 bg-paper">
        <ProjectTopBar />
        <EmptyState message={t("dashboard.noProjects")} />
      </View>
    );

  return (
    <View className="flex-1 bg-paper">
      <ProjectTopBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6 pt-3.5"
        contentContainerStyle={{ gap: 16 }}
      >
        <View>
          <ScreenTitle testID="worker-profile-title">
            {t("worker.profileTitle")}
          </ScreenTitle>
          <Text className="mt-1 font-sans text-[12.5px] text-muted">
            {t("worker.profileSub")}
          </Text>
        </View>

        {workers.isPending ? (
          <ActivityIndicator className="my-6" color={tokens.ink} />
        ) : null}

        {workers.isError ? (
          <ErrorState
            message={t("worker.profile.workersError")}
            retryLabel={t("common.retry")}
            onRetry={() => void workers.refetch()}
          />
        ) : null}

        {workers.isSuccess && !myWorker ? (
          <Card radius={14} testID="worker-not-linked">
            <Text className="font-sans text-[13px] text-muted">
              {t("worker.notLinked")}
            </Text>
          </Card>
        ) : null}

        {myWorker ? (
          <>
            <Card radius={16} elevated testID="worker-profile-card">
              <View className="flex-row items-center gap-3">
                <Avatar
                  name={myWorker.person_name ?? myWorker.name}
                  size={52}
                  color={workerColor(tokens, myWorker.role_color, 0)}
                />
                <View className="min-w-0 flex-1">
                  <Text
                    testID="worker-profile-name"
                    className="font-sans-semibold text-[17px] text-ink"
                    numberOfLines={1}
                  >
                    {myWorker.person_name ?? myWorker.name}
                  </Text>
                  <Text
                    testID="worker-profile-role"
                    className="mt-0.5 font-sans text-[12.5px] text-muted"
                    numberOfLines={1}
                  >
                    {roleName ?? t("worker.profile.noRole")}
                  </Text>
                </View>
                {!myWorker.is_active ? (
                  <Badge label={t("labor.workers.inactive")} tone="warning" />
                ) : null}
              </View>

              <View className="mt-4 gap-2.5 border-t border-line pt-3.5">
                <ProfileLine
                  label={t("worker.profile.phone")}
                  value={phone ?? "—"}
                  testID="worker-profile-phone"
                />
                <ProfileLine
                  label={t("worker.profile.site")}
                  value={project ? projectDisplayName(project) : "—"}
                  testID="worker-profile-site"
                />
              </View>

              <View className="mt-4 rounded-[12px] bg-paper-2 px-3.5 py-3">
                <Text className="font-sans-medium text-[11px] uppercase tracking-[1.1px] text-muted">
                  {t("worker.profile.dailyRate")}
                </Text>
                <Text
                  testID="worker-profile-rate"
                  className="mt-1 font-mono text-[24px] text-ink"
                >
                  {rateToday === null ? "—" : formatMoney(rateToday)}
                </Text>
                <Text className="mt-0.5 font-sans text-[11.5px] text-muted">
                  {t("worker.profile.perDay")}
                </Text>
              </View>
            </Card>

            <View className="gap-2">
              <Text className="font-sans-medium text-[11px] uppercase tracking-[1.1px] text-muted">
                {t("worker.profile.history")}
              </Text>
              {changes.isPending ? (
                <ActivityIndicator className="my-4" color={tokens.ink} />
              ) : null}
              {changes.isError ? (
                <Card radius={14} testID="worker-rate-history-error">
                  <Text className="font-sans text-[13px] text-negative">
                    {t("worker.profile.historyError")}
                  </Text>
                </Card>
              ) : null}
              {changes.isSuccess && changes.data.length === 0 ? (
                <Text
                  testID="worker-rate-history-empty"
                  className="font-sans text-[12.5px] text-muted"
                >
                  {t("worker.profile.historyEmpty")}
                </Text>
              ) : null}
              {changes.isSuccess ? (
                <Card radius={14} padded={false} testID="worker-rate-history">
                  {history.map((row, index) => (
                    <RateHistoryLine
                      key={row.id}
                      row={row}
                      last={index === history.length - 1}
                      createdAt={myWorker.created_at}
                    />
                  ))}
                </Card>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ProfileLine({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="font-sans text-[12.5px] text-muted">{label}</Text>
      <Text
        testID={testID}
        className="min-w-0 flex-1 text-right font-sans-medium text-[13.5px] text-ink"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/** One row of the pay history: date (or "starting rate"), amount, and the signed step. */
function RateHistoryLine({
  row,
  last,
  createdAt,
}: {
  row: RateHistoryRow;
  last: boolean;
  createdAt: string;
}) {
  const { t } = useTranslation();
  const isBase = row.effectiveDate === null;
  const delta = row.delta ?? 0;
  return (
    <View
      testID={`worker-rate-row-${row.id}`}
      className={`flex-row items-center justify-between gap-3 px-3.5 py-3 ${last ? "" : "border-b border-line"}`}
    >
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-[13.5px] text-ink">
          {isBase
            ? t("worker.profile.startingRate")
            : t("worker.profile.since", {
                date: formatDate(row.effectiveDate),
              })}
        </Text>
        <Text className="mt-0.5 font-sans text-[11.5px] text-muted">
          {isBase
            ? t("worker.profile.joined", { date: formatDate(createdAt) })
            : row.upcoming
              ? t("worker.profile.upcoming")
              : t("worker.profile.applied")}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="font-mono text-[14px] text-ink">
          {formatMoney(row.rate)}
        </Text>
        {!isBase && delta !== 0 ? (
          <View
            accessible
            accessibilityLabel={t(
              delta > 0 ? "worker.profile.increase" : "worker.profile.decrease",
              { amount: formatMoney(Math.abs(delta)) },
            )}
          >
            <Badge
              testID={`worker-rate-delta-${row.id}`}
              tone={delta > 0 ? "success" : "danger"}
              label={`${delta > 0 ? "+" : "−"}${formatMoney(Math.abs(delta))}`}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
