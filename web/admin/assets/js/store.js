/* Application state: demo data by default, real API after a successful login. */

import { api, getToken, setToken } from "./api.js";
import { DEMO_ADMIN, createDemoState } from "./demo.js";
import { addDays, dayKey, startOfDay, sum } from "./util.js";

export const store = {
  source: getToken() ? "live" : "demo",
  admin: DEMO_ADMIN,
  data: createDemoState(),
  lastSync: 0,
  syncing: false,
  route: { name: "overview", params: {} },
};

export function isDemo() {
  return store.source === "demo";
}

export function resetDemo() {
  store.data = createDemoState();
  store.admin = DEMO_ADMIN;
  store.lastSync = Date.now();
}

export function notify(message, tone = "ok") {
  window.dispatchEvent(new CustomEvent("fg:toast", { detail: { message, tone } }));
}

export function refreshView() {
  window.dispatchEvent(new Event("fg:refresh"));
}

export async function loadLive() {
  store.syncing = true;
  try {
    const [me, products, orders, users, plants, devices] = await Promise.all([
      api.me(),
      api.products(200),
      api.orders(200),
      api.users(200),
      api.plants(200),
      api.devices().catch(() => null),
    ]);
    store.admin = me;
    store.data.products = (products.items || []).map(normalizeProduct);
    store.data.orders = (orders.items || []).map(normalizeOrder);
    store.data.users = (users.items || []).map(normalizeUser);
    store.data.plants = (plants.items || []).map(normalizePlant);
    if (devices) {
      const rows = Array.isArray(devices) ? devices : devices.items || [];
      store.data.devices = rows.map(normalizeDevice);
      const alerts = await api.deviceAlerts().catch(() => null);
      if (alerts) store.data.alerts = (Array.isArray(alerts) ? alerts : alerts.items || []).map(normalizeAlert);
    } else {
      store.data.devices = [];
      store.data.alerts = [];
    }
    store.source = "live";
    store.lastSync = Date.now();
    return true;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      setToken("");
      store.source = "demo";
      resetDemo();
    }
    throw error;
  } finally {
    store.syncing = false;
    refreshView();
  }
}

export function logout() {
  setToken("");
  store.source = "demo";
  store.admin = DEMO_ADMIN;
  resetDemo();
  location.hash = "#/overview";
  refreshView();
}

const normalizeProduct = (row) => ({
  ...row,
  price: Number(row.price || 0),
  stock: Number(row.stock || 0),
});
const normalizeUser = (row) => ({ ...row });
const normalizePlant = (row) => ({ ...row, care_level: Number(row.care_level || 1) });
const normalizeOrder = (row) => ({
  ...row,
  total_amount: Number(row.total_amount || 0),
  items: (row.items || []).map((item) => ({
    ...item,
    unit_price: Number(item.unit_price || 0),
    subtotal: Number(item.subtotal || item.unit_price * item.quantity || 0),
    quantity: Number(item.quantity || 0),
  })),
});

export const normalizeDevice = (row) => ({
  ...row,
  thresholds: row.thresholds || row.threshold || {
    moistureMin: Number(row.moisture_min ?? 35),
    moistureMax: Number(row.moisture_max ?? 70),
    tempMin: Number(row.temp_min ?? 12),
    tempMax: Number(row.temp_max ?? 30),
    luxMin: Number(row.lux_min ?? 500),
    luxMax: Number(row.lux_max ?? 30000),
    alarm: row.alarm_enabled !== false,
  },
  calibration: row.calibration || { airRaw: row.air_raw ?? 3200, waterRaw: row.water_raw ?? 1300, source: "NVS soil-cal" },
  readings: row.readings || (row.latest_reading ? [row.latest_reading] : []),
  last_seen: row.last_seen || row.last_seen_at || null,
});

const normalizeAlert = (row) => ({
  ...row,
  at: row.at || row.created_at,
  acknowledged: Boolean(row.acknowledged),
});

/* ── derived metrics ──────────────────────────────────────── */

export function latestReading(device) {
  if (!device || !device.readings || !device.readings.length) return null;
  return device.readings[device.readings.length - 1];
}

export function isOnline(device, now = Date.now()) {
  if (!device || !device.last_seen) return false;
  return now - new Date(device.last_seen).getTime() < 90 * 1000;
}

