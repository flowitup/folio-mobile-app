/**
 * Pure helpers behind the overview "Today on site" card: Open-Meteo URL builders, the
 * city extracted from a free-text project address, and the WMO weather-code → condition
 * mapping. Network calls live in `features/dashboard/weather-api.ts`.
 */

export type WeatherCondition =
  | "clear"
  | "partlyCloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "showers"
  | "thunderstorm";

export type SiteWeather = {
  /** Resolved place name from the geocoder (e.g. "Le Lavandou"). */
  place: string;
  temperatureC: number;
  condition: WeatherCondition;
};

/** WMO 4677 weather interpretation codes as emitted by Open-Meteo `weather_code`. */
export function conditionFromWmoCode(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code <= 2) return "partlyCloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunderstorm";
  return "cloudy";
}

const COUNTRY_SEGMENTS = new Set([
  "france",
  "fr",
  "viet nam",
  "vietnam",
  "việt nam",
]);

const STREET_WORDS =
  /\b(rue|avenue|av|bd|boulevard|impasse|chemin|route|allée|allee|place|quai|cours|square|street|road|st|đường|ngõ|hẻm|phố)\b/i;

/** City candidate from one address segment, or null when it still looks like a street. */
function cityFromSegment(segment: string): string | null {
  // Text after the last postal code is the locality ("83980 Le Lavandou" → "Le Lavandou").
  const postal = segment.match(/\b\d{4,6}\b(?!.*\b\d{4,6}\b)/);
  let city = postal
    ? segment.slice((postal.index ?? 0) + postal[0].length)
    : segment.replace(/^\s*\d+[a-z]?\b/i, " ");
  city = city.replace(/\s+/g, " ").trim();
  if (!city || /\d/.test(city) || STREET_WORDS.test(city)) return null;
  return city;
}

/**
 * Best-effort city from a postal address, because Open-Meteo's geocoder searches place
 * names only. Walks the comma segments from the end, skipping bare countries, and keeps
 * the first one that reduces to a place name; street lines never leave the device.
 * "12 rue des Lilas, 83980 Le Lavandou, France" → "Le Lavandou".
 */
export function cityFromAddress(
  address: string | null | undefined,
): string | null {
  if (!address) return null;
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !COUNTRY_SEGMENTS.has(s.toLowerCase()));
  for (let i = segments.length - 1; i >= 0; i--) {
    const city = cityFromSegment(segments[i]);
    if (city) return city;
  }
  return null;
}

export function geocodeUrl(city: string): string {
  const q = encodeURIComponent(city);
  return `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=fr&format=json`;
}

export function forecastUrl(latitude: number, longitude: number): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`;
}

type GeocodeResponse = {
  results?: { name: string; latitude: number; longitude: number }[];
};
type ForecastResponse = {
  current?: { temperature_2m: number; weather_code: number };
};

/** First geocoder hit, or null when the city is unknown. */
export function parseGeocode(
  json: unknown,
): { name: string; latitude: number; longitude: number } | null {
  const hit = (json as GeocodeResponse)?.results?.[0];
  if (
    !hit ||
    typeof hit.latitude !== "number" ||
    typeof hit.longitude !== "number" ||
    typeof hit.name !== "string"
  )
    return null;
  return { name: hit.name, latitude: hit.latitude, longitude: hit.longitude };
}

export function parseForecast(
  json: unknown,
  place: string,
): SiteWeather | null {
  const current = (json as ForecastResponse)?.current;
  if (!current || typeof current.temperature_2m !== "number") return null;
  return {
    place,
    temperatureC: Math.round(current.temperature_2m),
    condition: conditionFromWmoCode(
      typeof current.weather_code === "number" ? current.weather_code : 3,
    ),
  };
}

/** Distinct workers with an attendance entry on the given ISO day; null while unknown. */
export function countWorkersOnSite(
  entries: { worker_id: string; date: string }[] | undefined,
  iso: string,
): number | null {
  if (!entries) return null;
  return new Set(entries.filter((e) => e.date === iso).map((e) => e.worker_id))
    .size;
}
