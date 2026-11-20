import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/* The demo dataset is anchored to `DEMO_NOW`, i.e. the moment the module is
   loaded (legacy `demo.js` does exactly the same). The 14-day window therefore
   depends on the local clock: the eight seeded users are created 1…13 days
   ago, and the 13-days-ago one only falls inside the window when the demo
   "now" is at or after 09:00 local time. To keep the contract assertion
   deterministic we freeze `Date` at a fixed local noon before importing the
   module — the generator itself is untouched. */
const FIXED_NOW = new Date(2026, 10, 20, 12, 0, 0);

let demo: typeof import("./demo");

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_NOW);
  demo = await import("./demo");
});

afterAll(() => {
  vi.useRealTimers();
});

describe("demo dataset", () => {
  it("locks the 14-day KPI contract", () => {
    const s = demo.demoStats(14);
    expect(s.total_sales).toBeCloseTo(2333.7, 2);
    expect(s.order_count).toBe(21);
    expect(s.avg_order_value).toBeCloseTo(111.13, 2);
    expect(s.user_count).toBe(8);
  });

  it("ships six devices, four online", () => {
    const { devices } = demo.createDemoState();
    expect(devices).toHaveLength(6);
    expect(devices.filter((d) => d.code !== "FG-ESP32-004" && d.code !== "FG-ESP32-006")).toHaveLength(4);
    expect(devices[0].readings).toHaveLength(145);
  });

  it("keeps the order total arithmetic consistent", () => {
    for (const o of demo.createDemoState().orders) {
      const sum = o.items.reduce((s, i) => s + i.subtotal, 0);
      expect(o.total_amount).toBeCloseTo(sum, 2);
    }
  });
});

describe("demo catalogue", () => {
  it("keeps the seeded row counts", () => {
    expect(demo.demoProducts).toHaveLength(12);
    expect(demo.demoPlants).toHaveLength(10);
    expect(demo.demoUsers).toHaveLength(8);
    expect(demo.demoOrders).toHaveLength(21);
    expect(demo.demoDevices).toHaveLength(6);
    expect(demo.demoAlerts).toHaveLength(7);
  });

  it("points product and plant images at the public asset root", () => {
    expect(demo.demoProducts[0].image_url).toBe("/assets/pothos.jpg");
    expect(demo.demoPlants[0].image_url).toBe("/assets/pothos.jpg");
    expect(demo.demoProducts[6].image_url).toBeNull();
    expect(demo.demoPlants[6].image_url).toBeNull();
  });

  it("marks only the spray bottle as inactive", () => {
    const inactive = demo.demoProducts.filter((p) => p.status === "inactive");
    expect(inactive).toHaveLength(1);
    expect(inactive[0].name).toBe("喷雾浇水壶 300ml");
  });
});

describe("createDemoState", () => {
  it("returns an isolated copy of the seeded data", () => {
    const state = demo.createDemoState();
    state.products[0].name = "改过的名字";
    expect(demo.demoProducts[0].name).toBe("绿萝水培套装");
    expect(demo.createDemoState().products[0].name).toBe("绿萝水培套装");
  });

  it("exposes the demo admin account", () => {
    expect(demo.DEMO_ADMIN).toEqual({
      id: 0,
      username: "demo",
      email: "demo@localhost",
      role: "admin",
      avatar_url: null,
    });
  });
});

describe("demoProductRanking / demoTrend", () => {
  it("ranks products by quantity sold", () => {
    const ranking = demo.demoProductRanking(14);
    expect(ranking.length).toBeGreaterThan(0);
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i - 1].sales_count).toBeGreaterThanOrEqual(ranking[i].sales_count);
    }
    const total = ranking.reduce((s, row) => s + row.sales_amount, 0);
    expect(total).toBeLessThanOrEqual(2333.7);
  });

  it("produces one bucket per day for the requested range", () => {
    const trend = demo.demoTrend(14);
    expect(trend.labels).toHaveLength(14);
    expect(trend.sales).toHaveLength(14);
    expect(trend.orders).toHaveLength(14);
    expect(trend.labels[0]).toBe("2026-11-07");
    expect(trend.labels[13]).toBe("2026-11-20");
    expect(trend.orders.reduce((s, n) => s + n, 0)).toBe(21);
  });
});
