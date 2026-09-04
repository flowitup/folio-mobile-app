import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Card, EmptyState } from "@/components/ui/primitives";
import { ScreenTitle } from "@/components/ui/typography";
import { shortDayMonth } from "@/features/dashboard/overview-cards";
import { useSelectedProject } from "@/features/projects/selected-project";
import { TaskFormSheet } from "@/features/tasks/task-form-sheet";
import type { TaskFormSheetHandle } from "@/features/tasks/task-form-sheet";
import {
  BOARD_COLUMNS,
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useTasks,
  useUpdateTask,
} from "@/features/tasks/tasks-api";
import type { Task, TaskStatus } from "@/features/tasks/tasks-api";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";
import { useTokens } from "@/theme/tokens";

const PRIORITY_CLASS = {
  urgent: "text-negative",
  high: "text-warning",
  medium: "text-muted",
  low: "text-muted",
} as const;

/** Kế hoạch: lane tabs (underline + mono count), task list card, create / edit / move / delete. */
export default function PlanningTab() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { projectId, project } = useSelectedProject();
  const tasks = useTasks(projectId);
  const create = useCreateTask(projectId);
  const update = useUpdateTask(projectId);
  const move = useMoveTask(projectId);
  const remove = useDeleteTask(projectId);
  useRefetchOnFocus(tasks.refetch);

  const [lane, setLane] = useState<TaskStatus>("todo");
  const [deleting, setDeleting] = useState<Task | null>(null);
  const form = useRef<TaskFormSheetHandle>(null);

  const byLane = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>(BOARD_COLUMNS.map((s) => [s, []]));
    for (const task of [...(tasks.data ?? [])].sort(
      (a, b) => a.position - b.position,
    ))
      map.get(task.status)?.push(task);
    return map;
  }, [tasks.data]);
  const laneTasks = byLane.get(lane) ?? [];
  const indexOf = (task: Task) =>
    (byLane.get(task.status) ?? []).findIndex((x) => x.id === task.id);

  function shift(task: Task, direction: -1 | 1) {
    const siblings = byLane.get(task.status) ?? [];
    const target = siblings[indexOf(task) + direction];
    if (!target) return;
    move.mutate(
      direction < 0
        ? { taskId: task.id, status: task.status, beforeId: target.id }
        : { taskId: task.id, status: task.status, afterId: target.id },
    );
  }

  return (
    <View className="flex-1 bg-paper">
      <ProjectTopBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6 pt-3.5"
        contentContainerStyle={{ gap: 16 }}
      >
        <View className="flex-row items-center justify-between">
          <ScreenTitle testID="planning-title" className="text-2xl">
            {t("tabs.planning")}
          </ScreenTitle>
          {project ? (
            <Pressable
              testID="task-create"
              accessibilityRole="button"
              onPress={() => form.current?.open(null, lane)}
              className="h-[34px] items-center justify-center rounded-lg bg-ink px-3 active:opacity-70"
            >
              <Text className="font-sans-semibold text-[13px] text-on-ink">
                + {t("planning.newTask")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-4 max-h-11 border-b border-line"
          contentContainerClassName="flex-row gap-[18px] px-4"
        >
          {BOARD_COLUMNS.map((value) => {
            const active = lane === value;
            return (
              <Pressable
                key={value}
                testID={`lane-${value}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setLane(value)}
                className={`flex-row items-center gap-1.5 border-b-2 pb-2.5 pt-2 ${active ? "border-ink" : "border-transparent"}`}
              >
                <Text
                  className={`text-[14px] ${active ? "font-sans-semibold text-ink" : "font-sans-medium text-muted"}`}
                >
                  {t(`tasks.status.${value}`)}
                </Text>
                <Text className="font-mono-regular text-[11px] text-muted">
                  {byLane.get(value)?.length ?? 0}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tasks.isPending ? (
          <ActivityIndicator className="mt-6" color={tokens.ink} />
        ) : null}
        {!tasks.isPending && laneTasks.length === 0 ? (
          <EmptyState message={t("tasks.none")} />
        ) : null}
        {laneTasks.length > 0 ? (
          <Card padded={false} className="overflow-hidden" testID="task-list">
            {laneTasks.map((task) => {
              const done = task.status === "done";
              return (
                <Pressable
                  key={task.id}
                  testID={`task-${task.id}`}
                  accessibilityRole="button"
                  onPress={() => form.current?.open(task, lane)}
                  className="flex-row items-start gap-3 border-b border-line px-3.5 py-3 active:opacity-70"
                >
                  <Pressable
                    testID={`task-toggle-${task.id}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    hitSlop={8}
                    onPress={() =>
                      move.mutate({
                        taskId: task.id,
                        status: done ? "todo" : "done",
                      })
                    }
                    className={`mt-px h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] border-line-2 ${done ? "bg-positive-tint" : ""}`}
                  >
                    {done ? (
                      <Icon name="check" size={11} color={tokens.positive} />
                    ) : null}
                  </Pressable>
                  <View className="min-w-0 flex-1">
                    <Text
                      className={`font-sans-medium text-[14px] text-ink ${done ? "line-through" : ""}`}
                    >
                      {task.title}
                    </Text>
                    <View className="mt-[3px] flex-row items-center gap-2">
                      {task.due_date ? (
                        <Text className="font-mono-regular text-[11.5px] text-muted">
                          {shortDayMonth(task.due_date)}
                        </Text>
                      ) : null}
                      <Text
                        className={`font-sans-medium text-[11.5px] ${PRIORITY_CLASS[task.priority]}`}
                      >
                        {t(`tasks.priority.${task.priority}`)}
                      </Text>
                      {task.labels.length > 0 ? (
                        <Text
                          className="font-sans text-[11.5px] text-muted"
                          numberOfLines={1}
                        >
                          {task.labels.join(" · ")}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Icon name="more-vertical" size={18} color={tokens.muted2} />
                </Pressable>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>

      <TaskFormSheet
        ref={form}
        submitting={create.isPending || update.isPending}
        canMoveUp={(task) => indexOf(task) > 0}
        canMoveDown={(task) =>
          indexOf(task) < (byLane.get(task.status)?.length ?? 0) - 1
        }
        onMove={shift}
        onDelete={setDeleting}
        onSubmit={(values, editing) => {
          if (editing)
            update.mutate(
              {
                taskId: editing.id,
                title: values.title,
                description: values.description,
                priority: values.priority,
                due_date: values.due_date,
                labels: values.labels,
              },
              {
                onSuccess: () => {
                  if (values.status !== editing.status)
                    move.mutate({ taskId: editing.id, status: values.status });
                  form.current?.close();
                },
              },
            );
          else
            create.mutate(
              { ...values, assignee_id: null },
              { onSuccess: () => form.current?.close() },
            );
        }}
      />
      <ConfirmDialog
        visible={deleting !== null}
        title={t("tasks.deleteConfirm", { title: deleting?.title ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { taskId: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </View>
  );
}
