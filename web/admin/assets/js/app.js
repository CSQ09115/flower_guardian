/* Router + application shell. Hash routes keep the build dependency-free. */

import { icon, hydrateIcons } from "./icons.js";
import { animateNumbers, toast } from "./ui.js";
import { isDemo, loadLive, logout, pendingAlerts, sensorSummary, store } from "./store.js";
import { esc } from "./util.js";
import { hydrateCharts } from "./charts.js";

import * as overview from "./views/overview.js";
import * as devices from "./views/devices.js";
import * as deviceDetail from "./views/device-detail.js";
import * as alerts from "./views/alerts.js";
import * as products from "./views/products.js";
import * as orders from "./views/orders.js";
import * as users from "./views/users.js";
import * as plants from "./views/plants.js";
import * as stats from "./views/stats.js";
import * as login from "./views/login.js";

const ROUTES = {
  overview: { title: "概览", view: overview, group: "工作台", iconName: "layout" },
  stats: { title: "数据统计", view: stats, group: "工作台", iconName: "chart" },
  devices: { title: "花盆设备", view: devices, group: "传感器", iconName: "cpu" },
  deviceDetail: { title: "设备详情", view: deviceDetail, group: "传感器", iconName: "cpu" },
  alerts: { title: "告警记录", view: alerts, group: "传感器", iconName: "bell" },
  products: { title: "商品管理", view: products, group: "经营", iconName: "box" },
  orders: { title: "订单管理", view: orders, group: "经营", iconName: "receipt" },
  users: { title: "用户管理", view: users, group: "经营", iconName: "users" },
  plants: { title: "植物库", view: plants, group: "经营", iconName: "leaf" },
};

const NAV_GROUPS = [
  { label: "工作台", keys: ["overview", "stats"] },
  { label: "传感器", keys: ["devices", "alerts"] },
  { label: "经营", keys: ["products", "orders", "users", "plants"] },
];

const appEl = document.getElementById("app");
const viewEl = document.getElementById("view");
const navEl = document.getElementById("sidebar-nav");
const footEl = document.getElementById("sidebar-foot");
const crumbEl = document.getElementById("crumb");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menu-toggle");
const refreshBtn = document.getElementById("refresh");

/* Mobile drawer scrim: dims the page behind the sidebar and doubles as the
   tap-to-dismiss target. Hidden while the drawer is closed so it never joins
   the tab order. */
const drawerScrim = document.createElement("button");
drawerScrim.type = "button";
drawerScrim.className = "scrim";
drawerScrim.hidden = true;
drawerScrim.setAttribute("aria-label", "关闭导航");
drawerScrim.addEventListener("click", () => closeSidebar());
document.getElementById("app").append(drawerScrim);

/* While the drawer is open the page behind it is inert, so Tab cannot wander
   into a region the scrim has visually pushed back. */
const mainEl = document.querySelector(".main");
let drawerReturnFocus = null;

let renderToken = 0;

function parseRoute() {
  const raw = (location.hash || "#/overview").replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "login") return { name: "login", params: {} };
  if (parts[0] === "devices" && parts[1]) return { name: "deviceDetail", params: { code: parts[1] } };
  if (ROUTES[parts[0]]) return { name: parts[0], params: {} };
  return { name: "overview", params: {} };
}

function navCounts() {
  return {
    alerts: pendingAlerts().length,
    devices: sensorSummary().alarm,
  };
}

function renderSidebar(activeName) {
  const counts = navCounts();
  navEl.innerHTML = NAV_GROUPS.map((group) => `
    <div class="nav-group">
      <div class="nav-group__label">${group.label}</div>
      ${group.keys.map((key) => {
        const route = ROUTES[key];
        const active = key === activeName || (key === "devices" && activeName === "deviceDetail");
        const count = counts[key] || 0;
        return `<a class="nav-item${active ? " is-active" : ""}" href="#/${key}"${active ? ' aria-current="page"' : ""}>
          ${icon(route.iconName, { size: 17 })}
          <span>${route.title}</span>
          ${count ? `<span class="nav-item__badge">${count}</span>` : ""}
        </a>`;
      }).join("")}
    </div>`).join("");

  const demo = isDemo();
  const name = demo ? "演示管理员" : (store.admin.username || "管理员");
  footEl.innerHTML = `
    <div class="source-line">
      <span class="source-dot ${demo ? "is-demo" : "is-live"}"></span>
      <span>数据源</span><b>${demo ? "演示数据" : "实时接口"}</b>
    </div>
    <div class="sidebar__user">
      <span class="avatar">${esc(String(name).slice(0, 1).toUpperCase())}</span>
      <span><b>${esc(name)}</b><small>${demo ? "未连接后端" : "管理员"}</small></span>
      <button class="icon-btn" type="button" id="foot-data" aria-label="${demo ? "连接后端" : "刷新接口数据"}" title="${demo ? "连接后端" : "刷新接口数据"}">${icon(demo ? "plug" : "refresh", { size: 16 })}</button>
      <button class="icon-btn icon-btn--danger" type="button" id="foot-exit" aria-label="${demo ? "以演示模式重置" : "退出登录"}" title="${demo ? "重置演示数据" : "退出登录"}">${icon("logout", { size: 16 })}</button>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px">
      <a class="btn btn--ghost btn--sm" style="flex:1;height:29px" href="${demo ? "#/login" : "../index.html"}">${icon(demo ? "plug" : "external", { size: 13 })}${demo ? "连接后端" : "查看官网"}</a>
    </div>`;

  footEl.querySelector("#foot-data")?.addEventListener("click", () => {
    if (isDemo()) { location.hash = "#/login"; return; }
    syncLive();
  });
  footEl.querySelector("#foot-exit")?.addEventListener("click", async () => {
    if (isDemo()) {
      const { resetDemo } = await import("./store.js");
      resetDemo();
      toast("演示数据已重置");
      render();
      return;
    }
    logout();
  });
}

