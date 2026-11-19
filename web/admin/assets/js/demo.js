/* Built-in demo dataset. Every write in demo mode stays in memory.
   Numbers are generated once from a fixed seed and are labelled「演示数据」in the UI. */

import { addDays, dayKey, seeded, startOfDay } from "./util.js";

export const DEMO_NOW = Date.now();

const rnd = seeded(20261115);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/* ── products ─────────────────────────────────────────────── */

const PRODUCT_SEED = [
  ["绿萝水培套装", "带定植篮与透明玻璃瓶，水培绿萝的入门组合。", 35, 42, "pothos.jpg", 1],
  ["龟背竹幼苗", "两片开背叶的幼苗，附一张养护卡。", 68, 18, "monstera.jpg", 2],
  ["虎尾兰陶瓷盆组合", "虎尾兰配哑光陶瓷盆，耐阴耐旱。", 88, 25, "snake.jpg", 3],
  ["常春藤吊篮", "垂吊型常春藤，适合书架与窗边。", 45, 30, "ivy.jpg", 4],
  ["白掌桌面盆栽", "白掌小盆，喜散射光与稳定湿度。", 39, 36, "peace-lily.jpg", 5],
  ["芦荟小盆", "芦荟小盆，配颗粒土。", 29, 51, "aloe.jpg", 6],
  ["陶瓷北欧风花盆", "哑光釉面，底部带排水孔与接水盘。", 29.9, 60, null, null],
  ["有机花肥 500g", "通用型颗粒缓释肥，附用量说明。", 19.9, 120, null, null],
  ["土壤湿度计", "指针式两针湿度计，插入土中即可读数。", 49, 22, null, null],
  ["喷雾浇水壶 300ml", "细雾喷头，适合叶面补水。", 24.9, 45, null, null],
  ["椰糠营养土 5L", "椰糠与珍珠岩混合，透气保水。", 18.8, 80, null, null],
  ["修枝剪套装", "一把修枝剪与一把小铲。", 32, 15, null, null],
];

export const demoProducts = PRODUCT_SEED.map(([name, description, price, stock, image, plantId], i) => ({
  id: i + 1,
  name,
  description,
  price,
  stock,
  image_url: image ? `../assets/${image}` : null,
  plant_id: plantId,
  status: name.startsWith("喷雾") ? "inactive" : "active",
  created_at: new Date(DEMO_NOW - (60 - i * 3) * 86400000).toISOString(),
  updated_at: new Date(DEMO_NOW - (12 - i) * 86400000).toISOString(),
}));

/* ── plants ───────────────────────────────────────────────── */

const PLANT_SEED = [
  ["绿萝", "Epipremnum aureum", "观叶", 1, 5, "耐阴，明亮散射光", "表土干 2cm 再浇透", "18–28℃", "50–70%", true, 0, "pothos.jpg"],
  ["龟背竹", "Monstera deliciosa", "观叶", 2, 4, "明亮散射光，忌暴晒", "表土干 3cm 浇透", "18–30℃", "60–80%", true, 1, "monstera.jpg"],
  ["虎尾兰", "Sansevieria trifasciata", "观叶", 1, 5, "耐阴也耐晒", "土壤全干再浇", "15–30℃", "30–50%", true, 2, "snake.jpg"],
  ["常春藤", "Hedera helix", "藤本", 2, 3, "明亮散射光", "保持微湿，忌积水", "10–24℃", "50–70%", true, 3, "ivy.jpg"],
  ["白掌", "Spathiphyllum kochii", "观花", 2, 4, "半阴，忌直射", "表土干 1cm 浇水", "18–27℃", "60–80%", true, 4, "peace-lily.jpg"],
  ["芦荟", "Aloe vera", "多肉", 1, 5, "充足光照", "土壤干透再浇", "15–30℃", "30–50%", false, 5, "aloe.jpg"],
  ["发财树", "Pachira aquatica", "观叶", 2, 3, "明亮散射光", "表土干 5cm 再浇", "18–30℃", "50–70%", false, 6, null],
  ["吊兰", "Chlorophytum comosum", "观叶", 1, 5, "明亮散射光", "保持微湿", "15–28℃", "50–70%", false, 7, null],
  ["薄荷", "Mentha canadensis", "香草", 1, 4, "充足光照", "表土干 1cm 浇水", "15–28℃", "50–70%", false, 8, null],
  ["玉露", "Haworthia cooperi", "多肉", 2, 3, "明亮散射光", "土壤干透再浇", "10–25℃", "40–60%", false, 9, null],
];

