import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Card } from "@/components/ui/primitives";
import { dayCardTitle, LaborEntryRow } from "@/features/labor/labor-panels";
import type { LaborEntry } from "@/features/labor/labor-types";
import { frenchHolidayKeyForIso } from "@/lib/labor/french-holidays";
import { localeTag } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

type Props = {
  entries: LaborEntry[];
  colorOf: (workerId: string) => string;
  roleOf: (workerId: string) => string | null;
  onEntry: (entry: LaborEntry) => void;
};

/**
 * List view of the month's attendance (web "List" toggle): one card per day, newest first,
 * with the day total and one row per entry that opens the edit sheet.
 */
export function AttendanceList({ entries, colorOf, roleOf, onEntry }: Props) {
  const { t } = useTranslation();
  const days = useMemo(() => {
    const map = new Map<string, LaborEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [entries]);

  if (days.length === 0)
    return (
      <Card radius={16} elevated testID="attendance-list-empty">
        <Text className="font-sans text-[14px] text-muted">
          {t("labor.calendar.listEmpty")}
        </Text>
      </Card>
    );

  return (
    <View className="gap-3" testID="attendance-list">
      {days.map(([iso, dayEntries]) => {
        const holidayKey = frenchHolidayKeyForIso(iso);
        const total = dayEntries.reduce((sum, e) => sum + e.effective_cost, 0);
        return (
          <Card
            radius={16}
            elevated
            key={iso}
            testID={`attendance-list-${iso}`}
          >
            <View className="flex-row items-center justify-between">
              <View className="min-w-0 flex-1">
                <Text className="font-sans-semibold text-[15px] text-ink">
                  {dayCardTitle(iso, localeTag())}
                </Text>
                {holidayKey ? (
                  <Text className="font-sans text-[11.5px] text-accent-ink">
                    {t(`labor.holidays.${holidayKey}`)} ·{" "}
                    {t("labor.holidays.publicHoliday")}
                  </Text>
                ) : null}
              </View>
              <Text className="font-mono text-[13px] text-muted">
                {formatMoney(total)}
              </Text>
            </View>
            <View className="mt-3 gap-2.5">
              {dayEntries.map((entry) => (
                <LaborEntryRow
                  key={entry.id}
                  entry={entry}
                  color={colorOf(entry.worker_id)}
                  role={roleOf(entry.worker_id)}
                  onPress={onEntry}
                  testID={`list-entry-${entry.id}`}
                  size={32}
                />
              ))}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
