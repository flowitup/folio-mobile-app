import {
  cityFromAddress,
  conditionFromWmoCode,
  countWorkersOnSite,
  forecastUrl,
  geocodeUrl,
  parseForecast,
  parseGeocode,
} from "@/lib/dashboard/weather";

describe("cityFromAddress", () => {
  it("keeps the city and drops postal code, street and country", () => {
    expect(cityFromAddress("12 rue des Lilas, 83980 Le Lavandou, France")).toBe(
      "Le Lavandou",
    );
    expect(cityFromAddress("83980 Le Lavandou")).toBe("Le Lavandou");
    expect(cityFromAddress("Le Lavandou")).toBe("Le Lavandou");
    expect(cityFromAddress("10 Av. Foch, 75116 Paris")).toBe("Paris");
    expect(cityFromAddress("Quận 1, Hồ Chí Minh, Việt Nam")).toBe(
      "Hồ Chí Minh",
    );
  });
  it("keeps only the locality of a comma-less street line and falls back over segments", () => {
    expect(cityFromAddress("12 rue des Lilas 83980 Le Lavandou")).toBe(
      "Le Lavandou",
    );
    expect(cityFromAddress("Le Lavandou, 83980")).toBe("Le Lavandou");
  });
  it("never returns a street line", () => {
    expect(cityFromAddress("12 rue des Lilas")).toBeNull();
    expect(cityFromAddress("Chemin des Vignes, Lot 4")).toBeNull();
  });
  it("returns null when nothing usable is left", () => {
    expect(cityFromAddress(null)).toBeNull();
    expect(cityFromAddress("")).toBeNull();
    expect(cityFromAddress("83980")).toBeNull();
  });
});

describe("conditionFromWmoCode", () => {
  it("maps the WMO groups", () => {
    expect(conditionFromWmoCode(0)).toBe("clear");
    expect(conditionFromWmoCode(2)).toBe("partlyCloudy");
    expect(conditionFromWmoCode(3)).toBe("cloudy");
    expect(conditionFromWmoCode(45)).toBe("fog");
    expect(conditionFromWmoCode(53)).toBe("drizzle");
    expect(conditionFromWmoCode(63)).toBe("rain");
    expect(conditionFromWmoCode(73)).toBe("snow");
    expect(conditionFromWmoCode(81)).toBe("showers");
    expect(conditionFromWmoCode(86)).toBe("snow");
    expect(conditionFromWmoCode(95)).toBe("thunderstorm");
    expect(conditionFromWmoCode(999)).toBe("thunderstorm");
    expect(conditionFromWmoCode(30)).toBe("cloudy");
  });
});

describe("Open-Meteo parsing", () => {
  it("builds urls and parses responses", () => {
    expect(geocodeUrl("Le Lavandou")).toContain("name=Le%20Lavandou");
    expect(forecastUrl(43.14, 6.37)).toContain("latitude=43.14&longitude=6.37");
    expect(
      parseGeocode({
        results: [{ name: "Le Lavandou", latitude: 43.14, longitude: 6.37 }],
      }),
    ).toEqual({ name: "Le Lavandou", latitude: 43.14, longitude: 6.37 });
    expect(parseGeocode({ results: [] })).toBeNull();
    expect(
      parseGeocode({ results: [{ name: "X", latitude: 1, longitude: null }] }),
    ).toBeNull();
    expect(parseGeocode(undefined)).toBeNull();
    expect(
      parseForecast(
        { current: { temperature_2m: 21.6, weather_code: 0 } },
        "Le Lavandou",
      ),
    ).toEqual({ place: "Le Lavandou", temperatureC: 22, condition: "clear" });
    expect(parseForecast({}, "x")).toBeNull();
  });
});

describe("countWorkersOnSite", () => {
  it("counts distinct workers on the given day only", () => {
    const entries = [
      { worker_id: "a", date: "2026-09-07" },
      { worker_id: "a", date: "2026-09-07" },
      { worker_id: "b", date: "2026-09-07" },
      { worker_id: "c", date: "2026-09-06" },
    ];
    expect(countWorkersOnSite(entries, "2026-09-07")).toBe(2);
    expect(countWorkersOnSite(entries, "2026-09-08")).toBe(0);
    expect(countWorkersOnSite(undefined, "2026-09-07")).toBeNull();
  });
});
