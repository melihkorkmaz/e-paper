import type { SKRSContext2D } from "@napi-rs/canvas";
import { getIcon } from "../icons.js";
import { line } from "../draw.js";

/** One forecast hour (already sliced from open-meteo hourly arrays). */
export interface ForecastHour {
  time: string;
  temp: number;
  code: number;
}

/** Weather snapshot. Mirrors the fields main.py pulls from open-meteo + AQI. */
export interface WeatherData {
  temp: number;
  humidity: number;
  pressure: number;
  code: number;
  isDay: boolean;
  windDir: number;
  windSpeed: number;
  uv: number;
  aqi: number;
  forecast: ForecastHour[];
}

/** Placeholder mock until open-meteo fetching is wired up. */
export const MOCK_WEATHER: WeatherData = {
  temp: 12,
  humidity: 40,
  pressure: 1015.5,
  code: 0,
  isDay: true,
  windDir: 100,
  windSpeed: 14.8,
  uv: 0,
  aqi: 50,
  forecast: [
    { time: "18:00", temp: 10, code: 0 },
    { time: "19:00", temp: 9, code: 0 },
    { time: "20:00", temp: 7, code: 2 },
    { time: "21:00", temp: 6, code: 3 },
  ],
};

/** Maps an open-meteo weather code to an icon name. Ported from main.py. */
export function getWeatherIcon(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "icon_sun" : "icon_moon";
  if (code === 1 || code === 2) return "icon_partly-cloudy-day";
  if (code === 3) return "icon_clouds";
  if (code === 45 || code === 48) return "icon_wind";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "icon_rain";
  if ([71, 73, 75, 85, 86].includes(code)) return "icon_snow";
  if ([95, 96, 99].includes(code)) return "icon_storm";
  return "icon_sun";
}

/** Rounds half-up like main.py's math.floor(v + 0.5). */
function roundHalfUp(v: number): number {
  return Math.floor(v + 0.5);
}

function drawIcon(
  ctx: SKRSContext2D,
  name: string,
  x: number,
  y: number,
  size: number,
): void {
  const icon = getIcon(name);
  if (icon) ctx.drawImage(icon, x, y, size, size);
}

/** Big number with an inverted highlight box when `highlight` is set (UV/AQI). */
function drawValue(
  ctx: SKRSContext2D,
  value: string,
  x: number,
  y: number,
  fontPx: number,
  highlight: boolean,
): void {
  ctx.font = `${fontPx}px Aldrich`;
  // Position by the alphabetic baseline using measured glyph metrics so the
  // highlight box wraps the digits tightly (napi's "top" baseline over-leads).
  ctx.textBaseline = "alphabetic";
  const m = ctx.measureText(value);
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  const baselineY = y + ascent;
  ctx.fillStyle = "#000000";
  if (highlight) {
    const pad = fontPx * 0.12;
    ctx.fillRect(x - pad, y - pad, m.width + pad * 2, ascent + descent + pad * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x, baselineY);
    ctx.fillStyle = "#000000";
  } else {
    ctx.fillText(value, x, baselineY);
  }
  ctx.textBaseline = "top";
}

/** Draws the wind compass (dial, ticks, N/E/S/W, direction arrow, speed). */
function drawCompass(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  r: number,
  windDir: number,
  windSpeed: number,
): void {
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  for (let angle = 0; angle < 360; angle += 45) {
    const rad = (angle * Math.PI) / 180;
    const inner = angle % 90 === 0 ? r - 8 : r - 4;
    line(
      ctx,
      cx + inner * Math.cos(rad),
      cy + inner * Math.sin(rad),
      cx + r * Math.cos(rad),
      cy + r * Math.sin(rad),
    );
  }

  ctx.font = "20px Aldrich";
  ctx.fillText("N", cx - 8, cy - r - 22);
  ctx.fillText("S", cx - 8, cy + r + 4);
  ctx.fillText("E", cx + r + 6, cy - 10);
  ctx.fillText("W", cx - r - 24, cy - 10);

  const rad = ((windDir - 90) * Math.PI) / 180;
  const tip = [cx + (r - 12) * Math.cos(rad), cy + (r - 12) * Math.sin(rad)];
  const base = (150 * Math.PI) / 180;
  const left = [cx + 20 * Math.cos(rad + base), cy + 20 * Math.sin(rad + base)];
  const right = [cx + 20 * Math.cos(rad - base), cy + 20 * Math.sin(rad - base)];
  ctx.beginPath();
  ctx.moveTo(tip[0], tip[1]);
  ctx.lineTo(left[0], left[1]);
  ctx.lineTo(right[0], right[1]);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  const spd = `${windSpeed} km/h`;
  const tw = ctx.measureText(spd).width;
  ctx.fillText(spd, cx - tw / 2, cy + 25);
}

/**
 * Renders the full weather column at left edge `x` with content width `width`.
 * Full-column widget: uses absolute panel Y coordinates ported from main.py.
 */
export function renderWeather(
  ctx: SKRSContext2D,
  x: number,
  width: number,
  data: WeatherData,
): void {
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";

  // --- Current conditions ---
  drawIcon(ctx, getWeatherIcon(data.code, data.isDay), x, 25, 90);
  ctx.font = "80px Aldrich";
  ctx.fillText(`${roundHalfUp(data.temp)}°C`, x + 100, 18);

  ctx.font = "28px Aldrich";
  ctx.fillText("UV", x + 320, 25);
  drawValue(ctx, String(roundHalfUp(data.uv)), x + 365, 5, 60, data.uv >= 6);

  ctx.font = "20px Aldrich";
  ctx.fillText(`Humidity: ${data.humidity}%`, x + 100, 95);
  ctx.fillText(`Press: ${data.pressure} hPa`, x + 100, 120);

  line(ctx, x, 140, x + width, 140);

  // --- Wind compass + air quality ---
  const yC2 = 160;
  drawIcon(ctx, "icon_wind", x + 5, yC2, 30);
  drawCompass(ctx, x + 80, yC2 + 80, 60, data.windDir, data.windSpeed);

  const aqiX = x + 180;
  ctx.font = "20px Aldrich";
  ctx.fillText("AIR QUALITY", aqiX, yC2 + 10);
  ctx.font = "28px Aldrich";
  ctx.fillText("AQI:", aqiX, yC2 + 55);
  drawValue(ctx, String(data.aqi), aqiX + 80, yC2 + 66, 80, data.aqi >= 50);

  line(ctx, x, 320, x + width, 320);

  // --- 4-hour forecast ---
  data.forecast.slice(0, 4).forEach((hour, i) => {
    const offX = x + i * 105;
    ctx.font = "24px Aldrich";
    ctx.fillStyle = "#000000";
    ctx.fillText(hour.time, offX + 10, 340);
    drawIcon(ctx, getWeatherIcon(hour.code, true), offX + 15, 375, 60);
    ctx.fillText(`${roundHalfUp(hour.temp)}°C`, offX + 15, 440);
  });
}
