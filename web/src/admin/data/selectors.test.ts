import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AdminData, Device } from "./types";
import {
  computeAovTrend,
  computeOverview,
  computeRanking,
  computeStatusBreakdown,
  computeTrend,
  computeUserTrend,
  deviceByCode,
  deviceIssues,
  deviceState,
  hourHistogram,
  isOnline,
  latestReading,
  moistureHeatmap,
  movingAverage,
  pendingAlerts,
  rangeStart,
  sensorSummary,
} from "./selectors";

/* The legacy demo dataset is anchored to `DEMO_NOW = Date.now()`, so the clock
   has to be pinned before the module is evaluated. Without this the "new users"
   KPI flips between 7 and 8 depending on the hour the test happens to run. */
let data: AdminData;
let now: number;

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-20T12:00:00+08:00"));
  const demo = await import("./demo");
  now = demo.DEMO_NOW;
  data = demo.createDemoState();
  vi.useRealTimers();
});

describe("computeOverview", () => {
  it("keeps the legacy KPI contract", () => {
    const overview = computeOverview(data, 14, now);
    expect(overview.total_sales).toBeCloseTo(2333.7, 2);
    expect(overview.order_count).toBe(21);
    expect(overview.avg_order_value).toBeCloseTo(2333.7 / 21, 6);
    expect(overview.user_count).toBe(8);
  });

  it("counts only the orders inside the window", () => {
    const overview = computeOverview(data, 1, now);
    expect(overview.order_count).toBeLessThanOrEqual(21);
    expect(overview.total_sales).toBeLessThanOrEqual(2333.7);
    expect(rangeStart(14, now).getHours()).toBe(0);
  });
});

describe("computeTrend", () => {
  it("buckets one label per day and keeps the totals", () => {
    const trend = computeTrend(data, 14, "day", now);
    expect(trend.labels).toHaveLength(14);
    expect(trend.labels.every((label) => /^\d{4}-\d{2}-\d{2}$/.test(label))).toBe(true);
    expect(trend.sales).toHaveLength(14);
    expect(trend.orders).toHaveLength(14);
    expect(trend.sales.reduce((a, b) => a + b, 0)).toBeCloseTo(2333.7, 2);
    expect(trend.orders.reduce((a, b) => a + b, 0)).toBe(21);
  });

  it("supports the legacy week and month keys", () => {
    const week = computeTrend(data, 14, "week", now);
    expect(week.labels.length).toBeGreaterThan(0);
    expect(week.labels.every((label) => /^\d{4}-W\d{2}$/.test(label))).toBe(true);
    const month = computeTrend(data, 14, "month", now);
    expect(month.labels.every((label) => /^\d{4}-\d{2}$/.test(label))).toBe(true);
  });
});

describe("sensorSummary / device state", () => {
  it("summarises the demo devices", () => {
    const summary = sensorSummary(data, now);
    expect(summary.total).toBe(6);
    expect(summary.online).toBe(4);
    expect(summary.offline).toBe(2);
    expect(summary.avgMoisture).toBeGreaterThan(0);
  });

  it("flags a device that reports below its threshold", () => {
    const source = data.devices.find((d) => d.code === "FG-ESP32-001");
    expect(source).toBeTruthy();
    const device: Device = structuredClone(source as Device);
    device.last_seen = new Date(now - 10 * 1000).toISOString();
    const reading = latestReading(device);
    expect(reading).toBeTruthy();
    if (reading) reading.soil_moisture = (device.thresholds.moistureMin ?? 35) - 10;

    const issues = deviceIssues(device, now);
    expect(issues.map((issue) => issue.text)).toContain("湿度低于下限");
    expect(deviceState(device, now)).toBe("alarm");
    expect(isOnline(device, now)).toBe(true);
  });

  it("reports an offline device with the legacy wording", () => {
    const source = data.devices.find((d) => d.code === "FG-ESP32-004");
    const device: Device = structuredClone(source as Device);
    device.last_seen = new Date(now - 30 * 60 * 1000).toISOString();
    expect(deviceIssues(device, now).map((issue) => issue.text)).toContain("设备离线");
    expect(deviceState(device, now)).toBe("offline");
  });
});

describe("status breakdown / ranking / trends", () => {
  it("splits the window into the five legacy statuses", () => {
    const breakdown = computeStatusBreakdown(data, 14, now);
    expect(Object.values(breakdown).reduce((a, b) => a + b, 0)).toBe(21);
    expect(breakdown.completed + breakdown.shipped).toBeGreaterThan(0);
  });

  it("ranks products like the legacy helper", async () => {
    const demo = await import("./demo");
    const legacy = demo.demoProductRanking(14);
    const ranking = computeRanking(data, 14, 10, now);
    expect(ranking[0].product_id).toBe(legacy[0].product_id);
    expect(ranking[0].sales_count).toBe(legacy[0].sales_count);
    expect(ranking[0].sales_amount).toBeCloseTo(legacy[0].sales_amount, 6);
  });

  it("averages and divides the way the legacy charts do", () => {
    expect(movingAverage([1, 2, 3], 2)).toEqual([1, 1.5, 2.5]);
    expect(computeUserTrend(data, 14, now)).toHaveLength(14);
    expect(computeUserTrend(data, 14, now).every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
    const aov = computeAovTrend(data, 14, now);
    expect(aov).toHaveLength(14);
    expect(aov.every((v) => v >= 0)).toBe(true);
  });

  it("buckets orders into the 24 hours of the day", () => {
    const hours = hourHistogram(data, 14, now);
    expect(hours).toHaveLength(24);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(21);
  });
});

describe("lookups", () => {
  it("finds a device by code and lists the unacknowledged alerts", () => {
    expect(deviceByCode(data, "FG-ESP32-001")?.code).toBe("FG-ESP32-001");
    expect(deviceByCode(data, "FG-ESP32-404")).toBeNull();
    const pending = pendingAlerts(data);
    expect(pending.every((alert) => !alert.acknowledged)).toBe(true);
  });

  it("builds the moisture heatmap rows", () => {
    const rows = moistureHeatmap(data, now);
    expect(rows).toHaveLength(data.devices.length);
    expect(rows[0].cells).toHaveLength(12);
    expect(rows[0].cells.some((cell) => cell !== null)).toBe(true);
    expect(rows[0].sub).toBe(data.devices[0].code.replace("FG-ESP32-", "#"));
  });
});
