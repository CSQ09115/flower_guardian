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
  | "plants";

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
};

export const NAV_GROUPS: { label: string; keys: RouteKey[] }[] = [
  { label: "工作台", keys: ["overview", "stats"] },
  { label: "传感器", keys: ["devices", "alerts"] },
  { label: "经营", keys: ["products", "orders", "users", "plants"] },
];

/** Mirrors the legacy `parseRoute()`: `devices/:code` is the device detail. */
export function routeKeyFromPath(pathname: string): RouteKey | "login" {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "login") return "login";
  if (parts[0] === "devices" && parts[1]) return "deviceDetail";
  if (parts[0] && parts[0] in ROUTES) return parts[0] as RouteKey;
  return "overview";
}

export function routeTitle(key: RouteKey | "login"): string {
  if (key === "login") return "登录";
  return ROUTES[key]?.title ?? "概览";
}
