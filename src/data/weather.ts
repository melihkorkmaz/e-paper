import { getSettings } from "../settings.js";
import {
  MOCK_WEATHER,
  type WeatherData,
  type ForecastHour,
} from "../render/widgets/weather.js";

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

/** Last good snapshot. Seeded with the mock so the first frame has content. */
let latest: WeatherData = MOCK_WEATHER;

/** Returns the most recent weather snapshot (never null). */
export function getWeather(): WeatherData {
  return latest;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Picks the next 4 hours from open-meteo's hourly arrays (main.py parity). */
function sliceForecast(
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] },
  now: Date,
): ForecastHour[] {
  const curIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate(),
  )}T${pad2(now.getHours())}:00`;
  const found = hourly.time.indexOf(curIso);
  const start = found >= 0 ? found + 1 : 0;

  const out: ForecastHour[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = start + i;
    if (idx >= hourly.time.length) break;
    out.push({
      time: hourly.time[idx].split("T")[1].slice(0, 5),
      temp: hourly.temperature_2m[idx],
      code: hourly.weather_code[idx],
    });
  }
  return out;
}

/** Fetches current weather + AQI from open-meteo. Returns null on any failure. */
async function fetchWeather(now: Date): Promise<WeatherData | null> {
  const { lat, lon } = getSettings().location;
  const wUrl =
    `${WEATHER_URL}?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,is_day,uv_index" +
    "&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=2";
  const aUrl =
    `${AQI_URL}?latitude=${lat}&longitude=${lon}` +
    "&current=european_aqi&timezone=auto";

  try {
    const [wRes, aRes] = await Promise.all([fetch(wUrl), fetch(aUrl)]);
    if (!wRes.ok) return null;
    const w = await wRes.json();
    const a = aRes.ok ? await aRes.json() : null;
    const cur = w.current;

    return {
      temp: cur.temperature_2m,
      humidity: cur.relative_humidity_2m,
      pressure: cur.surface_pressure,
      code: cur.weather_code,
      isDay: cur.is_day === 1,
      windDir: cur.wind_direction_10m,
      windSpeed: cur.wind_speed_10m,
      uv: cur.uv_index,
      aqi: a?.current?.european_aqi ?? 0,
      forecast: sliceForecast(w.hourly, now),
    };
  } catch {
    return null;
  }
}

/**
 * Refreshes the weather snapshot. Keeps the last good value on failure so the
 * dashboard keeps rendering when the network is down (main.py resilience).
 */
export async function refreshWeather(now: Date): Promise<void> {
  const data = await fetchWeather(now);
  if (data) latest = data;
}
