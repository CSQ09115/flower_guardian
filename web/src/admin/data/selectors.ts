/* Derived metrics for the admin console.
 *
 * Ported from `legacy/admin/assets/js/store.js` (lines 124–298) plus the two
 * helpers that lived inside the views (`moistureHeatmap` from
 * `views/devices.js`, the 24-bucket hour histogram from `views/stats.js`).
 *
 * Two deliberate differences from the legacy module:
 *  1. The legacy code read the module-level `store.data`; here the data set is
 *     always the first argument, so a selector can run over live data or a
 *     test fixture without touching a global.
 *  2. Everything that depends on "what time is it now" takes an optional
 *     `now` argument. The legacy code called `new Date()` deep inside
 *     `deviceIssues()` and `rangeStart()`; injecting `now` keeps the results
 *     identical while letting tests pin the clock.
 *
 * Formulas, field names and Chinese wording are unchanged: `total_sales`,
 * `order_count`, `avg_order_value` and `user_count` stay snake_case because
 * that is the backend contract.
 */

import { addDays, dayKey, startOfDay, sum } from "./util";
import type {
  AdminData,
  Alert,
  Device,
  Order,
  OrderStatus,
  Reading,
} from "./types";

export type DeviceIssue = {
  metric: "online" | "moisture" | "temp" | "lux";
  level: "warn" | "danger";
  text: string;
};

export type TrendResult = { labels: string[]; sales: number[]; orders: number[] };

/* ── device helpers ─────────────────────────────────────────── */

export function latestReading(device: Device): Reading | null {
  if (!device || !device.readings || !device.readings.length) return null;
  return device.readings[device.readings.length - 1];
}

export function isOnline(device: Device, now: number = Date.now()): boolean {
  if (!device || !device.last_seen) return false;
  return now - new Date(device.last_seen).getTime() < 90 * 1000;
}

/**
 * The legacy version read `new Date().getHours()` to decide whether it is
 * daytime; the hour now comes from `now` so the result is reproducible.
 */
export function deviceIssues(device: Device, now: number = Date.now()): DeviceIssue[] {
  const issues: DeviceIssue[] = [];
  const latest = latestReading(device);
  const t = device.thresholds || ({} as Device["thresholds"]);
  if (!isOnline(device, now)) issues.push({ metric: "online", level: "warn", text: "设备离线" });
  if (latest) {
    if (latest.soil_moisture != null) {
      if (latest.soil_moisture < t.moistureMin) {
        issues.push({ metric: "moisture", level: "danger", text: "湿度低于下限" });
      } else if (latest.soil_moisture > t.moistureMax) {
        issues.push({ metric: "moisture", level: "warn", text: "湿度高于上限" });
      }
    }
    if (latest.soil_temp != null) {
      if (latest.soil_temp < t.tempMin) issues.push({ metric: "temp", level: "warn", text: "土温低于下限" });
      else if (latest.soil_temp > t.tempMax) issues.push({ metric: "temp", level: "warn", text: "土温高于上限" });
    }
    const hour = new Date(now).getHours();
    const daylight = hour >= 6 && hour < 20;
    if (latest.light_lux == null) {
      issues.push({ metric: "lux", level: "warn", text: "光照传感器无读数" });
    } else if (daylight && latest.light_lux < t.luxMin) {
      issues.push({ metric: "lux", level: "warn", text: "光照低于下限" });
    } else if (daylight && latest.light_lux > t.luxMax) {
      issues.push({ metric: "lux", level: "warn", text: "光照高于上限" });
    }
  }
  return issues;
}

export function deviceState(device: Device, now: number = Date.now()): "online" | "alarm" | "offline" {
  if (!isOnline(device, now)) return "offline";
  if (deviceIssues(device, now).length) return "alarm";
  return "online";
}

export function deviceByCode(data: AdminData, code: string): Device | null {
  return data.devices.find((d) => d.code === code) || null;
}

export function sensorSummary(
  data: AdminData,
  now: number = Date.now(),
): { total: number; online: number; offline: number; alarm: number; avgMoisture: number } {
  const devices = data.devices;
  const online = devices.filter((d) => isOnline(d, now)).length;
  const alarm = devices.filter((d) => isOnline(d, now) && deviceIssues(d, now).length).length;
  const readings = devices.map((d) => latestReading(d)).filter((r): r is Reading => Boolean(r));
  const moisture = readings.filter((r) => r.soil_moisture != null);
  return {
    total: devices.length,
    online,
    offline: devices.length - online,
    alarm,
    avgMoisture: moisture.length
      ? moisture.reduce((s, r) => s + (r.soil_moisture ?? 0), 0) / moisture.length
      : 0,
  };
}

export function pendingAlerts(data: AdminData): Alert[] {
  return data.alerts.filter((a) => !a.acknowledged);
}

/* ── order windows ──────────────────────────────────────────── */

export function rangeStart(days: number, now: number = Date.now()): Date {
  return startOfDay(addDays(new Date(now), -(days - 1)));
}

export function ordersInRange(data: AdminData, days: number, now: number = Date.now()): Order[] {
  const start = rangeStart(days, now);
  return data.orders.filter((o) => new Date(o.created_at) >= start);
}

