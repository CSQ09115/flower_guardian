/* Route table shared by the router, the sidebar, the breadcrumb and the
 * document title. Ported from `legacy/admin/assets/js/app.js` (ROUTES and
 * NAV_GROUPS) — the titles, groups and icon names are verbatim. */

export type RouteKey =
  | "overview"
  | "stats"
  | "devices"
  | "deviceDetail"
  | "alerts"
  | "products"
  | "orders"
  | "users"
  | "plants"
  | "emailLogs"
  | "smsLogs"
  | "configGroup"
  | "configYolo"
  | "apiDocs";

export type RouteMeta = { title: string; group: string; iconName: string };

export const ROUTES: Record<RouteKey, RouteMeta> = {
  overview: { title: "概览", group: "工作台", iconName: "layout" },
  stats: { title: "数据统计", group: "工作台", iconName: "chart" },
  devices: { title: "花盆设备", group: "传感器", iconName: "cpu" },
  deviceDetail: { title: "设备详情", group: "传感器", iconName: "cpu" },
  alerts: { title: "告警记录", group: "传感器", iconName: "bell" },
  products: { title: "商品管理", group: "经营", iconName: "box" },
  orders: { title: "订单管理", group: "经营", iconName: "receipt" },
  users: { title: "用户管理", group: "经营", iconName: "users" },
  plants: { title: "植物库", group: "经营", iconName: "leaf" },
  emailLogs: { title: "邮件发送日志", group: "日志", iconName: "history" },
  smsLogs: { title: "短信发送日志", group: "日志", iconName: "activity" },
  configGroup: { title: "系统配置", group: "系统", iconName: "settings" },
  configYolo: { title: "YOLO 模型", group: "系统", iconName: "eye" },
  apiDocs: { title: "API 对接文档", group: "系统", iconName: "link" },
};

export const NAV_GROUPS: { label: string; keys: RouteKey[] }[] = [
  { label: "工作台", keys: ["overview", "stats"] },
  { label: "传感器", keys: ["devices", "alerts"] },
  { label: "经营", keys: ["products", "orders", "users", "plants"] },
  { label: "日志", keys: ["emailLogs", "smsLogs"] },
  { label: "系统", keys: ["configGroup", "configYolo", "apiDocs"] },
];

/** The config pages share one route (`config/:group`); this is the menu order. */
export const CONFIG_PAGES: { group: string; label: string; iconName: string }[] = [
  { group: "weather", label: "天气 API", iconName: "sun" },
  { group: "smtp", label: "SMTP 发件箱", iconName: "wrench" },
  { group: "sms", label: "短信验证码", iconName: "activity" },
  { group: "ai", label: "AI 问诊", iconName: "sprout" },
  { group: "payment", label: "支付 API", iconName: "receipt" },
  { group: "login", label: "QQ / 微信登录", iconName: "user" },
];

export const CONFIG_GROUP_KEYS = CONFIG_PAGES.map((page) => page.group);

/** Sidebar-only nav model: the config group expands into per-page entries. */
export const SIDEBAR_NAV: (
  | { kind: "route"; key: RouteKey }
  | { kind: "config"; group: string; label: string; iconName: string }
)[] = [
  { kind: "route", key: "overview" },
  { kind: "route", key: "stats" },
  { kind: "route", key: "devices" },
  { kind: "route", key: "alerts" },
  { kind: "route", key: "products" },
  { kind: "route", key: "orders" },
  { kind: "route", key: "users" },
  { kind: "route", key: "plants" },
  { kind: "route", key: "emailLogs" },
  { kind: "route", key: "smsLogs" },
  ...CONFIG_PAGES.map((page) => ({ kind: "config" as const, ...page })),
  { kind: "route", key: "configYolo" },
  { kind: "route", key: "apiDocs" },
];

/** Path of a route key, mirroring the router table. */
export function pathForRoute(key: RouteKey): string {
  switch (key) {
    case "deviceDetail":
      return "/devices";
    case "emailLogs":
      return "/logs/email";
    case "smsLogs":
      return "/logs/sms";
    case "configYolo":
      return "/config/yolo";
    case "apiDocs":
      return "/docs/api";
    default:
      return `/${key}`;
  }
}

/** Mirrors the legacy `parseRoute()`: `devices/:code` is the device detail. */
export function routeKeyFromPath(pathname: string): RouteKey | "login" {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "login") return "login";
  if (parts[0] === "devices" && parts[1]) return "deviceDetail";
  if (parts[0] === "logs") return parts[1] === "sms" ? "smsLogs" : "emailLogs";
  if (parts[0] === "config") {
    if (parts[1] === "yolo") return "configYolo";
    if (CONFIG_GROUP_KEYS.includes(parts[1] ?? "")) return "configGroup";
  }
  if (parts[0] === "docs") return "apiDocs";
  if (parts[0] && parts[0] in ROUTES) return parts[0] as RouteKey;
  return "overview";
}

/** Breadcrumb / document title for a route (config pages use the group label). */
export function routeTitle(key: RouteKey | "login", group?: string): string {
  if (key === "login") return "登录";
  if (key === "configGroup" && group) {
    return CONFIG_PAGES.find((page) => page.group === group)?.label ?? "系统配置";
  }
  return ROUTES[key]?.title ?? "概览";
}