export const demoPlants = PLANT_SEED.map(([name, scientific, category, careLevel, beginner, light, water, temp, humidity, toxic, yoloId, image], i) => ({
  id: i + 1,
  name,
  scientific_name: scientific,
  category,
  image_url: image ? `../assets/${image}` : null,
  yolo_class_id: yoloId,
  care_level: careLevel,
  beginner_friendly: beginner,
  description: `${name}的养护卡：光照、浇水与常见问题的要点都写在同一张卡上。`,
  light_requirement: light,
  water_requirement: water,
  watering_tip: water,
  temperature_range: temp,
  humidity_range: humidity,
  is_toxic: toxic,
  features: [category, careLevel === 1 ? "新手友好" : "需要留意"],
  survival_rate: careLevel === 1 ? 92 : careLevel === 2 ? 84 : 76,
  tips: "换盆后先放在散射光处缓苗一周。",
  common_mistakes: "频繁少量浇水，导致根系长期处在半湿状态。",
  created_at: new Date(DEMO_NOW - (90 - i * 2) * 86400000).toISOString(),
}));

/* ── users ────────────────────────────────────────────────── */

const USER_SEED = [
  ["林小满", "linxiaoman", "linxiaoman@example.com", 1],
  ["陈一叶", "chenyiye", "chenyiye@example.com", 3],
  ["周雨", "zhouyu", "zhouyu@example.com", 5],
  ["何青", "heqing", "heqing@example.com", 6],
  ["苏木", "sumu", "sumu@example.com", 8],
  ["罗晚", "luowan", "luowan@example.com", 10],
  ["郑南", "zhengnan", "zhengnan@example.com", 12],
  ["顾北", "gubei", "gubei@example.com", 13],
];

export const demoUsers = USER_SEED.map(([name, username, email, daysAgo], i) => ({
  id: i + 1,
  username,
  email,
  avatar_url: null,
  bio: i % 3 === 0 ? "阳台养了七盆，正在学配土。" : null,
  is_email_verified: i % 4 !== 3,
  role: "user",
  created_at: new Date(DEMO_NOW - daysAgo * 86400000 - (i + 2) * 3600000).toISOString(),
}));

/* ── orders (items stay arithmetically consistent) ─────────── */

const STATUS_POOL = [
  "completed", "completed", "completed", "completed", "completed",
  "shipped", "shipped", "confirmed", "pending", "pending", "cancelled",
];

const DELIVERY = ["express", "express", "express", "pickup"];
const ADDRESS = [
  "上海市徐汇区漕溪北路 88 号 3 栋 502",
  "杭州市西湖区文三路 258 号",
  "南京市鼓楼区中山北路 12 号",
  "广州市天河区体育西路 46 号",
  "成都市武侯区科华北路 62 号",
];

export const demoOrders = (() => {
  const rows = [];
  let seq = 0;
  for (let d = 13; d >= 0; d--) {
    const perDay = d === 0 ? 2 : 1 + Math.floor(rnd() * 2.4);
    for (let k = 0; k < perDay; k++) {
      seq += 1;
      const created = new Date(DEMO_NOW - d * 86400000);
      created.setHours(9 + Math.floor(rnd() * 11), Math.floor(rnd() * 60), Math.floor(rnd() * 60), 0);
      if (created > new Date(DEMO_NOW)) created.setTime(DEMO_NOW - 20 * 60000 * seq);

      const itemCount = 1 + Math.floor(rnd() * 2.2);
      const used = new Set();
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        let product = pick(demoProducts.filter((p) => p.status === "active" && !used.has(p.id)));
        if (!product) break;
        used.add(product.id);
        const quantity = 1 + Math.floor(rnd() * 2.4);
        items.push({
          id: seq * 10 + j,
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: product.price,
          subtotal: round2(product.price * quantity),
        });
      }
      const total = round2(items.reduce((s, item) => s + item.subtotal, 0));
      const user = demoUsers[Math.floor(rnd() * demoUsers.length)];
      const status = d === 0 ? pick(["pending", "confirmed"]) : pick(STATUS_POOL);
      const date = `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, "0")}${String(created.getDate()).padStart(2, "0")}`;
      const time = `${String(created.getHours()).padStart(2, "0")}${String(created.getMinutes()).padStart(2, "0")}${String(created.getSeconds()).padStart(2, "0")}`;
      const deliveryType = pick(DELIVERY);
      rows.push({
        id: seq,
        order_no: `ORD${date}${time}${String(seq).padStart(3, "0")}`,
        user_id: user.id,
        user,
        total_amount: total,
        status,
        delivery_type: deliveryType,
        delivery_address: deliveryType === "pickup" ? "护花使者 · 徐汇门店" : pick(ADDRESS),
        contact_name: user.username,
        contact_phone: `138****${String(1000 + seq).slice(-4)}`,
        remark: seq % 5 === 0 ? "请在工作日送达" : null,
        items,
        created_at: created.toISOString(),
        updated_at: created.toISOString(),
      });
    }
  }
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
})();

