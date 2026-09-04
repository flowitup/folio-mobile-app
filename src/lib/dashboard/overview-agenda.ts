/** Agenda grouping for the dashboard "This week" card, copied from the web helper. */
import type { Task } from "@/features/tasks/tasks-api";

import { addWeeks, startOfWeekMonday, toDateKey } from "./week";

export type AgendaGroupKey = "overdue" | "today" | "thisWeek";
export const AGENDA_GROUP_ORDER: readonly AgendaGroupKey[] = [
  "overdue",
  "today",
  "thisWeek",
];

// Overdue is capped below the total budget so a long backlog cannot hide this week's items.
const OVERDUE_GROUP_CAP = 3;

export interface AgendaGroup {
  key: AgendaGroupKey;
  tasks: Task[];
}

export function groupAgendaTasks(
  tasks: Task[],
  referenceDate: Date = new Date(),
  maxItems = 6,
): AgendaGroup[] {
  const todayKey = toDateKey(referenceDate);
  const weekStart = startOfWeekMonday(referenceDate);
  const weekEndKey = toDateKey(addWeeks(weekStart, 1));

  const byGroup: Record<AgendaGroupKey, Task[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
  };
  const eligible = tasks
    .filter((t) => t.status !== "done" && !!t.due_date)
    .sort((a, b) =>
      a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0,
    );

  for (const task of eligible) {
    const due = task.due_date!;
    if (due < todayKey) byGroup.overdue.push(task);
    else if (due === todayKey) byGroup.today.push(task);
    else if (due < weekEndKey) byGroup.thisWeek.push(task);
  }

  let remaining = maxItems;
  return AGENDA_GROUP_ORDER.map((key) => {
    const groupCap =
      key === "overdue" ? Math.min(OVERDUE_GROUP_CAP, remaining) : remaining;
    const capped = byGroup[key].slice(0, Math.max(groupCap, 0));
    remaining -= capped.length;
    return { key, tasks: capped };
  }).filter((g) => g.tasks.length > 0);
}
