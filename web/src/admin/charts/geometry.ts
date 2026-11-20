/* Chart geometry shared by the SVG charts.
 *
 * Ported from `legacy/admin/assets/js/charts.js` (lines 1–88). The maths is
 * unchanged: the same nice ticks, the same monotone cubic interpolation and the
 * same phone/desktop view boxes, so the charts keep the baseline geometry.
 */

import { useEffect, useState } from "react";
import type { OrderStatus } from "../data/types";

/* Palette: mint-white, leaf green, rose. Deep leaf carries the money series,
   rose the comparison and the peak, the lighter greens and pinks give
   categories somewhere to sit without leaving the garden. */
export const VIZ = {
  leaf: "#2c7a56",
  coral: "#d95f82",
  green: "#3fa274",
  pink: "#ef8fa8",
  mist: "#bfe3cd",
  stone: "#93a89c",
} as const;

/* Order-status semantics: rose for waiting, mist for acknowledged, leaf for
   movement and completion, stone for cancelled. */
export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: VIZ.pink,
  confirmed: VIZ.mist,
  shipped: VIZ.green,
  completed: VIZ.leaf,
  cancelled: VIZ.stone,
};

export const scale = (value: number, min: number, max: number, a: number, b: number): number =>
  max === min ? (a + b) / 2 : a + ((value - min) / (max - min)) * (b - a);

export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/* Monotone cubic interpolation: a smooth line that never overshoots the data,
   so a sales curve cannot invent a peak between two readings. */
export function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return points.length ? `M${points[0][0]} ${points[0][1]}` : "";

  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1][0] - points[i][0];
    slope[i] = dx[i] === 0 ? 0 : (points[i + 1][1] - points[i][1]) / dx[i];
  }

  const tangent = new Array<number>(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d +=
      ` C${(points[i][0] + h).toFixed(1)} ${(points[i][1] + tangent[i] * h).toFixed(1)}` +
      ` ${(points[i + 1][0] - h).toFixed(1)} ${(points[i + 1][1] - tangent[i + 1] * h).toFixed(1)}` +
      ` ${points[i + 1][0].toFixed(1)} ${points[i + 1][1].toFixed(1)}`;
  }
  return d;
}

/* Phone charts get a narrower viewBox so 10px axis labels stay legible when
   the card is only ~330px wide. The legacy file used the same breakpoint. */
export function isCompact(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
}

/** Re-renders when the phone breakpoint is crossed, like the legacy charts did
 *  on every render. */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(isCompact);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 640px)");
    const onChange = (): void => setCompact(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return compact;
}

export type ChartFormat = "money" | "int" | ((value: number) => string);

/** Axis / tooltip formatting. `"money"` and `"int"` reuse the shared helpers. */
export function formatValue(value: number, format?: ChartFormat): string {
  if (typeof format === "function") return format(value);
  if (format === "money") {
    return (
      "¥" +
      Number(value || 0).toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  return Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