/* ── devices + readings ───────────────────────────────────── */

const DEVICE_SEED = [
  {
    code: "FG-ESP32-001", name: "客厅 · 绿萝", location: "客厅南窗", firmware: "0.4.0",
    ip: "192.168.43.77", online: true, lastSeenSec: 6,
    thresholds: { moistureMin: 35, moistureMax: 70, tempMin: 12, tempMax: 30, luxMin: 500, luxMax: 30000, alarm: true },
    calibration: { airRaw: 3200, waterRaw: 1312, source: "NVS soil-cal" },
    baseMoisture: 52, waterEvents: [7.4, 19.2], luxPeak: 8600, tempBase: 23.4,
  },
  {
    code: "FG-ESP32-002", name: "书房 · 龟背竹", location: "书房东侧", firmware: "0.4.0",
    ip: "192.168.43.81", online: true, lastSeenSec: 22,
    thresholds: { moistureMin: 40, moistureMax: 75, tempMin: 14, tempMax: 30, luxMin: 800, luxMax: 26000, alarm: true },
    calibration: { airRaw: 3200, waterRaw: 1288, source: "NVS soil-cal" },
    baseMoisture: 61, waterEvents: [8.2], luxPeak: 5200, tempBase: 22.8,
  },
  {
    code: "FG-ESP32-003", name: "阳台 · 薄荷", location: "南阳台", firmware: "0.4.0",
    ip: "192.168.43.93", online: true, lastSeenSec: 41,
    thresholds: { moistureMin: 45, moistureMax: 80, tempMin: 15, tempMax: 32, luxMin: 3000, luxMax: 60000, alarm: true },
    calibration: { airRaw: 3186, waterRaw: 1264, source: "NVS soil-cal" },
    baseMoisture: 27, waterEvents: [9.6], luxPeak: 28400, tempBase: 25.6, dry: true,
  },
  {
    code: "FG-ESP32-004", name: "卧室 · 白掌", location: "卧室飘窗", firmware: "0.3.2",
    ip: "192.168.43.104", online: false, lastSeenSec: 3 * 3600 + 20 * 60,
    thresholds: { moistureMin: 40, moistureMax: 75, tempMin: 14, tempMax: 28, luxMin: 800, luxMax: 20000, alarm: true },
    calibration: { airRaw: 3200, waterRaw: 1300, source: "出厂默认" },
    baseMoisture: 44, waterEvents: [], luxPeak: 3800, tempBase: 21.9,
  },
  {
    code: "FG-ESP32-005", name: "玄关 · 虎尾兰", location: "入户玄关", firmware: "0.4.0",
    ip: "192.168.43.118", online: true, lastSeenSec: 12,
    thresholds: { moistureMin: 15, moistureMax: 45, tempMin: 10, tempMax: 30, luxMin: 200, luxMax: 20000, alarm: true },
    calibration: { airRaw: 3214, waterRaw: 1276, source: "NVS soil-cal" },
    baseMoisture: 22, waterEvents: [], luxPeak: 0, tempBase: 22.1, noLightSensor: true,
  },
  {
    code: "FG-ESP32-006", name: "办公室 · 发财树", location: "办公室茶水间", firmware: "0.3.2",
    ip: "192.168.43.126", online: false, lastSeenSec: 26 * 3600 + 48 * 60,
    thresholds: { moistureMin: 30, moistureMax: 65, tempMin: 12, tempMax: 30, luxMin: 500, luxMax: 18000, alarm: true },
    calibration: { airRaw: 3200, waterRaw: 1300, source: "出厂默认" },
    baseMoisture: 33, waterEvents: [], luxPeak: 2400, tempBase: 20.6,
  },
];