export function deviceIssues(device) {
  const issues = [];
  const latest = latestReading(device);
  const t = device.thresholds || {};
  if (!isOnline(device)) issues.push({ metric: "online", level: "warn", text: "设备离线" });
  if (latest) {
    if (latest.soil_moisture != null) {
      if (latest.soil_moisture < t.moistureMin) issues.push({ metric: "moisture", level: "danger", text: "湿度低于下限" });
      else if (latest.soil_moisture > t.moistureMax) issues.push({ metric: "moisture", level: "warn", text: "湿度高于上限" });
    }
    if (latest.soil_temp != null) {
      if (latest.soil_temp < t.tempMin) issues.push({ metric: "temp", level: "warn", text: "土温低于下限" });
      else if (latest.soil_temp > t.tempMax) issues.push({ metric: "temp", level: "warn", text: "土温高于上限" });
    }
    const hour = new Date().getHours();
    const daylight = hour >= 6 && hour < 20;
    if (latest.light_lux == null) issues.push({ metric: "lux", level: "warn", text: "光照传感器无读数" });
    else if (daylight && latest.light_lux < t.luxMin) issues.push({ metric: "lux", level: "warn", text: "光照低于下限" });
    else if (daylight && latest.light_lux > t.luxMax) issues.push({ metric: "lux", level: "warn", text: "光照高于上限" });
  }
  return issues;
}

export function deviceState(device) {
  if (!isOnline(device)) return "offline";
  if (deviceIssues(device).length) return "alarm";
  return "online";
}

export function deviceByCode(code) {
  return store.data.devices.find((d) => d.code === code) || null;
}

export function sensorSummary() {
  const devices = store.data.devices;
  const online = devices.filter((d) => isOnline(d)).length;
  const alarm = devices.filter((d) => isOnline(d) && deviceIssues(d).length).length;
  const readings = devices.map(latestReading).filter(Boolean);
  const moisture = readings.filter((r) => r.soil_moisture != null);
  return {
    total: devices.length,
    online,
    offline: devices.length - online,
    alarm,
    avgMoisture: moisture.length ? moisture.reduce((s, r) => s + r.soil_moisture, 0) / moisture.length : 0,
  };
}

export function pendingAlerts() {
  return store.data.alerts.filter((a) => !a.acknowledged);
}

export function rangeStart(days) {
  return startOfDay(addDays(new Date(), -(days - 1)));
}

export function ordersInRange(days) {
  const start = rangeStart(days);
  return store.data.orders.filter((o) => new Date(o.created_at) >= start);
}

export function computeOverview(days = 14) {
  const orders = ordersInRange(days);
  const sales = sum(orders, (o) => o.total_amount);
  const users = store.data.users.filter((u) => new Date(u.created_at) >= rangeStart(days));
  return {
    total_sales: sales,
    order_count: orders.length,
    avg_order_value: orders.length ? sales / orders.length : 0,
    user_count: users.length,
  };
}

export function computeTrend(days = 14, groupBy = "day") {
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(new Date(), -i);
    let key = dayKey(date);
    if (groupBy === "week") {
      const d = new Date(date);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = `${d.getFullYear()}-W${String(Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
    } else if (groupBy === "month") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
    if (!buckets.has(key)) buckets.set(key, { key, sales: 0, orders: 0 });
  }
  ordersInRange(days).forEach((order) => {
    const date = new Date(order.created_at);
    let key = dayKey(date);
    if (groupBy === "week") {
      const d = new Date(date);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = `${d.getFullYear()}-W${String(Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
    } else if (groupBy === "month") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
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
export function computeUserTrend(days = 14) {
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(addDays(new Date(), -i)), 0);
  store.data.users.forEach((user) => {
    const key = dayKey(new Date(user.created_at));
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
  });
  return [...buckets.values()];
}

/* Rolling mean over a daily series: a readable trend over a noisy week. */
export function movingAverage(values, window = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((total, value) => total + Number(value || 0), 0) / slice.length;
  });
}

/* AOV is a ratio, so its sparkline is built from rolling sums, never from
   averaging daily averages. */
export function computeAovTrend(days = 14) {
  const { sales, orders } = computeTrend(days);
  const rollingSales = movingAverage(sales, 7);
  const rollingOrders = movingAverage(orders, 7);
  return rollingSales.map((value, i) => (rollingOrders[i] ? value / rollingOrders[i] : 0));
}

