import { useQuery } from "@tanstack/react-query";

import {
  cityFromAddress,
  forecastUrl,
  geocodeUrl,
  parseForecast,
  parseGeocode,
} from "@/lib/dashboard/weather";
import type { SiteWeather } from "@/lib/dashboard/weather";

/**
 * Current weather at the project's site from Open-Meteo (free, keyless): geocode the city
 * extracted from the project address, then read the current temperature + WMO code.
 * Resolves to null when the address has no usable city or the geocoder finds nothing.
 */
export function useSiteWeather(address: string | null | undefined) {
  const city = cityFromAddress(address);
  return useQuery({
    queryKey: ["site-weather", city],
    enabled: city !== null,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async ({ signal }): Promise<SiteWeather | null> => {
      if (!city) return null;
      const geo = parseGeocode(await fetchJson(geocodeUrl(city), signal));
      if (!geo) return null;
      return parseForecast(
        await fetchJson(forecastUrl(geo.latitude, geo.longitude), signal),
        geo.name,
      );
    },
  });
}

const FETCH_TIMEOUT_MS = 8000;

/** fetch + JSON with a hard timeout, also aborted when React Query cancels the query. */
async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`weather ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
