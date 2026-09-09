import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { useSiteWeather } from "@/features/dashboard/weather-api";
import { cityFromAddress } from "@/lib/dashboard/weather";
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
  /** Distinct workers with an attendance entry today; null while loading or on error. */
  workersOnSite: number | null;
};

/**
 * 1b "today on site" strip at the foot of the overview sheet — no card: a 22px accent weather
 * icon and one muted line, `31° trời quang · Quận 7 · 6 công nhân tại công trường`, with the
 * temperature + condition in ink.
 */
export function TodayOnSiteCard({ address, workersOnSite }: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const weather = useSiteWeather(address);
  const data = weather.data ?? null;
  const conditionKey = data
    ? `dashboard.today.conditions.${data.condition}`
    : null;
  // No usable city in the address → ask for one; otherwise any miss is "unavailable".
  const emptyKey =
    cityFromAddress(address) === null
      ? "dashboard.today.noAddress"
      : "dashboard.today.unavailable";
  const workers =
    workersOnSite === null
      ? "—"
      : t("dashboard.today.workers", { count: workersOnSite });

  return (
    <View
      testID="overview-today-on-site"
      className="flex-row items-center gap-3 px-1"
    >
      <Icon
        name={data ? CONDITION_ICON[data.condition] : "cloud-off"}
        size={22}
        color={tokens.accent}
      />
      {weather.isFetching && !data ? (
        <ActivityIndicator color={tokens.muted} />
      ) : (
        <Text
          className="min-w-0 flex-1 font-sans text-[13px] leading-[18px] text-muted"
          numberOfLines={2}
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
          {` · ${workers}`}
        </Text>
      )}
    </View>
  );
}
