import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import {
  BOARD_COLUMNS,
  PRIORITIES,
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useTasks,
  useUpdateTask,
} from "@/features/tasks/tasks-api";
import type {
  Task,
  TaskPriority,
  TaskStatus,
} from "@/features/tasks/tasks-api";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

const PRIORITY_TONE = {
  low: "neutral",
  medium: "neutral",
  high: "warning",
  urgent: "danger",
} as const;

/** Planning board: one lane per status (tabs), cards ordered by position, move / reorder, create, edit, delete. */
export default function ProjectPlanningSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tasks = useTasks(id);
  const create = useCreateTask(id);
  const update = useUpdateTask(id);
  const move = useMoveTask(id);
  const remove = useDeleteTask(id);
  useRefetchOnFocus(tasks.refetch);

  const [lane, setLane] = useState<TaskStatus>("todo");
  const sheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [labels, setLabels] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const byLane = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>(BOARD_COLUMNS.map((s) => [s, []]));
    for (const task of [...(tasks.data ?? [])].sort(
      (a, b) => a.position - b.position,
    ))
      map.get(task.status)?.push(task);
    return map;
  }, [tasks.data]);
  const laneTasks = byLane.get(lane) ?? [];

  function openForm(task: Task | null) {
    setEditing(task);
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "medium");
    setStatus(task?.status ?? lane);
    setDueDate(task?.due_date ?? null);
    setLabels((task?.labels ?? []).join(", "));
    setTitleError(null);
    sheet.current?.present();
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return setTitleError(t("tasks.titleRequired"));
    const labelList = labels
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const done = { onSuccess: () => sheet.current?.dismiss() };
    if (editing) {
      update.mutate(
        {
          taskId: editing.id,
          title: trimmed,
          description: description.trim() || null,
          priority,
          due_date: dueDate,
          labels: labelList,
        },
        {
          onSuccess: () => {
            if (status !== editing.status)
              move.mutate({ taskId: editing.id, status });
            sheet.current?.dismiss();
          },
        },
      );
    } else
      create.mutate(
        {
          title: trimmed,
          description: description.trim() || null,
          priority,
          status,
          due_date: dueDate,
          labels: labelList,
          assignee_id: null,
        },
        done,
      );
  }

  function shift(task: Task, direction: -1 | 1) {
    const index = laneTasks.findIndex((x) => x.id === task.id);
    const target = laneTasks[index + direction];
    if (!target) return;
    move.mutate(
      direction < 0
        ? { taskId: task.id, status: task.status, beforeId: target.id }
        : { taskId: task.id, status: task.status, afterId: target.id },
    );
  }

  const statusOptions = BOARD_COLUMNS.map((value) => ({
    value,
    label: t(`tasks.status.${value}`),
  }));

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-11 border-b border-border"
        contentContainerClassName="px-2"
      >
        {BOARD_COLUMNS.map((value) => (
          <Pressable
            key={value}
            testID={`lane-${value}`}
            onPress={() => setLane(value)}
            className={`justify-center border-b-2 px-3 ${lane === value ? "border-primary" : "border-transparent"}`}
          >
            <Text
              className={
                lane === value
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
            >
              {t(`tasks.status.${value}`)} ({byLane.get(value)?.length ?? 0})
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerClassName="p-4 pb-12">
        <Button
          testID="task-create"
          label={t("tasks.create")}
          className="mb-3"
          onPress={() => openForm(null)}
        />
        {tasks.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {!tasks.isPending && laneTasks.length === 0 ? (
          <EmptyState message={t("tasks.none")} />
        ) : null}
        {laneTasks.map((task, index) => (
          <Pressable
            key={task.id}
            testID={`task-${task.id}`}
            onPress={() => openForm(task)}
          >
            <Card className="mb-2">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-2 text-base font-medium text-primary">
                  {task.title}
                </Text>
                <Badge
                  label={t(`tasks.priority.${task.priority}`)}
                  tone={PRIORITY_TONE[task.priority]}
                />
              </View>
              {task.description ? (
                <Text className="mt-1 text-sm text-primary" numberOfLines={2}>
                  {task.description}
                </Text>
              ) : null}
              <View className="mt-1 flex-row flex-wrap items-center gap-1">
                {task.due_date ? (
                  <Text className="text-xs text-muted-foreground">
                    {t("tasks.due", { date: formatDate(task.due_date) })}
                  </Text>
                ) : null}
                {task.labels.map((label) => (
                  <Badge key={label} label={label} />
                ))}
              </View>
              <View className="mt-2 flex-row items-center gap-3">
                <View className="flex-1">
                  <Select<TaskStatus>
                    testID={`task-move-${task.id}`}
                    value={task.status}
                    options={statusOptions}
                    onChange={(next) =>
                      next !== task.status &&
                      move.mutate({ taskId: task.id, status: next })
                    }
                  />
                </View>
                <Pressable
                  testID={`task-up-${task.id}`}
                  disabled={index === 0}
                  onPress={() => shift(task, -1)}
                  className="mb-4 px-2"
                >
                  <Text
                    className={
                      index === 0 ? "text-muted-foreground" : "text-primary"
                    }
                  >
                    ↑
                  </Text>
                </Pressable>
                <Pressable
                  testID={`task-down-${task.id}`}
                  disabled={index === laneTasks.length - 1}
                  onPress={() => shift(task, 1)}
                  className="mb-4 px-2"
                >
                  <Text
                    className={
                      index === laneTasks.length - 1
                        ? "text-muted-foreground"
                        : "text-primary"
                    }
                  >
                    ↓
                  </Text>
                </Pressable>
                <Pressable
                  testID={`task-delete-${task.id}`}
                  onPress={() => setDeleting(task)}
                  className="mb-4"
                >
                  <Text className="text-sm text-danger">
                    {t("common.delete")}
                  </Text>
                </Pressable>
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>

      <Sheet
        ref={sheet}
        title={editing ? t("tasks.edit") : t("tasks.create")}
        snapPoints={["85%"]}
      >
        <ScrollView
          contentContainerClassName="p-4"
          keyboardShouldPersistTaps="handled"
        >
          <Input
            testID="task-title"
            label={t("tasks.title")}
            value={title}
            onChangeText={setTitle}
            error={titleError}
            autoFocus
          />
          <Input
            testID="task-description"
            label={t("tasks.description")}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Select<TaskStatus>
            testID="task-status"
            label={t("tasks.statusLabel")}
            value={status}
            options={statusOptions}
            onChange={setStatus}
          />
          <Select<TaskPriority>
            testID="task-priority"
            label={t("tasks.priorityLabel")}
            value={priority}
            options={PRIORITIES.map((value) => ({
              value,
              label: t(`tasks.priority.${value}`),
            }))}
            onChange={setPriority}
          />
          <DatePicker
            testID="task-due"
            label={t("tasks.dueDate")}
            value={dueDate}
            onChange={setDueDate}
            clearable
            doneLabel={t("common.ok")}
          />
          <Input
            testID="task-labels"
            label={t("tasks.labels")}
            value={labels}
            onChangeText={setLabels}
            hint={t("documents.tagsHint")}
            autoCapitalize="none"
          />
          <Button
            testID="task-submit"
            label={t("common.save")}
            loading={create.isPending || update.isPending}
            onPress={submit}
          />
        </ScrollView>
      </Sheet>
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
