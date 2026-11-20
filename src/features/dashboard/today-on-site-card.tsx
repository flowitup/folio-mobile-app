import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { useSiteWeather } from "@/features/dashboard/weather-api";
import type { WeatherCondition } from "@/lib/dashboard/weather";
import { useTokens } from "@/theme/tokens";

const CONDITION_ICON: Record<WeatherCondition, IconName> = {
  clear: "sun",
  partlyCloudy: "cloud",
  cloudy: "cloud",
  fog: "wind",
  drizzle: "cloud-drizzle",
  rain: "cloud-rain",
  snow: "cloud-snow",
  showers: "cloud-rain",
  thunderstorm: "cloud-lightning",
};

type Props = {
  /** Project address; the city is geocoded for the weather. */
  address: string | null | undefined;
  /**
   * Distinct workers with an attendance entry today; null while loading or on error; undefined
   * when the caller may not see the project's attendance, which leaves the count out.
   */
  workersOnSite: number | null | undefined;
  /**
   * Opens today's attendance sheet. Set only for a caller who may log attendance: the whole
   * strip then becomes one ≥48px button that says whether today is logged yet.
   */
  onLog?: () => void;
};

/**
 * 1b "today on site" strip at the foot of the overview sheet — no card: a 22px accent weather
 * icon and one muted line, `31° trời quang · Quận 7 · 6 công nhân tại công trường`, with the
 * temperature + condition in ink. For whoever logs attendance it is a card-sized button instead,
 * straight into today's attendance sheet (P-08).
 */
export function TodayOnSiteCard({ address, workersOnSite, onLog }: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const weather = useSiteWeather(address);
  const data = weather.data ?? null;
  const conditionKey = data
    ? `dashboard.today.conditions.${data.condition}`
    : null;
  // Only a project with no address at all is asked for one. An address the geocoder cannot
  // reduce to a city is still an address, and telling its manager to add one contradicts the
  // address the top bar shows right above; that miss reads as "unavailable" like any other.
  const emptyKey = address?.trim()
    ? "dashboard.today.unavailable"
    : "dashboard.today.noAddress";
  const workers =
    workersOnSite === undefined
      ? null
      : workersOnSite === null
        ? "—"
        : t("dashboard.today.workers", { count: workersOnSite });
  const icon = (
    <Icon
      name={data ? CONDITION_ICON[data.condition] : "cloud-off"}
      size={22}
      color={tokens.accent}
    />
  );
  const weatherLine = (showWorkers: boolean) =>
    weather.isFetching && !data ? (
      <ActivityIndicator color={tokens.muted} />
    ) : (
      <Text
        className="min-w-0 font-sans text-[13px] leading-[18px] text-muted"
        numberOfLines={showWorkers ? 2 : 1}
        testID="overview-today-location"
      >
        {data ? (
          <Text className="font-sans-semibold text-ink">
            {data.temperatureC}° {conditionKey ? t(conditionKey) : ""}
          </Text>
        ) : (
          t(emptyKey)
        )}
        {data?.place ? ` · ${data.place}` : ""}
        {showWorkers && workers ? ` · ${workers}` : ""}
      </Text>
    );

  if (onLog) {
    // The head count moves into the action itself: "Log today" until someone is logged, then
    // "{n} workers today · Edit". Loading or failed counts read as not logged yet.
    const action = workersOnSite
      ? t("dashboard.today.editToday", { count: workersOnSite })
      : t("dashboard.today.logToday");
    return (
      <Pressable
        testID="overview-today-on-site"
        accessibilityRole="button"
        accessibilityLabel={action}
        onPress={onLog}
        className="min-h-[48px] flex-row items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 py-2.5 active:opacity-70"
      >
        {icon}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            testID="overview-today-action"
            className="font-sans-semibold text-[14px] leading-[19px] text-ink"
            numberOfLines={1}
          >
            {action}
          </Text>
          {weatherLine(false)}
        </View>
        <Icon name="chevron-right" size={18} color={tokens.muted} />
      </Pressable>
    );
  }

  return (
    <View
      testID="overview-today-on-site"
      className="flex-row items-center gap-3 px-1"
    >
      {icon}
      <View className="min-w-0 flex-1">{weatherLine(true)}</View>
    </View>
  );
}
