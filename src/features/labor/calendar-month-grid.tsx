import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import type { Tag } from "@/features/projects/tags-api";
import { toIsoDate } from "@/lib/format/date";

import type {
  LaborActivity,
  LaborDayDescription,
  LaborEntry,
} from "./labor-types";

/** Builds the 6×7 grid of ISO dates for a `YYYY-MM` month, Monday first; null = outside the month. */
export function buildMonthCells(month: string): (string | null)[] {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(year, m - 1, 1);
  const daysInMonth = new Date(year, m, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++)
    cells.push(toIsoDate(new Date(year, m - 1, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const SHIFT_GLYPH: Record<string, string> = {
  full: "●",
  half: "◐",
  overtime: "◔",
};

type Props = {
  month: string;
  entries: LaborEntry[];
  activities: LaborActivity[];
  dayDescriptions: LaborDayDescription[];
  tags: Tag[];
  selected: string | null;
  onSelectDay: (iso: string) => void;
};

/** Month grid: per day the worker chips (shift glyph + role color), activity marker, description marker, tag dots. */
export function CalendarMonthGrid({
  month,
  entries,
  activities,
  dayDescriptions,
  tags,
  selected,
  onSelectDay,
}: Props) {
  const { t } = useTranslation();
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const today = toIsoDate(new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, LaborEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, [entries]);
  const activityDays = useMemo(
    () => new Set(activities.map((a) => a.date)),
    [activities],
  );
  const descriptionDays = useMemo(
    () => new Set(dayDescriptions.map((d) => d.date)),
    [dayDescriptions],
  );
  const tagColor = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag.color])),
    [tags],
  );

  const weekdays = t("labor.calendar.weekdays", {
    returnObjects: true,
  }) as string[];

  return (
    <View testID="calendar-grid">
      <View className="flex-row">
        {weekdays.map((label) => (
          <Text
            key={label}
            className="flex-1 py-1 text-center text-xs text-muted-foreground"
          >
            {label}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} className="flex-row">
          {cells.slice(row * 7, row * 7 + 7).map((iso, column) => {
            if (!iso)
              return (
                <View
                  key={column}
                  className="flex-1 border border-transparent"
                  style={{ minHeight: 64 }}
                />
              );
            const dayEntries = byDay.get(iso) ?? [];
            const dotColors = Array.from(
              new Set(
                dayEntries
                  .map((e) => e.tag_id && tagColor.get(e.tag_id))
                  .filter(Boolean) as string[],
              ),
            );
            const isSelected = iso === selected;
            return (
              <Pressable
                key={iso}
                testID={`calendar-day-${iso}`}
                onPress={() => onSelectDay(iso)}
                className={`flex-1 border p-1 ${isSelected ? "border-primary bg-paper-2" : "border-border"}`}
                style={{ minHeight: 64 }}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-xs ${iso === today ? "font-bold text-primary" : "text-muted-foreground"}`}
                  >
                    {Number(iso.slice(8, 10))}
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">
                    {activityDays.has(iso) ? "▲" : ""}
                    {descriptionDays.has(iso) ? "≡" : ""}
                  </Text>
                </View>
                {dayEntries.slice(0, 3).map((entry) => (
                  <View key={entry.id} className="mt-0.5 flex-row items-center">
                    <View
                      className="mr-0.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: entry.role_color ?? "#a3a3a3" }}
                    />
                    <Text
                      className="flex-1 text-[10px] text-primary"
                      numberOfLines={1}
                    >
                      {entry.shift_type ? SHIFT_GLYPH[entry.shift_type] : "+"}
                      {entry.worker_name.split(" ")[0]}
                    </Text>
                  </View>
                ))}
                {dayEntries.length > 3 ? (
                  <Text className="text-[10px] text-muted-foreground">
                    +{dayEntries.length - 3}
                  </Text>
                ) : null}
                {dotColors.length > 0 ? (
                  <View className="mt-0.5 flex-row">
                    {dotColors.slice(0, 3).map((color) => (
                      <View
                        key={color}
                        className="mr-0.5 h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
