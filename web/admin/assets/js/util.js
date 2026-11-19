/* Small helpers shared by every admin view. */

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const sum = (list, pick = (x) => x) => list.reduce((total, item) => total + Number(pick(item) || 0), 0);

export const money = (value) =>
  "¥" + Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const compactMoney = (value) => {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1000000) return "¥" + (n / 1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 10000) return "¥" + (n / 10000).toFixed(1) + "万";
  return money(n);
};

export const num = (value, digits = 0) =>
  Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (value, digits = 0) => `${Number(value || 0).toFixed(digits)}%`;

export const pad = (n) => String(n).padStart(2, "0");

export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const dateTime = (value) => {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const timeOnly = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const clockOnly = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const relative = (value, now = Date.now()) => {
  if (!value) return "—";
  const diff = Math.max(0, now - new Date(value).getTime());
  const sec = Math.round(diff / 1000);
  if (sec < 15) return "刚刚";
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.round(hour / 24);
  if (day < 30) return `${day} 天前`;
  return dateTime(value);
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const debounce = (fn, wait = 220) => {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

export const ORDER_STATUS = {
  pending: { label: "待确认", tone: "rose" },
  confirmed: { label: "已确认", tone: "info" },
  shipped: { label: "已发货", tone: "mist" },
  completed: { label: "已完成", tone: "done" },
  cancelled: { label: "已取消", tone: "stone" },
};

export const DELIVERY_TYPE = { express: "快递配送", pickup: "到店自提" };

export const PRODUCT_STATUS = {
  active: { label: "在售", tone: "ok" },
  inactive: { label: "已下架", tone: "plain" },
};

export const CARE_LEVEL = {
  1: { label: "省心", tone: "ok" },
  2: { label: "一般", tone: "info" },
  3: { label: "费心", tone: "warn" },
};

export const DEVICE_STATE = {
  online: { label: "在线", tone: "ok" },
  offline: { label: "离线", tone: "plain" },
  alarm: { label: "告警", tone: "danger" },
};

export function downloadCsv(filename, rows) {
  const escapeCell = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = "\uFEFF" + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
