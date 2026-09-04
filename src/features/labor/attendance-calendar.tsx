import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Card } from "@/components/ui/primitives";
import { buildMonthCells } from "@/features/labor/calendar-month-grid";
import type { LaborEntry } from "@/features/labor/labor-types";
import { toIsoDate } from "@/lib/format/date";
import { useTokens } from "@/theme/tokens";

type Props = {
  month: string;
  entries: LaborEntry[];
  /** worker_id → avatar color, so the day dots match the day card avatars. */
  colorOf: (workerId: string) => string;
  selected: string | null;
  onSelectDay: (iso: string) => void;
};

/**
 * 2a attendance calendar: T2…CN header, 48px r12 cells with a mono day number and up to four
 * 5px worker dots; today on paper-2 (bold), selected on ink, future days muted-2.
 */
export function AttendanceCalendar({
  month,
  entries,
  colorOf,
  selected,
  onSelectDay,
}: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
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
  const weekdays = t("labor.calendar.weekdays", {
    returnObjects: true,
  }) as string[];

  return (
    <Card
      radius={16}
      elevated
      padded={false}
      className="px-2.5 pb-2 pt-3"
      testID="calendar-grid"
    >
      <View className="mb-1.5 flex-row">
        {weekdays.map((label) => (
          <Text
            key={label}
            className="flex-1 text-center font-sans text-[10.5px] tracking-[0.63px] text-muted"
          >
            {label}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View
          key={row}
          className="flex-row"
          style={{ marginTop: row === 0 ? 0 : 4 }}
        >
          {cells.slice(row * 7, row * 7 + 7).map((iso, column) => {
            if (!iso) return <View key={column} className="h-12 flex-1" />;
            const dayEntries = byDay.get(iso) ?? [];
            const isSelected = iso === selected;
            const isToday = iso === today;
            const future = iso > today;
            const workerIds = Array.from(
              new Set(dayEntries.map((e) => e.worker_id)),
            ).slice(0, 4);
            return (
              <Pressable
                key={iso}
                testID={`calendar-day-${iso}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelectDay(iso)}
                className={`h-12 flex-1 items-center justify-center gap-1 rounded-xl active:opacity-70 ${isSelected ? "bg-ink" : isToday ? "bg-paper-2" : ""}`}
              >
                <Text
                  className={`text-[13px] ${isToday || isSelected ? "font-mono-bold" : "font-mono-regular"}`}
                  style={{
                    color: isSelected
                      ? tokens.onInk
                      : future
                        ? tokens.muted2
                        : tokens.ink,
                  }}
                >
                  {Number(iso.slice(8, 10))}
                </Text>
                <View className="h-[5px] flex-row gap-0.5">
                  {workerIds.map((workerId) => (
                    <View
                      key={workerId}
                      className="h-[5px] w-[5px] rounded-full"
                      style={{
                        backgroundColor: colorOf(workerId),
                        // Keeps an ink-colored worker dot visible on the selected (ink) cell.
                        borderWidth: isSelected ? 0.5 : 0,
                        borderColor: tokens.onInk,
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Card>
  );
}