function renderSourcePill() {
  const pill = document.getElementById("source-pill");
  if (!pill) return;
  pill.innerHTML = `<span class="source-dot ${isDemo() ? "is-demo" : "is-live"}"></span>${isDemo() ? "演示数据" : "实时接口"}`;
}

function updateCrumb(name) {
  const route = ROUTES[name];
  crumbEl.innerHTML = `<a href="#/overview">运营后台</a><span>/</span><b>${route ? esc(route.title) : "概览"}</b>`;
}

async function syncLive() {
  try {
    await loadLive();
    toast("已同步实时接口数据");
  } catch (error) {
    toast(`同步失败：${error.message}`, "error");
  }
}

function focusableTables(root) {
  /* Wide tables scroll sideways on phones. A scroll container must be keyboard
     reachable, so overflowing wrappers become labelled, focusable regions. */
  root.querySelectorAll(".table-wrap").forEach((wrap) => {
    if (wrap.dataset.a11y === "1" || wrap.scrollWidth <= wrap.clientWidth + 1) return;
    wrap.dataset.a11y = "1";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    const title = wrap.closest("section")?.querySelector("h2, h3")?.textContent.trim();
    wrap.setAttribute("aria-label", `${title || "数据表格"}，可横向滚动查看`);
  });
}

async function render({ scroll = false } = {}) {
  const token = ++renderToken;
  const route = parseRoute();
  store.route = route;
  document.body.classList.toggle("is-login", route.name === "login");

  if (route.name === "login") {
    document.title = "登录 · 护花使者运营后台";
    appEl.style.display = "none";
    let loginRoot = document.getElementById("login-root");
    if (!loginRoot) {
      loginRoot = document.createElement("main");
      loginRoot.id = "login-root";
      document.body.append(loginRoot);
    }
    await login.render(loginRoot, route.params);
    return;
  }

  appEl.style.display = "";
  document.getElementById("login-root")?.remove();
  document.title = `${ROUTES[route.name]?.title || "概览"} · 护花使者运营后台`;

  renderSidebar(route.name);
  renderSourcePill();
  updateCrumb(route.name);

  const view = ROUTES[route.name]?.view;
  if (!view) return;
  viewEl.classList.remove("is-enter");
  viewEl.innerHTML = `<div class="empty"><span class="icon">${icon("sprout", { size: 30 })}</span><b>正在读取数据</b></div>`;
  try {
    await view.render(viewEl, route.params);
  } catch (error) {
    console.error(error);
    viewEl.innerHTML = `<div class="empty">${icon("alert", { size: 30 })}<b>页面载入失败</b><p>${esc(error.message)}</p>
      <button class="btn btn--ghost btn--sm" type="button" id="retry">重试</button></div>`;
    viewEl.querySelector("#retry")?.addEventListener("click", () => render());
    return;
  }
  if (token !== renderToken) return;
  hydrateIcons(viewEl);
  hydrateCharts(viewEl);
  animateNumbers(viewEl);
  focusableTables(viewEl);
  void viewEl.offsetWidth;
  viewEl.classList.add("is-enter");
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  closeSidebar();
}

function closeSidebar() {
  const wasOpen = sidebar.classList.contains("is-open");
  sidebar.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  drawerScrim.hidden = true;
  mainEl.inert = false;
  if (wasOpen && drawerReturnFocus) {
    drawerReturnFocus.focus({ preventScroll: true });
    drawerReturnFocus = null;
  }
}

menuToggle.innerHTML = icon("menu");
refreshBtn.innerHTML = icon("refresh");

menuToggle.addEventListener("click", () => {
  if (sidebar.classList.contains("is-open")) {
    closeSidebar();
    return;
  }
  sidebar.classList.add("is-open");
  menuToggle.setAttribute("aria-expanded", "true");
  drawerScrim.hidden = false;
  mainEl.inert = true;
  drawerReturnFocus = menuToggle;
  const first = sidebar.querySelector(".nav-item.is-active") || sidebar.querySelector(".nav-item");
  if (first) first.focus({ preventScroll: true });
});

refreshBtn.addEventListener("click", async () => {
  if (!isDemo()) await syncLive();
  else render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
});

/* Rotating or resizing past the breakpoint makes the drawer permanent; close it
   so the page behind does not stay inert. */
window.matchMedia("(min-width: 981px)").addEventListener("change", (event) => {
  if (event.matches) closeSidebar();
});

window.addEventListener("hashchange", () => render({ scroll: true }));
window.addEventListener("fg:refresh", () => { if (parseRoute().name !== "login") render(); });
window.addEventListener("fg:toast", (event) => toast(event.detail.message, event.detail.tone));

if (!location.hash) location.hash = "#/overview";
render();