const STEP_MIN = 10;
const POINTS = (24 * 60) / STEP_MIN + 1;

function buildReadings(config) {
  const random = seeded(Number(config.code.slice(-3)) * 977 + 13);
  const rows = [];
  const onlineFor = config.online ? 0 : config.lastSeenSec;
  const latest = DEMO_NOW - onlineFor * 1000;
  for (let i = 0; i < POINTS; i++) {
    const at = latest - (POINTS - 1 - i) * STEP_MIN * 60000;
    const date = new Date(at);
    const hour = date.getHours() + date.getMinutes() / 60;
    let moisture = config.baseMoisture + 4.5 * Math.sin((hour - 4) / 24 * Math.PI * 2) + (random() - 0.5) * 2.2;
    for (const eventHour of config.waterEvents) {
      if (hour >= eventHour) moisture += 14 * Math.exp(-(hour - eventHour) / 2.6);
    }
    if (config.dry) moisture -= 3.2;
    moisture = Math.max(6, Math.min(96, moisture));

    const daylight = Math.max(0, Math.sin((hour - 6.2) / 12.6 * Math.PI));
    const cloud = 0.72 + random() * 0.28;
    const lux = config.noLightSensor ? null : Math.round(daylight * config.luxPeak * cloud + random() * 45);
    const temp = config.tempBase + 1.9 * Math.sin((hour - 9) / 24 * Math.PI * 2) + (random() - 0.5) * 0.5;

    rows.push({
      id: Number(config.code.slice(-3)) * 10000 + i,
      device_code: config.code,
      soil_moisture: round1(moisture),
      soil_temp: round1(temp),
      light_lux: lux,
      firmware: config.firmware,
      ip_address: config.ip,
      created_at: new Date(at).toISOString(),
    });
  }
  return rows;
}

export const demoDevices = DEVICE_SEED.map((config, index) => {
  const lastSeen = new Date(DEMO_NOW - config.lastSeenSec * 1000).toISOString();
  return {
    id: index + 1,
    code: config.code,
    name: config.name,
    location: config.location,
    firmware: config.firmware,
    ip_address: config.ip,
    report_interval: 10,
    enabled: true,
    last_seen: lastSeen,
    created_at: new Date(DEMO_NOW - (28 - index * 3) * 86400000).toISOString(),
    thresholds: { ...config.thresholds },
    calibration: { ...config.calibration },
    readings: buildReadings(config),
  };
});

/* ── threshold events ─────────────────────────────────────── */

const readingAt = (device, minutesAgo) => {
  const target = DEMO_NOW - minutesAgo * 60000;
  return device.readings.reduce((best, row) =>
    Math.abs(new Date(row.created_at) - target) < Math.abs(new Date(best.created_at) - target) ? row : best
  );
};

