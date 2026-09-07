import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { Card } from "@/components/ui/primitives";
import { Eyebrow } from "@/components/ui/typography";
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
 * "Today on site" strip under the agenda (web sidebar footer + overview weather card, made
 * live): current temperature + condition at the project's city, and today's headcount.
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

  return (
    <View testID="overview-today-on-site">
      <Eyebrow className="mb-2">{t("dashboard.today.title")}</Eyebrow>
      <Card radius={14} className="flex-row items-center gap-3">
        <Icon
          name={data ? CONDITION_ICON[data.condition] : "cloud-off"}
          size={26}
          color={tokens.accent}
        />
        <View className="min-w-0 flex-1">
          {weather.isFetching && !data ? (
            <ActivityIndicator color={tokens.muted} />
          ) : data ? (
            <Text className="font-display text-[22px] leading-none text-ink">
              {data.temperatureC}°
              <Text className="font-sans text-[12px] text-muted">
                {"  "}
                {conditionKey ? t(conditionKey) : ""}
              </Text>
            </Text>
          ) : (
            <Text className="font-sans text-[12.5px] text-muted">
              {t(emptyKey)}
            </Text>
          )}
          <Text
            className="mt-1 font-sans text-[11.5px] text-muted"
            numberOfLines={1}
            testID="overview-today-location"
          >
            {data?.place ? `${data.place} · ` : ""}
            {workersOnSite === null
              ? "—"
              : t("dashboard.today.workers", { count: workersOnSite })}
          </Text>
        </View>
      </Card>
    </View>
  );
}
