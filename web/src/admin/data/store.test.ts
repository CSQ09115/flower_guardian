import { describe, expect, it } from "vitest";
import {
  EMPTY_DATA,
  nextToastId,
  normalizeAlert,
  normalizeDevice,
  pushToast,
} from "./store";
import type { ToastItem } from "../../shared/components/Toast";

describe("empty store", () => {
  it("starts with no rows in any collection", () => {
    expect(EMPTY_DATA).toEqual({
      products: [],
      plants: [],
      users: [],
      orders: [],
      devices: [],
      alerts: [],
    });
  });
});

describe("toast queue", () => {
  it("keeps at most the four newest toasts", () => {
    let items: ToastItem[] = [];
    for (const message of ["一", "二", "三", "四", "五"]) {
      items = pushToast(items, nextToastId(), message);
    }
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.message)).toEqual(["二", "三", "四", "五"]);
  });

  it("tags the newest toast with the requested tone", () => {
    const items = pushToast([], nextToastId(), "同步失败", "error");
    expect(items).toHaveLength(1);
    expect(items[0].tone).toBe("error");
  });

  it("hands out increasing ids", () => {
    const first = nextToastId();
    const second = nextToastId();
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(first + 1);
  });
});

describe("live normalisers", () => {
  it("fills the device defaults", () => {
    const row = normalizeDevice({
      id: 1,
      code: "FG-ESP32-001",
      name: "花盆",
      location: "阳台",
      firmware: "1.0.0",
      ip_address: null,
      report_interval: 10,
      enabled: true,
      last_seen: null,
      created_at: "2026-11-18T00:00:00.000Z",
      readings: [],
    } as never);
    expect(row.thresholds.moistureMin).toBe(35);
    expect(row.thresholds.alarm).toBe(true);
    expect(row.calibration.source).toBe("NVS soil-cal");
    expect(row.readings).toEqual([]);
  });

  it("tags a naive backend timestamp as UTC", () => {
    const row = normalizeDevice({
      id: 1,
      code: "FG-ESP32-001",
      name: "花盆",
      location: "阳台",
      firmware: "1.0.0",
      ip_address: null,
      report_interval: 10,
      enabled: true,
      last_seen: "2026-11-18T09:00:00",
      created_at: "2026-11-18T09:00:00",
      latest_reading: {
        device_code: "FG-ESP32-001",
        soil_moisture: 48,
        soil_temp: 21.5,
        light_lux: 8000,
        created_at: "2026-11-18T09:00:00",
      },
    } as never);
    expect(row.last_seen).toBe("2026-11-18T09:00:00Z");
    expect(row.readings[0].created_at).toBe("2026-11-18T09:00:00Z");
  });

  it("keeps latest_reading when the history array is empty", () => {
    const row = normalizeDevice({
      id: 1,
      code: "FG-ESP32-002",
      name: "花盆",
      location: "书房",
      firmware: "1.0.0",
      ip_address: null,
      report_interval: 10,
      enabled: true,
      last_seen: null,
      created_at: "2026-11-18T00:00:00.000Z",
      readings: [],
      latest_reading: {
        device_code: "FG-ESP32-002",
        soil_moisture: 41,
        soil_temp: 22,
        light_lux: null,
        created_at: "2026-11-18T10:00:00",
      },
    } as never);
    expect(row.readings).toHaveLength(1);
    expect(row.readings[0].soil_moisture).toBe(41);
  });

  it("reads the legacy fallbacks for alerts", () => {
    const row = normalizeAlert({
      id: 3,
      device_code: "FG-ESP32-001",
      metric: "moisture",
      label: "湿度",
      value: 20,
      threshold: 35,
      direction: "below",
      level: "danger",
      at: "",
      acknowledged: false,
      hint: "",
      created_at: "2026-11-18T09:00:00",
    } as never);
    expect(row.at).toBe("2026-11-18T09:00:00Z");
    expect(row.acknowledged).toBe(false);
  });
});