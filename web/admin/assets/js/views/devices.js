import { icon } from "../icons.js";
import { badge, openModal, toast } from "../ui.js";
import {
  createDevice, deviceIssues, deviceState, isDemo, latestReading, sensorSummary, store,
} from "../store.js";
import { VIZ, heatmapChart, sparkline } from "../charts.js";
import { dateTime, DEVICE_STATE, esc, num, relative } from "../util.js";

let query = "";
let filter = "all";

export async function render(root) {
  const summary = sensorSummary();
  const counts = {
    all: store.data.devices.length,
    online: summary.online,
    alarm: summary.alarm,
    offline: summary.offline,
  };

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <h1>花盆设备</h1>
        <p>ESP32-S3 花盆端每 10 秒上报一次土壤湿度、土壤温度与光照。这里是设备、读数与阈值的第一入口。</p>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--ghost" type="button" id="dev-refresh">${icon("refresh", { size: 15 })}刷新读数</button>
        <button class="btn" type="button" id="dev-new">${icon("plus", { size: 15 })}接入设备</button>
      </div>
    </div>

    ${isDemo() ? `<div class="note">${icon("info", { size: 15 })}<span>演示设备与读数用于界面验证，不代表真实硬件。已实现传感器：土壤湿度（电容式 ADC）、光照（BH1750）；土壤温度仍是固件内的模拟曲线，接入 DS18B20 前不应作为决策依据。</span></div>` : ""}

    <div class="kpis" style="margin-top:16px">
      ${kpi("设备总数", num(summary.total), "台", "cpu", "rose", summary.total)}
      ${kpi("在线", num(summary.online), "90 秒内有上报", "wifi", "ok", summary.online)}
      ${kpi("离线", num(summary.offline), "超过 90 秒无上报", "wifiOff", summary.offline ? "pink" : "", summary.offline)}
      ${kpi("阈值告警", num(summary.alarm), "在线且读数越界", "alert", summary.alarm ? "coral" : "", summary.alarm)}
    </div>

    <section class="card" style="margin-bottom:16px" aria-labelledby="heat-title">
      <div class="card__head">
        <div><h2 id="heat-title">土壤湿度分布</h2><p>每台设备最近 24 小时，按 2 小时归并 · 颜色越深湿度越高</p></div>
        <div class="card__actions"><span class="badge badge--plain">${summary.total} 台设备</span></div>
      </div>
      <div class="card__body">
        ${heatmapChart({
          rows: moistureHeatmap(),
          cols: Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, "0")}`),
          min: 10,
          max: 80,
          unit: "%",
          ariaLabel: "各设备近 24 小时土壤湿度分布热力图",
        })}
        <div class="chart__legend">
          <span><i class="area"></i>格内为该时段读数均值</span>
          <span>离线设备取最后一次上报前的 24 小时</span>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="toolbar">
        <div class="search">
          ${icon("search")}
          <input class="input" id="dev-search" type="search" placeholder="搜索设备编号、名称或位置" value="${esc(query)}" aria-label="搜索设备">
        </div>
        <div class="chips" id="dev-chips" role="group" aria-label="按状态筛选">
          ${chip("all", "全部", counts.all)}
          ${chip("online", "在线", counts.online)}
          ${chip("alarm", "告警", counts.alarm)}
          ${chip("offline", "离线", counts.offline)}
        </div>
        <span style="margin-left:auto;color:var(--muted-2);font-size:11.5px">共 ${store.data.devices.length} 台</span>
      </div>
      <div class="card__body" id="device-list"></div>
    </section>`;

  const list = root.querySelector("#device-list");
  const search = root.querySelector("#dev-search");

  const paint = () => {
    const rows = filtered();
    list.innerHTML = rows.length ? `<div class="device-grid">${rows.map(card).join("")}</div>` : emptyState();
  };

  search.addEventListener("input", () => {
    query = search.value.trim();
    paint();
  });
  root.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      root.querySelectorAll("[data-filter]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      paint();
    });
  });
  root.querySelector("#dev-refresh").addEventListener("click", () => {
    paint();
    toast("设备读数已刷新");
  });
  root.querySelector("#dev-new").addEventListener("click", () => openCreate());

  paint();
}

function filtered() {
  const q = query.toLowerCase();
  return store.data.devices.filter((device) => {
    const state = deviceState(device);
    if (filter === "alarm" && state !== "alarm") return false;
    if (filter === "online" && state === "offline") return false;
    if (filter === "offline" && state !== "offline") return false;
    if (!q) return true;
    return [device.code, device.name, device.location, device.ip_address]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });
}