export const demoAlerts = (() => {
  const list = [
    {
      id: 1, device_code: "FG-ESP32-003", metric: "soil_moisture", label: "土壤湿度",
      value: readingAt(demoDevices[2], 42).soil_moisture, threshold: demoDevices[2].thresholds.moistureMin,
      direction: "below", level: "danger", at: new Date(DEMO_NOW - 42 * 60000).toISOString(), acknowledged: false,
      hint: "低于下限，薄荷需水量较高，建议检查浇水与滴灌。",
    },
    {
      id: 2, device_code: "FG-ESP32-003", metric: "light_lux", label: "光照",
      value: 1280, threshold: demoDevices[2].thresholds.luxMin,
      direction: "below", level: "warn", at: new Date(DEMO_NOW - 8 * 3600000).toISOString(), acknowledged: false,
      hint: "午后光照骤降，可能是遮阳帘挡住了光。",
    },
    {
      id: 3, device_code: "FG-ESP32-005", metric: "light_lux", label: "光照传感器",
      value: null, threshold: demoDevices[4].thresholds.luxMin,
      direction: "missing", level: "warn", at: new Date(DEMO_NOW - 61 * 60000).toISOString(), acknowledged: false,
      hint: "BH1750 未接入或读取失败，固件上报 light_lux 为 null。",
    },
    {
      id: 4, device_code: "FG-ESP32-004", metric: "online", label: "设备连接",
      value: null, threshold: 90,
      direction: "offline", level: "warn", at: new Date(DEMO_NOW - (3 * 3600 + 20 * 60) * 1000).toISOString(), acknowledged: false,
      hint: "超过 90 秒未收到上报，最后在线 IP 192.168.43.104。",
    },
    {
      id: 5, device_code: "FG-ESP32-006", metric: "online", label: "设备连接",
      value: null, threshold: 90,
      direction: "offline", level: "danger", at: new Date(DEMO_NOW - (26 * 3600 + 48 * 60) * 1000).toISOString(), acknowledged: false,
      hint: "离线超过 24 小时，检查供电与 WiFi 后重新上电。",
    },
    {
      id: 6, device_code: "FG-ESP32-001", metric: "soil_moisture", label: "土壤湿度",
      value: 69.4, threshold: demoDevices[0].thresholds.moistureMax,
      direction: "near", level: "warn", at: new Date(DEMO_NOW - 5 * 3600000).toISOString(), acknowledged: true,
      hint: "接近上限，已确认：刚完成浇水。",
    },
    {
      id: 7, device_code: "FG-ESP32-002", metric: "soil_temp", label: "土壤温度",
      value: 14.2, threshold: demoDevices[1].thresholds.tempMin,
      direction: "below", level: "warn", at: new Date(DEMO_NOW - 19 * 3600000).toISOString(), acknowledged: true,
      hint: "夜间低于下限，已确认：开窗通风导致。",
    },
  ];
  return list;
})();

/* ── demo state factory ───────────────────────────────────── */

export function createDemoState() {
  return {
    products: structuredClone(demoProducts),
    plants: structuredClone(demoPlants),
    users: structuredClone(demoUsers),
    orders: structuredClone(demoOrders),
    devices: structuredClone(demoDevices),
    alerts: structuredClone(demoAlerts),
  };
}

export const DEMO_ADMIN = {
  id: 0,
  username: "demo",
  email: "demo@localhost",
  role: "admin",
  avatar_url: null,
};

export function demoStats(days = 14) {
  const since = startOfDay(addDays(new Date(DEMO_NOW), -(days - 1)));
  const orders = demoOrders.filter((o) => new Date(o.created_at) >= since);
  const sales = round2(orders.reduce((s, o) => s + o.total_amount, 0));
  const users = demoUsers.filter((u) => new Date(u.created_at) >= since);
  return {
    total_sales: sales,
    order_count: orders.length,
    avg_order_value: orders.length ? round2(sales / orders.length) : 0,
    user_count: users.length,
  };
}

export function demoProductRanking(days = 14) {
  const since = startOfDay(addDays(new Date(DEMO_NOW), -(days - 1)));
  const map = new Map();
  demoOrders
    .filter((o) => ["completed", "shipped"].includes(o.status) && new Date(o.created_at) >= since)
    .forEach((o) => {
      o.items.forEach((item) => {
        const row = map.get(item.product_id) || {
          product_id: item.product_id,
          product_name: item.product_name,
          sales_count: 0,
          sales_amount: 0,
        };
        row.sales_count += item.quantity;
        row.sales_amount = round2(row.sales_amount + item.subtotal);
        map.set(item.product_id, row);
      });
    });
  return [...map.values()].sort((a, b) => b.sales_count - a.sales_count);
}

export function demoTrend(days = 7) {
  const labels = [];
  const sales = [];
  const orders = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(addDays(new Date(DEMO_NOW), -i));
    labels.push(day);
    const rows = demoOrders.filter((o) => dayKey(new Date(o.created_at)) === day);
    sales.push(round2(rows.reduce((s, o) => s + o.total_amount, 0)));
    orders.push(rows.length);
  }
  return { labels, sales, orders };
}
