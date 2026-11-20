import { describe, expect, it } from "vitest";
import { createDemoState } from "./demo";
import {
  DEMO_TOAST,
  applyAcknowledgeAlert,
  applyCreateDevice,
  applyRemovePlant,
  applyRemoveProduct,
  applySaveDevice,
  applySaveOrder,
  applySavePlant,
  applySaveProduct,
  nextToastId,
  normalizeAlert,
  normalizeDevice,
  pushToast,
} from "./store";
import type { ToastItem } from "../../shared/components/Toast";

const productPayload = {
  name: "绿萝水培套装",
  description: "带定植篮与透明玻璃瓶",
  price: 35,
  stock: 42,
  plant_id: 1,
  status: "active" as const,
};

describe("demo write operations", () => {
  it("creates a product with the next id and keeps the legacy wording", () => {
    const data = createDemoState();
    const next = applySaveProduct(data, productPayload);
    expect(next.products).toHaveLength(data.products.length + 1);
    expect(next.products[0].name).toBe("绿萝水培套装");
    expect(next.products[0].id).toBe(Math.max(...data.products.map((p) => p.id)) + 1);
    expect(next.products[0].created_at).toBeTruthy();
    expect(next.products[0].updated_at).toBeTruthy();
    expect(DEMO_TOAST.saveProduct).toBe("演示模式：商品修改仅保存在当前会话");
  });

  it("updates an existing product and refreshes updated_at", () => {
    const data = createDemoState();
    const target = data.products[0];
    const next = applySaveProduct(data, { ...productPayload, price: 99 }, target.id);
    const row = next.products.find((p) => p.id === target.id);
    expect(row?.price).toBe(99);
    expect(row?.updated_at).not.toBe(target.updated_at);
  });

  it("removes a product", () => {
    const data = createDemoState();
    const target = data.products[0];
    const next = applyRemoveProduct(data, target.id);
    expect(next.products).toHaveLength(data.products.length - 1);
    expect(next.products.some((p) => p.id === target.id)).toBe(false);
  });

  it("updates the order status", () => {
    const data = createDemoState();
    const target = data.orders[0];
    const next = applySaveOrder(data, target.id, { status: "cancelled" });
    expect(next.orders.find((o) => o.id === target.id)?.status).toBe("cancelled");
    expect(DEMO_TOAST.saveOrder).toBe("演示模式：订单状态仅保存在当前会话");
  });

  it("creates and removes plants", () => {
    const data = createDemoState();
    const created = applySavePlant(data, { name: "薄荷", description: "香草" });
    expect(created.plants[0].name).toBe("薄荷");
    expect(created.plants[0].id).toBe(Math.max(...data.plants.map((p) => p.id)) + 1);

    const removed = applyRemovePlant(created, created.plants[0].id);
    expect(removed.plants).toHaveLength(created.plants.length - 1);
    expect(DEMO_TOAST.removePlant).toBe("演示模式：植物条目已移除");
  });

  it("replaces device thresholds and calibration with copies", () => {
    const data = createDemoState();
    const device = data.devices[0];
    const next = applySaveDevice(data, device.code, {
      name: "改名后的花盆",
      thresholds: { ...device.thresholds, moistureMin: 42 },
      calibration: { ...device.calibration, airRaw: 1234 },
    });
    const row = next.devices.find((d) => d.code === device.code);
    expect(row?.name).toBe("改名后的花盆");
    expect(row?.thresholds.moistureMin).toBe(42);
    expect(row?.thresholds).not.toBe(device.thresholds);
    expect(row?.calibration.airRaw).toBe(1234);
    expect(DEMO_TOAST.saveDevice).toBe("演示模式：设备配置仅保存在当前会话");
  });

  it("creates a device with the legacy defaults", () => {
    const data = createDemoState();
    const next = applyCreateDevice(data, { code: "FG-ESP32-009", name: "新花盆", location: "阳台" });
    const row = next.devices[next.devices.length - 1];
    expect(row.code).toBe("FG-ESP32-009");
    expect(row.firmware).toBe("—");
    expect(row.report_interval).toBe(10);
    expect(row.enabled).toBe(true);
    expect(row.last_seen).toBeNull();
    expect(row.thresholds).toEqual({
      moistureMin: 35,
      moistureMax: 70,
      tempMin: 12,
      tempMax: 30,
      luxMin: 500,
      luxMax: 30000,
      alarm: true,
    });
    expect(row.calibration).toEqual({ airRaw: 3200, waterRaw: 1300, source: "出厂默认" });
    expect(row.readings).toEqual([]);
    expect(DEMO_TOAST.createDevice).toBe("演示模式：设备档案仅保存在当前会话");
  });

  it("acknowledges an alert", () => {
    const data = createDemoState();
    const alert = data.alerts[0];
    const next = applyAcknowledgeAlert(data, alert.id);
    expect(next.alerts.find((a) => a.id === alert.id)?.acknowledged).toBe(true);
    expect(DEMO_TOAST.acknowledgeAlert).toBe("演示模式：告警已确认");
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

  it("holds both the store toast and the view toast", () => {
    const storeToast = pushToast([], nextToastId(), DEMO_TOAST.saveProduct);
    const viewToast = pushToast(storeToast, nextToastId(), "商品已保存");
    expect(viewToast.map((item) => item.message)).toEqual([
      "演示模式：商品修改仅保存在当前会话",
      "商品已保存",
    ]);
  });
});

describe("live normalisers", () => {
  it("fills the legacy device defaults", () => {
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
      created_at: "2026-11-18T09:00:00.000Z",
    } as never);
    expect(row.at).toBe("2026-11-18T09:00:00.000Z");
    expect(row.acknowledged).toBe(false);
  });
});