export function computeStatusBreakdown(days = 14) {
  const counts = { pending: 0, confirmed: 0, shipped: 0, completed: 0, cancelled: 0 };
  ordersInRange(days).forEach((order) => {
    if (counts[order.status] != null) counts[order.status] += 1;
  });
  return counts;
}

export function computeRanking(days = 14, limit = 10) {
  const start = rangeStart(days);
  const map = new Map();
  store.data.orders
    .filter((o) => ["completed", "shipped"].includes(o.status) && new Date(o.created_at) >= start)
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

/* ── mutations ────────────────────────────────────────────── */

export async function saveProduct(payload, id) {
  if (isDemo()) {
    if (id) {
      const row = store.data.products.find((p) => p.id === id);
      Object.assign(row, payload, { updated_at: new Date().toISOString() });
    } else {
      const next = Math.max(0, ...store.data.products.map((p) => p.id)) + 1;
      store.data.products.unshift({ id: next, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload });
    }
    notify("演示模式：商品修改仅保存在当前会话");
    refreshView();
    return;
  }
  if (id) await api.updateProduct(id, payload);
  else await api.createProduct(payload);
  await loadLive();
  notify(id ? "商品已保存" : "商品已创建");
}

export async function removeProduct(id) {
  if (isDemo()) {
    store.data.products = store.data.products.filter((p) => p.id !== id);
    notify("演示模式：商品已从当前会话移除");
    refreshView();
    return;
  }
  await api.deleteProduct(id);
  await loadLive();
  notify("商品已删除");
}

export async function saveOrder(id, payload) {
  if (isDemo()) {
    const row = store.data.orders.find((o) => o.id === id);
    Object.assign(row, payload, { updated_at: new Date().toISOString() });
    notify("演示模式：订单状态仅保存在当前会话");
    refreshView();
    return;
  }
  await api.updateOrder(id, payload);
  await loadLive();
  notify("订单已更新");
}

export async function savePlant(payload, id) {
  if (isDemo()) {
    if (id) {
      const row = store.data.plants.find((p) => p.id === id);
      Object.assign(row, payload);
    } else {
      const next = Math.max(0, ...store.data.plants.map((p) => p.id)) + 1;
      store.data.plants.unshift({ id: next, created_at: new Date().toISOString(), ...payload });
    }
    notify("演示模式：植物条目仅保存在当前会话");
    refreshView();
    return;
  }
  if (id) await api.updatePlant(id, payload);
  else await api.createPlant(payload);
  await loadLive();
  notify(id ? "植物条目已保存" : "植物条目已创建");
}

export async function removePlant(id) {
  if (isDemo()) {
    store.data.plants = store.data.plants.filter((p) => p.id !== id);
    notify("演示模式：植物条目已移除");
    refreshView();
    return;
  }
  await api.deletePlant(id);
  await loadLive();
  notify("植物条目已删除");
}

export async function saveDevice(code, payload) {
  if (isDemo()) {
    const row = deviceByCode(code);
    Object.assign(row, payload);
    if (payload.thresholds) row.thresholds = { ...payload.thresholds };
    if (payload.calibration) row.calibration = { ...payload.calibration };
    notify("演示模式：设备配置仅保存在当前会话");
    refreshView();
    return;
  }
  await api.updateDevice(code, payload);
  await loadLive();
  notify("设备配置已保存");
}

export async function createDevice({ code, name, location }) {
  if (isDemo()) {
    store.data.devices.push({
      id: Math.max(0, ...store.data.devices.map((d) => d.id)) + 1,
      code,
      name,
      location,
      firmware: "—",
      ip_address: null,
      report_interval: 10,
      enabled: true,
      last_seen: null,
      created_at: new Date().toISOString(),
      thresholds: { moistureMin: 35, moistureMax: 70, tempMin: 12, tempMax: 30, luxMin: 500, luxMax: 30000, alarm: true },
      calibration: { airRaw: 3200, waterRaw: 1300, source: "出厂默认" },
      readings: [],
    });
    notify("演示模式：设备档案仅保存在当前会话");
    refreshView();
    return;
  }
  await api.createDevice({ code, name, location });
  await loadLive();
  notify("设备档案已创建");
}

export async function acknowledgeAlert(id) {
  if (isDemo()) {
    const row = store.data.alerts.find((a) => a.id === id);
    if (row) row.acknowledged = true;
    notify("演示模式：告警已确认");
    refreshView();
    return;
  }
  await api.acknowledgeAlert(id);
  await loadLive();
  notify("告警已确认");
}
