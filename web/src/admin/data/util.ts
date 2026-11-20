/* Small helpers shared by every admin view.
   Ported verbatim from `legacy/admin/assets/js/util.js` (Task 4).
   Chinese output and locale rules are unchanged: `zh-CN` grouping, `¥` prefix,
   `万` / `M` compaction, `YYYY-MM-DD HH:mm` timestamps and the 「刚刚 / N 分钟前」
   relative wording all come from the legacy file. */

import type { OrderStatus } from "./types";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/* React escapes text on its own. `esc` stays exported only for the few places
   that build markup by hand: chart labels, `aria-label` strings and the CSV
   cell escaping below. */
export const esc = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toNumber = (value: unknown): number => Number(value || 0);

/* `sum(list)` adds the raw entries, `sum(list, pick)` adds one field of each
   entry. Both fall back to 0 for missing values, exactly like the legacy code. */
export const sum = <T>(list: T[], pick?: (x: T) => number): number =>
  list.reduce((total, item) => total + toNumber(pick ? pick(item) : item), 0);

export const money = (value: number): string =>
  "¥" +
  Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const compactMoney = (value: number): string => {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1000000) return "¥" + (n / 1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 10000) return "¥" + (n / 10000).toFixed(1) + "万";
  return money(n);
};

export const num = (value: number, digits = 0): string =>
  Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const pct = (value: number, digits = 0): string =>
  `${Number(value || 0).toFixed(digits)}%`;

export const pad = (n: number): string => String(n).padStart(2, "0");

export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const dateTime = (value: string | number | Date): string => {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const relative = (value: string | number | Date, now: number = Date.now()): string => {
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

export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* 订单状态文案（legacy `ORDER_STATUS` 的 label 部分）。 */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "待确认",
  confirmed: "已确认",
  shipped: "已发货",
  completed: "已完成",
  cancelled: "已取消",
};

/* 设备在线状态（legacy `DEVICE_STATE`，含徽标色调）。 */
export const DEVICE_STATE: Record<string, { label: string; tone: string }> = {
  online: { label: "在线", tone: "ok" },
  offline: { label: "离线", tone: "plain" },
  alarm: { label: "告警", tone: "danger" },
};

/* CSV 正文：单元格按 legacy 规则转义，行之间用 CRLF。
   BOM 由 `downloadCsv` 负责追加，因此 `toCsv` 保持纯文本、可直接断言。 */
export function toCsv(rows: (string | number | null)[][]): string {
  const escapeCell = (value: string | number | null): string => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/* 触发浏览器下载。UTF-8 BOM 让 Excel 正确识别中文，文件内容与 legacy
   `downloadCsv(filename, rows)` 完全一致。 */
export function downloadCsv(filename: string, csv: string): void {
  const text = "\uFEFF" + csv;
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
