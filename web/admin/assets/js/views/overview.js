import { icon } from "../icons.js";
import { toast } from "../ui.js";
import { badge } from "../ui.js";
import {
  computeAovTrend, computeOverview, computeStatusBreakdown, computeTrend, computeUserTrend,
  deviceIssues, deviceState, isDemo, latestReading, movingAverage, pendingAlerts, sensorSummary, store,
} from "../store.js";
import { STATUS_COLOR, VIZ, chart, donutChart, ringGauge, sparkline } from "../charts.js";
import { compactMoney, dateTime, DEVICE_STATE, esc, money, num, relative } from "../util.js";

let range = 14;

const STATUS_ITEMS = [
  ["pending", "待确认"],
  ["confirmed", "已确认"],
  ["shipped", "已发货"],
  ["completed", "已完成"],
  ["cancelled", "已取消"],
];

export async function render(root) {
  const overview = computeOverview(range);
  const trend = computeTrend(range);
  const users = computeUserTrend(range);
  const aov = computeAovTrend(range);
  const average = movingAverage(trend.sales, 7);
  const statusCounts = computeStatusBreakdown(range);
  const summary = sensorSummary();
  const alerts = pendingAlerts();
  const attention = store.data.devices
    .map((device) => ({ device, issues: deviceIssues(device), state: deviceState(device) }))
    .filter((row) => row.state !== "online")
    .sort((a, b) => (a.state === "offline" ? 1 : 0) - (b.state === "offline" ? 1 : 0))
    .slice(0, 3);
  const recent = [...store.data.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
  const statusItems = STATUS_ITEMS
    .filter(([key]) => statusCounts[key])
    .map(([key, label]) => ({ label, value: statusCounts[key], color: STATUS_COLOR[key] }));
  const fulfilled = statusCounts.completed + statusCounts.shipped;
  const fulfillment = overview.order_count ? Math.round((fulfilled / overview.order_count) * 100) : 0;
  const avgSales = trend.sales.reduce((total, value) => total + value, 0) / Math.max(1, trend.sales.length);
  const peakValue = Math.max(0, ...trend.sales);
  const peakLabel = trend.labels[trend.sales.indexOf(peakValue)] || "";

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <h1>概览</h1>
        <p>经营与花盆设备在同一张工作台上：先看今天要处理什么，再下钻到订单或某一只花盆。</p>
      </div>
      <div class="page-head__actions">
        <a class="btn btn--ghost" href="#/devices">${icon("cpu", { size: 15 })}查看设备</a>
        <button class="btn" type="button" id="ov-refresh">${icon("refresh", { size: 15 })}刷新</button>
      </div>
    </div>

    ${isDemo() ? `<div class="note">${icon("info", { size: 15 })}<span>当前展示内置演示数据，所有写操作只改动本次会话；点侧栏「连接后端」可登录真实接口。演示数值仅用于界面验证，不代表真实经营情况。</span></div>` : ""}

    <div class="kpis" style="margin-top:16px">
      ${kpi("销售额合计", compactMoney(overview.total_sales), `近 ${range} 天 · 含全部订单状态`, "chart",
        { count: overview.total_sales, format: "compact", spark: trend.sales, sparkColor: VIZ.leaf, tone: "rose" })}
      ${kpi("订单数", num(overview.order_count), `近 ${range} 天 · 含已取消`, "receipt",
        { count: overview.order_count, format: "int", spark: trend.orders, sparkColor: VIZ.coral, tone: "mint" })}
      ${kpi("客单价", money(overview.avg_order_value), "销售额 ÷ 订单数", "gauge",
        { count: overview.avg_order_value, format: "money", spark: aov, sparkColor: VIZ.green, tone: "pink" })}
      ${kpi("新增用户", num(overview.user_count), `近 ${range} 天注册`, "users",
        { count: overview.user_count, format: "int", spark: users, sparkColor: VIZ.green })}
    </div>

    <div class="grid-2">
      <section class="card" aria-labelledby="trend-title">
        <div class="card__head">
          <div><h2 id="trend-title">销售趋势</h2><p>按日汇总，实线为销售额，虚线为 7 日均线</p></div>
          <div class="card__actions">
            <div class="segmented" role="group" aria-label="趋势时间范围">
              ${[7, 14, 30].map((d) => `<button type="button" data-range="${d}" class="${d === range ? "is-active" : ""}" aria-pressed="${d === range}">${d} 天</button>`).join("")}
            </div>
          </div>
        </div>
        <div class="card__body">
          ${chart({
            labels: trend.labels,
            series: [
              { name: "销售额", values: trend.sales, color: VIZ.leaf, format: money },
              { name: "7 日均线", values: average, color: VIZ.coral, dashed: true, area: false, format: money },
            ],
            height: 276,
            yMin: 0,
            format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))),
            xFormat: (label) => label.slice(5),
            ariaLabel: `近 ${range} 天销售额趋势与 7 日均线`,
          })}
          <div class="chart__legend">
            <span><i></i>销售额</span>
            <span><i class="dashed"></i>7 日均线</span>
            <span><i class="area"></i>统计口径：全部状态</span>
          </div>
          <div class="chart-foot">
            <span>日均 <b>${money(avgSales)}</b></span>
            <span>峰值 <b>${money(peakValue)}</b>${peakLabel ? ` · ${esc(peakLabel.slice(5))}` : ""}</span>
          </div>
        </div>
      </section>

      <section class="card" aria-labelledby="sensor-title">
        <div class="card__head">
          <div><h2 id="sensor-title">花盆设备</h2><p>ESP32-S3 · 土壤湿度 / 土温 / 光照</p></div>
          <div class="card__actions"><a class="btn btn--ghost btn--sm" href="#/devices">全部设备${icon("chevronRight", { size: 13 })}</a></div>
        </div>
        <div class="card__body">
          <div class="sensor-summary">
            <div class="sensor-summary__gauge">
              ${ringGauge({
                value: summary.online,
                max: summary.total,
                label: "在线设备",
                caption: "在线",
                color: VIZ.leaf,
                size: 112,
              })}
              <small>${summary.online} / ${summary.total} 台在线</small>
            </div>
            <div class="sensor-summary__stats">
              ${miniStat("设备总数", num(summary.total), "台")}
              ${miniStat("离线", num(summary.offline), "台", summary.offline ? "var(--coral-ink)" : "var(--ink)")}
              ${miniStat("告警", num(summary.alarm), "台", summary.alarm ? "var(--danger)" : "var(--ink)")}
              ${miniStat("平均湿度", summary.online ? summary.avgMoisture.toFixed(1) : "—", "%", "var(--ink)")}
            </div>
          </div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
            <div class="fieldset-title">需要关注</div>
            <div style="display:grid;gap:9px;margin-top:10px">
              ${attention.length ? attention.map(({ device, issues, state }) => `
                <a href="#/devices/${encodeURIComponent(device.code)}" style="display:flex;align-items:center;gap:9px;font-size:12px">
                  <span class="source-dot ${state === "offline" ? "" : "is-demo"}"></span>
                  <span style="min-width:0">
                    <b style="display:block;font-size:12px">${esc(device.name)}</b>
                    <small style="display:block;color:var(--muted-2);font-size:10.5px">${esc(issues[0]?.text || "需要查看")}</small>
                  </span>
                  <span style="margin-left:auto">${badge(DEVICE_STATE[state].label, DEVICE_STATE[state].tone)}</span>
                </a>`).join("") : `<div style="color:var(--muted-2);font-size:12px">全部设备在线，最近读数在阈值内。</div>`}
            </div>
            <p class="card-note">在线判定为 90 秒内有上报；越界读数与离线会同时写入告警记录。</p>
          </div>
        </div>
      </section>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <section class="card" aria-labelledby="status-title">
        <div class="card__head">
          <div><h2 id="status-title">订单构成</h2><p>近 ${range} 天 · 按订单状态计数</p></div>
          <div class="card__actions"><a class="btn btn--ghost btn--sm" href="#/orders">订单列表${icon("chevronRight", { size: 13 })}</a></div>
        </div>
        <div class="card__body">
          ${statusItems.length
            ? `${donutChart({
              items: statusItems,
              centerValue: num(overview.order_count),
              centerLabel: "笔订单",
              ariaLabel: `近 ${range} 天订单状态构成，共 ${overview.order_count} 笔`,
            })}
            <div class="status-foot">
              <div class="status-foot__row"><span>已发货 + 已完成</span><b>${num(fulfilled)} / ${num(overview.order_count)} 笔 · ${fulfillment}%</b></div>
              <div class="meter meter--wide"><i style="width:${fulfillment}%"></i></div>
            </div>`
            : `<div class="empty">${icon("receipt", { size: 28 })}<b>区间内没有订单</b></div>`}
        </div>
      </section>

      <section class="card" aria-labelledby="alert-title">
        <div class="card__head">
          <div><h2 id="alert-title">待处理告警</h2><p>阈值越界与设备离线</p></div>
          <div class="card__actions"><a class="btn btn--ghost btn--sm" href="#/alerts">全部告警${icon("chevronRight", { size: 13 })}</a></div>
        </div>
        <div class="card__body">
          ${alerts.length ? `<div style="display:grid;gap:2px">${alerts.slice(0, 4).map((a) => `
            <div style="display:flex;gap:9px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)">
              <span style="margin-top:2px;color:${a.level === "danger" ? "var(--danger)" : "var(--coral-ink)"}">${icon("alert", { size: 15 })}</span>
              <span style="min-width:0">
                <b style="display:block;font-size:12px">${esc(deviceName(a.device_code))} · ${esc(a.label)}</b>
                <small style="color:var(--muted-2);font-size:10.5px">${esc(a.hint)}</small>
              </span>
              <small style="margin-left:auto;color:var(--muted-2);font-size:10.5px;white-space:nowrap">${relative(a.at)}</small>
            </div>`).join("")}</div>` : `<div class="empty">${icon("check", { size: 28 })}<b>没有待处理告警</b><p>所有设备最近读数都在阈值内。</p></div>`}
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:16px" aria-labelledby="recent-title">
      <div class="card__head">
        <div><h2 id="recent-title">最近订单</h2><p>按创建时间倒序，取最近 6 笔</p></div>
        <div class="card__actions"><a class="btn btn--ghost btn--sm" href="#/orders">全部订单${icon("chevronRight", { size: 13 })}</a></div>
      </div>
      <div class="card__body card__body--flush">
        ${recent.length ? `<div class="table-wrap"><table class="table" style="min-width:620px">
          <thead><tr><th>订单号</th><th>用户</th><th class="num">金额</th><th>状态</th><th>时间</th></tr></thead>
          <tbody>${recent.map((o) => `<tr>
            <td class="mono">${esc(o.order_no)}</td>
            <td>${esc(store.data.users.find((u) => u.id === o.user_id)?.username || o.contact_name || "—")}</td>
            <td class="num strong">${money(o.total_amount)}</td>
            <td>${statusBadge(o.status)}</td>
            <td class="nowrap" style="color:var(--muted-2)">${dateTime(o.created_at).slice(5, 16)}</td>
          </tr>`).join("")}</tbody>
        </table></div>` : `<div class="empty">${icon("receipt", { size: 28 })}<b>还没有订单</b></div>`}
      </div>
    </section>`;

  root.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      range = Number(btn.dataset.range);
      render(root);
    });
  });
  root.querySelector("#ov-refresh").addEventListener("click", () => {
    render(root);
    toast("已刷新概览");
  });
}

function kpi(label, value, meta, iconName, { count = null, format = "int", spark = null, sparkColor = VIZ.leaf, tone = "" } = {}) {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}">
    <div class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(iconName, { size: 15 })}</span></div>
    <div class="kpi__value"${count != null ? ` data-count="${count}" data-count-format="${format}"` : ""}>${value}</div>
    ${spark && spark.length > 1 ? `<span class="kpi__spark">${sparkline(spark, { color: sparkColor })}</span>` : ""}
    <div class="kpi__meta">${meta}</div>
  </div>`;
}

function miniStat(label, value, unit, color) {
  return `<div><small style="display:block;color:var(--muted-2);font-size:10.5px">${label}</small>
    <b style="font-size:19px;letter-spacing:-.03em;color:${color || "var(--ink)"};font-variant-numeric:tabular-nums">${value}<span style="font-size:10px;font-weight:500;color:var(--muted-2);margin-left:2px">${unit}</span></b></div>`;
}

function statusBadge(status) {
  const map = {
    pending: ["待确认", "rose"], confirmed: ["已确认", "info"], shipped: ["已发货", "mist"],
    completed: ["已完成", "done"], cancelled: ["已取消", "stone"],
  };
  const [label, tone] = map[status] || [status, ""];
  return badge(label, tone);
}

function deviceName(code) {
  return store.data.devices.find((d) => d.code === code)?.name || code;
}