export function computeOverview(
  data: AdminData,
  days = 14,
  now: number = Date.now(),
): { total_sales: number; order_count: number; avg_order_value: number; user_count: number } {
  const orders = ordersInRange(data, days, now);
  const sales = sum(orders, (o) => o.total_amount);
  const users = data.users.filter((u) => new Date(u.created_at) >= rangeStart(days, now));
  return {
    total_sales: sales,
    order_count: orders.length,
    avg_order_value: orders.length ? sales / orders.length : 0,
    user_count: users.length,
  };
}

/** Legacy week bucket key, e.g. `2026-W34`. */
function weekKey(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function bucketKey(date: Date, groupBy: "day" | "week" | "month"): string {
  if (groupBy === "week") return weekKey(date);
  if (groupBy === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return dayKey(date);
}

export function computeTrend(
  data: AdminData,
  days = 14,
  groupBy: "day" | "week" | "month" = "day",
  now: number = Date.now(),
): TrendResult {
  const buckets = new Map<string, { key: string; sales: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(new Date(now), -i);
    const key = bucketKey(date, groupBy);
    if (!buckets.has(key)) buckets.set(key, { key, sales: 0, orders: 0 });
  }
  ordersInRange(data, days, now).forEach((order) => {
    const key = bucketKey(new Date(order.created_at), groupBy);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sales += Number(order.total_amount || 0);
      bucket.orders += 1;
    }
  });
  const rows = [...buckets.values()];
  return { labels: rows.map((r) => r.key), sales: rows.map((r) => r.sales), orders: rows.map((r) => r.orders) };
}

/* Daily new-user counts over the same window, for the KPI sparkline. */
export function computeUserTrend(data: AdminData, days = 14, now: number = Date.now()): number[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(addDays(new Date(now), -i)), 0);
  data.users.forEach((user) => {
    const key = dayKey(new Date(user.created_at));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });
  return [...buckets.values()];
}

/* Rolling mean over a daily series: a readable trend over a noisy week. */
export function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((total, value) => total + Number(value || 0), 0) / slice.length;
  });
}

/* AOV is a ratio, so its sparkline is built from rolling sums, never from
   averaging daily averages. */
export function computeAovTrend(data: AdminData, days = 14, now: number = Date.now()): number[] {
  const { sales, orders } = computeTrend(data, days, "day", now);
  const rollingSales = movingAverage(sales, 7);
  const rollingOrders = movingAverage(orders, 7);
  return rollingSales.map((value, i) => (rollingOrders[i] ? value / rollingOrders[i] : 0));
}

export function computeStatusBreakdown(
  data: AdminData,
  days = 14,
  now: number = Date.now(),
): Record<OrderStatus, number> {
  const counts: Record<OrderStatus, number> = {
    pending: 0,
    confirmed: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
  };
  ordersInRange(data, days, now).forEach((order) => {
    if (counts[order.status] != null) counts[order.status] += 1;
  });
  return counts;
}

export function computeRanking(
  data: AdminData,
  days = 14,
  limit = 10,
  now: number = Date.now(),
): { product_id: number; product_name: string; sales_count: number; sales_amount: number }[] {
  const start = rangeStart(days, now);
  const map = new Map<number, { product_id: number; product_name: string; sales_count: number; sales_amount: number }>();
  data.orders
    .filter((o) => (["completed", "shipped"] as OrderStatus[]).includes(o.status) && new Date(o.created_at) >= start)
    .forEach((order) => {
      (order.items || []).forEach((item) => {
        const row = map.get(item.product_id) || {
          product_id: item.product_id,
          product_name: item.product_name,
          sales_count: 0,
          sales_amount: 0,
        };
        row.sales_count += Number(item.quantity || 0);
        row.sales_amount += Number(item.subtotal || 0);
        map.set(item.product_id, row);
      });
    });
  return [...map.values()].sort((a, b) => b.sales_count - a.sales_count).slice(0, limit);
}

/* 24 buckets, one per hour of the local day (legacy `views/stats.js`). */
export function hourHistogram(data: AdminData, days = 14, now: number = Date.now()): number[] {
  const hours = new Array<number>(24).fill(0);
  ordersInRange(data, days, now).forEach((order) => {
    hours[new Date(order.created_at).getHours()] += 1;
  });
  return hours;
}

/**
 * Per-device soil moisture over the last 24 hours, merged into 2-hour buckets
 * (legacy `views/devices.js`). `now` is accepted for a uniform selector
 * signature; the legacy version reads the device's own last 144 readings and
 * therefore does not need the current time.
 */
export function moistureHeatmap(
  data: AdminData,
  _now: number = Date.now(),
): { label: string; sub: string; cells: (number | null)[] }[] {
  return data.devices.map((device) => {
    const sums = new Array<number>(12).fill(0);
    const counts = new Array<number>(12).fill(0);
    (device.readings || []).slice(-144).forEach((reading) => {
      if (reading.soil_moisture == null) return;
      const bucket = Math.min(11, Math.floor(new Date(reading.created_at).getHours() / 2));
      sums[bucket] += reading.soil_moisture;
      counts[bucket] += 1;
    });
    return {
      label: device.name,
      sub: device.code.replace("FG-ESP32-", "#"),
      cells: sums.map((total, i) => (counts[i] ? total / counts[i] : null)),
    };
  });
}