function card(device) {
  const latest = latestReading(device);
  const state = deviceState(device);
  const issues = deviceIssues(device);
  const moisture = latest?.soil_moisture;
  const low = moisture != null && moisture < (device.thresholds?.moistureMin ?? 0);
  return `<article class="device-card">
    <div class="device-card__head">
      <span style="color:var(--green-2);margin-top:2px">${icon(state === "offline" ? "wifiOff" : "cpu", { size: 18 })}</span>
      <div style="min-width:0">
        <h2><a href="#/devices/${encodeURIComponent(device.code)}">${esc(device.name)}</a></h2>
        <div class="device-card__code">${esc(device.code)} · ${esc(device.location || "未设置位置")}</div>
      </div>
      ${badge(DEVICE_STATE[state].label, DEVICE_STATE[state].tone)}
    </div>

    <div class="device-card__readings">
      <div><small>土壤湿度</small><b>${moisture != null ? moisture.toFixed(1) : "—"}<span>%</span></b></div>
      <div><small>土壤温度</small><b>${latest?.soil_temp != null ? latest.soil_temp.toFixed(1) : "—"}<span>℃</span></b></div>
      <div><small>光照</small><b>${latest?.light_lux != null ? num(latest.light_lux) : "无读数"}<span>${latest?.light_lux != null ? "lx" : ""}</span></b></div>
    </div>

    ${moisture != null ? `<div class="meter ${low ? "is-low" : ""}" title="湿度区间 ${device.thresholds.moistureMin}–${device.thresholds.moistureMax}%">
      <i style="width:${Math.max(2, Math.min(100, moisture))}%"></i>
    </div>` : ""}

    ${sparkSample(device).length > 1 ? `<div class="device-card__spark">
      ${sparkline(sparkSample(device), { color: low ? VIZ.coral : VIZ.leaf })}
      <small>近 24 小时土壤湿度</small>
    </div>` : ""}

    <div class="device-card__foot">
      <span style="display:inline-flex;align-items:center;gap:4px">${icon("clock", { size: 12 })}${relative(device.last_seen)}</span>
      <span>·</span><span>固件 ${esc(device.firmware || "—")}</span>
      ${issues.length ? `<span class="device-card__issue${issues[0].level === "danger" ? " is-danger" : ""}">${icon("alert", { size: 12 })}${esc(issues[0].text)}</span>` : ""}
      <a class="btn btn--ghost btn--sm" href="#/devices/${encodeURIComponent(device.code)}">详情</a>
    </div>
  </article>`;
}

function chip(key, label, count) {
  return `<button class="chip${filter === key ? " is-active" : ""}" type="button" data-filter="${key}" aria-pressed="${filter === key}">
    ${label}<span class="chip__count">${count}</span>
  </button>`;
}

/* Every sixth sample: 24 points over 24 hours, enough to show the shape
   without drawing every 10-minute reading. */
function sparkSample(device) {
  return (device.readings || [])
    .filter((_, i) => i % 6 === 0)
    .map((reading) => reading.soil_moisture);
}

/* Each device's own last 24 hours, bucketed into 2-hour means. Fixed colour
   bounds (10–80%) keep the comparison honest across differing thresholds. */
function moistureHeatmap() {
  return store.data.devices.map((device) => {
    const sums = new Array(12).fill(0);
    const counts = new Array(12).fill(0);
    (device.readings || []).slice(-144).forEach((reading) => {
      if (reading.soil_moisture == null) return;
      const bucket = Math.min(11, Math.floor(new Date(reading.created_at).getHours() / 2));
      sums[bucket] += reading.soil_moisture;
      counts[bucket] += 1;
    });
    return {
      label: device.name,
      sub: device.code.replace("FG-ESP32-", "#"),
      values: sums.map((total, i) => (counts[i] ? total / counts[i] : null)),
    };
  });
}

function kpi(label, value, meta, iconName, tone = "", count = null) {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}">
    <div class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(iconName, { size: 15 })}</span></div>
    <div class="kpi__value"${count != null ? ` data-count="${count}" data-count-format="int"` : ""}>${value}</div>
    <div class="kpi__meta">${meta}</div>
  </div>`;
}

function emptyState() {
  return `<div class="empty">${icon("cpu", { size: 30 })}<b>没有匹配的设备</b><p>换一个关键词，或把筛选切回「全部」。新硬件接入后会出现在这里。</p></div>`;
}

function openCreate() {
  const { el, close } = openModal({
    title: "接入新设备",
    subtitle: "设备第一次上报时会自动登记；也可以先在这里建好档案。",
    body: `<form id="dev-form" style="display:grid;gap:12px">
      <div class="field">
        <label for="dev-code">设备编号</label>
        <input class="input" id="dev-code" name="code" required pattern="[A-Za-z0-9\\-_.]+" placeholder="FG-ESP32-007" autocomplete="off">
        <div class="field__hint">与固件 <code>wifi_config.h</code> 里的 DEVICE_CODE 一致。</div>
      </div>
      <div class="form-row">
        <div class="field"><label for="dev-name">显示名称</label><input class="input" id="dev-name" name="name" placeholder="客厅 · 绿萝" required></div>
        <div class="field"><label for="dev-loc">摆放位置</label><input class="input" id="dev-loc" name="location" placeholder="客厅南窗"></div>
      </div>
      <div class="note" style="margin-top:0">${icon("info", { size: 15 })}<span>新设备默认阈值：湿度 35–70%、土温 12–30℃、光照 500–30000 lx，可在详情页修改。</span></div>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-close>取消</button>
      <button class="btn" type="submit" form="dev-form">创建档案</button>`,
    onMount(dialog) {
      dialog.querySelector("#dev-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        const code = String(data.code || "").trim().toUpperCase();
        if (!code) return;
        if (store.data.devices.some((d) => d.code === code)) {
          toast("设备编号已存在", "error");
          return;
        }
        try {
          await createDevice({ code, name: data.name.trim(), location: data.location.trim() });
          close();
          toast("设备档案已创建");
        } catch (error) {
          toast(error.message, "error");
        }
      });
    },
  });
  void el;
}
