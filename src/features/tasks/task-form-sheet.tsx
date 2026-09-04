import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { BOARD_COLUMNS, PRIORITIES } from "@/features/tasks/tasks-api";
import type {
  Task,
  TaskPriority,
  TaskStatus,
} from "@/features/tasks/tasks-api";

export type TaskFormValues = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  labels: string[];
};

export type TaskFormSheetHandle = {
  /** Opens the sheet seeded with a task (edit) or a lane (create). */
  open: (task: Task | null, lane: TaskStatus) => void;
  close: () => void;
};

type Props = {
  submitting: boolean;
  onSubmit: (values: TaskFormValues, editing: Task | null) => void;
  onMove: (task: Task, direction: -1 | 1) => void;
  onDelete: (task: Task) => void;
  canMoveUp: (task: Task) => boolean;
  canMoveDown: (task: Task) => boolean;
};

/** Task create / edit sheet; editing also offers reorder (↑ ↓) and delete. */
export const TaskFormSheet = forwardRef<TaskFormSheetHandle, Props>(
  function TaskFormSheet(
    { submitting, onSubmit, onMove, onDelete, canMoveUp, canMoveDown },
    ref,
  ) {
    const { t } = useTranslation();
    const sheet = useRef<BottomSheetModal>(null);
    const [editing, setEditing] = useState<Task | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("medium");
    const [status, setStatus] = useState<TaskStatus>("todo");
    const [dueDate, setDueDate] = useState<string | null>(null);
    const [labels, setLabels] = useState("");
    const [titleError, setTitleError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      open: (task, lane) => {
        setEditing(task);
        setTitle(task?.title ?? "");
        setDescription(task?.description ?? "");
        setPriority(task?.priority ?? "medium");
        setStatus(task?.status ?? lane);
        setDueDate(task?.due_date ?? null);
        setLabels((task?.labels ?? []).join(", "));
        setTitleError(null);
        sheet.current?.present();
      },
      close: () => sheet.current?.dismiss(),
    }));

    function submit() {
      const trimmed = title.trim();
      if (!trimmed) return setTitleError(t("tasks.titleRequired"));
      onSubmit(
        {
          title: trimmed,
          description: description.trim() || null,
          priority,
          status,
          due_date: dueDate,
          labels: labels
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        },
        editing,
      );
    }

    const statusOptions = BOARD_COLUMNS.map((value) => ({
      value,
      label: t(`tasks.status.${value}`),
    }));

    return (
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
            loading={submitting}
            onPress={submit}
          />
          {editing ? (
            <View className="mt-3 flex-row gap-2">
              <Button
                testID={`task-up-${editing.id}`}
                label={`↑ ${t("planning.moveUp")}`}
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={!canMoveUp(editing)}
                onPress={() => onMove(editing, -1)}
              />
              <Button
                testID={`task-down-${editing.id}`}
                label={`↓ ${t("planning.moveDown")}`}
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={!canMoveDown(editing)}
                onPress={() => onMove(editing, 1)}
              />
              <Button
                testID={`task-delete-${editing.id}`}
                label={t("common.delete")}
                variant="danger"
                size="sm"
                className="flex-1"
                onPress={() => {
                  sheet.current?.dismiss();
                  onDelete(editing);
                }}
              />
            </View>
          ) : null}
        </ScrollView>
      </Sheet>
    );
  },
);
