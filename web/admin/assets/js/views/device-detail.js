import { icon } from "../icons.js";
import { badge, field, openModal, toast } from "../ui.js";
import { refreshView, saveDevice, deviceByCode, deviceIssues, deviceState, isDemo, isOnline, latestReading, store } from "../store.js";
import { chart, hydrateCharts, sparkline, VIZ } from "../charts.js";
import { clockOnly, dateTime, DEVICE_STATE, downloadCsv, esc, num, relative, timeOnly } from "../util.js";

let metric = "moisture";

const METRICS = {
  moisture: { label: "土壤湿度", unit: "%", color: VIZ.leaf, field: "soil_moisture", digits: 1 },
  temp: { label: "土壤温度", unit: "℃", color: VIZ.coral, field: "soil_temp", digits: 1 },
  lux: { label: "光照", unit: " lx", color: VIZ.green, field: "light_lux", digits: 0 },
};

export async function render(root, params) {
  const device = deviceByCode(params.code);
  if (!device) {
    root.innerHTML = `<div class="page-head"><div class="page-head__main"><h1>设备详情</h1>
      <p>没有找到编号为 ${esc(params.code)} 的设备。</p></div>
      <div class="page-head__actions"><a class="btn btn--ghost" href="#/devices">${icon("arrowLeft", { size: 15 })}返回设备列表</a></div></div>
      <div class="card">${`<div class="empty">${icon("cpu", { size: 30 })}<b>设备不存在</b><p>如果硬件已经上报过，请确认设备编号与固件 DEVICE_CODE 是否一致。</p></div>`}</div>`;
    return;
  }

  if (!METRICS[metric]) metric = "moisture";
  const latest = latestReading(device);
  const state = deviceState(device);
  const issues = deviceIssues(device);
  const readings = device.readings || [];
  const t = device.thresholds;
  const deviceAlerts = store.data.alerts.filter((a) => a.device_code === device.code && !a.acknowledged);
  const window24 = readings.filter((r) => Date.now() - new Date(r.created_at) < 24 * 3600 * 1000);

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <div class="crumb" style="margin-bottom:6px"><a href="#/devices">花盆设备</a><span>/</span><b>${esc(device.code)}</b></div>
        <h1>${esc(device.name)}</h1>
        <p>${esc(device.location || "未设置摆放位置")} · 共 ${readings.length} 条读数缓存</p>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--ghost" type="button" id="dd-edit">${icon("edit", { size: 15 })}编辑档案</button>
        <button class="btn btn--ghost" type="button" id="dd-export">${icon("download", { size: 15 })}导出读数</button>
        <button class="btn" type="button" id="dd-refresh">${icon("refresh", { size: 15 })}刷新</button>
      </div>
    </div>

    ${isDemo() ? `<div class="note">${icon("info", { size: 15 })}<span>演示设备：读数为固定种子生成的 24 小时曲线，阈值修改与告警确认只保存在本次会话。土壤温度仍是固件内的模拟值。</span></div>` : ""}

    <section class="device-hero" style="margin-top:16px">
      <span class="device-hero__icon">${icon(state === "offline" ? "wifiOff" : "cpu", { size: 22 })}</span>
      <div>
        <h2>${esc(device.code)} ${badge(DEVICE_STATE[state].label, DEVICE_STATE[state].tone)}</h2>
        <div class="device-hero__meta">
          <span>${icon("leaf", { size: 13 })}${esc(device.name)}</span>
          <span>${icon("cpu", { size: 13 })}固件 ${esc(device.firmware || "—")}</span>
          <span>${icon("link", { size: 13 })}${esc(device.ip_address || "未上报 IP")}</span>
          <span>${icon("clock", { size: 13 })}${device.last_seen ? `${relative(device.last_seen)}上报` : "尚未上报"}</span>
          <span>${icon("activity", { size: 13 })}每 ${esc(device.report_interval || 10)} 秒上报</span>
        </div>
      </div>
      <div class="device-hero__actions">
        ${issues.length ? `<span class="badge badge--${issues[0].level === "danger" ? "danger" : "warn"}">${icon("alert", { size: 12 })}${esc(issues[0].text)}</span>` : badge("读数正常", "ok")}
      </div>
    </section>

    <div class="sensor-tiles" style="margin-top:14px">
      ${sensorTile("土壤湿度", "droplet", latest?.soil_moisture, "%", 1, t.moistureMin, t.moistureMax, window24.map((r) => r.soil_moisture), latest?.soil_moisture != null && latest.soil_moisture < t.moistureMin, false, false, VIZ.leaf)}
      ${sensorTile("土壤温度", "thermometer", latest?.soil_temp, "℃", 1, t.tempMin, t.tempMax, window24.map((r) => r.soil_temp), latest?.soil_temp != null && (latest.soil_temp < t.tempMin || latest.soil_temp > t.tempMax), false, false, VIZ.coral)}
      ${sensorTile("光照", "sun", latest?.light_lux, "lx", 0, t.luxMin, t.luxMax, window24.map((r) => r.light_lux), latest?.light_lux != null && daylightNow() && latest.light_lux < t.luxMin, latest?.light_lux == null, !daylightNow(), VIZ.green)}
    </div>

    <div class="grid-2" style="margin-top:16px;align-items:start">
      <div class="stack">
      <section class="card" aria-labelledby="dd-chart-title">
        <div class="card__head">
          <div><h2 id="dd-chart-title">近 24 小时读数</h2><p id="dd-chart-note">${METRICS[metric].label}${metric === "moisture" ? " · 阴影为阈值区间" : ""}</p></div>
          <div class="card__actions">
            <div class="segmented" role="group" aria-label="选择曲线">
              ${Object.entries(METRICS).map(([key, m]) => `<button type="button" data-metric="${key}" class="${key === metric ? "is-active" : ""}" aria-pressed="${key === metric}">${m.label}</button>`).join("")}
            </div>
          </div>
        </div>
        <div class="card__body">
          <div id="dd-chart"></div>
          <div class="chart__legend">
            ${metric === "moisture" ? `<span><i></i>土壤湿度</span><span><i class="area"></i>${t.moistureMin}–${t.moistureMax}% 目标区间</span>` : ""}
            ${metric === "temp" ? `<span><i style="background:var(--viz-2)"></i>土壤温度</span><span><i class="area"></i>${t.tempMin}–${t.tempMax}℃ 目标区间</span>` : ""}
            ${metric === "lux" ? `<span><i style="background:var(--viz-3)"></i>光照</span><span><i class="dashed"></i>下限 ${num(t.luxMin)} lx</span>` : ""}
          </div>
          ${isDemo() ? `<div class="note" style="margin-top:12px">${icon("info", { size: 14 })}<span>演示曲线每 10 分钟一个点；真实固件每 10 秒上报一次，后端按小时聚合后再绘制。</span></div>` : ""}
        </div>
      </section>
      ${summaryCard(window24)}
      </div>

      <section class="card" aria-labelledby="dd-threshold-title">
        <div class="card__head">
          <div><h2 id="dd-threshold-title">阈值与告警</h2><p>越界后在告警页生成记录</p></div>
        </div>
        <div class="card__body">
          <form class="threshold-form" id="dd-threshold-form">
            <div class="fieldset-title">土壤湿度（%）</div>
            <div class="form-row">
              ${field({ label: "下限", name: "moistureMin", type: "number", value: t.moistureMin, min: 0, max: 100, step: "1", iconName: "droplet" })}
              ${field({ label: "上限", name: "moistureMax", type: "number", value: t.moistureMax, min: 0, max: 100, step: "1", iconName: "droplet" })}
            </div>
            <div class="fieldset-title">土壤温度（℃）</div>
            <div class="form-row">
              ${field({ label: "下限", name: "tempMin", type: "number", value: t.tempMin, min: -10, max: 60, step: "0.5", iconName: "thermometer" })}
              ${field({ label: "上限", name: "tempMax", type: "number", value: t.tempMax, min: -10, max: 60, step: "0.5", iconName: "thermometer" })}
            </div>
            <div class="fieldset-title">光照（lx）</div>
            <div class="form-row">
              ${field({ label: "下限", name: "luxMin", type: "number", value: t.luxMin, min: 0, step: "50", iconName: "sun" })}
              ${field({ label: "上限", name: "luxMax", type: "number", value: t.luxMax, min: 0, step: "500", iconName: "sun" })}
            </div>
            <div class="field__hint" style="margin-top:-6px">光照阈值只在 06:00–20:00 判定，夜间不因低于下限而告警。</div>
            <div class="switch-row">
              <span><b>启用阈值告警</b><small>关闭后仍记录读数，只是不生成告警</small></span>
              <label class="switch"><input type="checkbox" name="alarm" ${t.alarm ? "checked" : ""} aria-label="启用阈值告警"><i></i></label>
            </div>
            <button class="btn" type="submit">${icon("check", { size: 15 })}保存阈值</button>
          </form>
          ${deviceAlerts.length ? `<div class="note" style="border-style:solid;background:var(--coral-soft);border-color:var(--pink-mist)">${icon("alert", { size: 14 })}<span>当前有 ${deviceAlerts.length} 条待处理告警，可在<a href="#/alerts" style="color:var(--danger);text-decoration:underline">告警记录</a>确认。</span></div>` : ""}
        </div>
      </section>
    </div>

    <div class="grid-2" style="margin-top:16px">
      <section class="card" aria-labelledby="dd-recent-title">
        <div class="card__head">
          <div><h2 id="dd-recent-title">最近读数</h2><p>最新 ${Math.min(12, readings.length)} 条 · 每 10 秒上报后按 10 分钟归档</p></div>
          <div class="card__actions"><span class="badge badge--plain">${readings.length} 条缓存</span></div>
        </div>
        <div class="card__body card__body--flush">
          ${readings.length ? `<div class="table-wrap"><table class="table" style="min-width:560px">
            <thead><tr><th>时间</th><th class="num">土壤湿度</th><th class="num">土壤温度</th><th class="num">光照</th><th>状态</th></tr></thead>
            <tbody>${readings.slice(-12).reverse().map((r) => `<tr>
              <td class="mono">${dateTime(r.created_at).slice(5, 16)}</td>
              <td class="num">${r.soil_moisture != null ? `${r.soil_moisture.toFixed(1)}%` : "—"}</td>
              <td class="num">${r.soil_temp != null ? `${r.soil_temp.toFixed(1)}℃` : "—"}</td>
              <td class="num">${r.light_lux != null ? `${num(r.light_lux)} lx` : "无读数"}</td>
              <td>${rowStatus(r, t)}</td>
            </tr>`).join("")}</tbody>
          </table></div>` : `<div class="empty">${icon("history", { size: 28 })}<b>还没有读数</b><p>固件第一次上报后会在这里出现。</p></div>`}
        </div>
      </section>

      <div class="stack">
        <section class="card" aria-labelledby="dd-cal-title">
          <div class="card__head">
            <div><h2 id="dd-cal-title">土壤湿度标定</h2><p>两点标定：全干 airRaw、全湿 waterRaw</p></div>
          </div>
          <div class="card__body">
            <div class="cal-grid">
              <div class="cal-card"><small>全干 airRaw</small><b>${num(device.calibration.airRaw)}</b></div>
              <div class="cal-card"><small>全湿 waterRaw</small><b>${num(device.calibration.waterRaw)}</b></div>
            </div>
            <div style="margin-top:10px;color:var(--muted);font-size:11.5px">
              当前读数反推原始值约 <b style="color:var(--ink);font-variant-numeric:tabular-nums">${latest?.soil_moisture != null ? num(device.calibration.airRaw - latest.soil_moisture * (device.calibration.airRaw - device.calibration.waterRaw) / 100) : "—"}</b>
              <span style="color:var(--muted-2)">（airRaw − 湿度% × (airRaw − waterRaw) ÷ 100）</span>
            </div>
            <ol class="steps" style="margin-top:12px">
              <li>探针悬空放空气中，串口输入 <code>adc</code> 看读数是否稳定，再输入 <code>cal air</code>。</li>
              <li>探针插入水中（别淹到电路板），输入 <code>cal water</code>。</li>
              <li>输入 <code>cal show</code> 确认；标定值写入 NVS，断电不丢。</li>
              <li>把串口读到的两个值记录在这里，方便换板或排查时对照。</li>
            </ol>
            <form id="dd-cal-form" style="display:grid;gap:10px;margin-top:12px">
              <div class="form-row">
                ${field({ label: "airRaw 记录值", name: "airRaw", type: "number", value: device.calibration.airRaw, min: 0, max: 4095, step: "1" })}
                ${field({ label: "waterRaw 记录值", name: "waterRaw", type: "number", value: device.calibration.waterRaw, min: 0, max: 4095, step: "1" })}
              </div>
              <button class="btn btn--ghost" type="submit">${icon("wrench", { size: 15 })}保存标定记录</button>
              <div class="field__hint">后台只保存记录，不会把值下发到设备；设备端以串口命令写入的 NVS 为准。</div>
            </form>
          </div>
        </section>

        <section class="card" aria-labelledby="dd-proto-title">
          <div class="card__head"><div><h2 id="dd-proto-title">上报协议</h2><p>固件 <code>postReading()</code> 每 10 秒调用</p></div></div>
          <div class="card__body">
            <div class="mono" style="font-family:var(--font-mono);font-size:11px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;overflow-x:auto;white-space:pre;line-height:1.7">POST /api/devices/${esc(device.code)}/readings
Content-Type: application/json

{
  "soil_moisture": ${latest?.soil_moisture ?? 0},
  "soil_temp": ${latest?.soil_temp ?? 0},
  "light_lux": ${latest?.light_lux == null ? "null" : latest.light_lux},
  "firmware": "${esc(device.firmware || "0.4.0")}",
  "ip_address": "${esc(device.ip_address || "")}"
}</div>
            <div class="field__hint" style="margin-top:8px">成功判定 200 / 201；其他状态码会让板载 LED 急闪三下。WiFi 未连接时跳过本次上报。</div>
          </div>
        </section>
      </div>
    </div>`;

  paintChart(root, device);

  root.querySelectorAll("[data-metric]").forEach((btn) => {
    btn.addEventListener("click", () => {
      metric = btn.dataset.metric;
      root.querySelectorAll("[data-metric]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      const note = root.querySelector("#dd-chart-note");
      note.textContent = `${METRICS[metric].label}${metric === "moisture" ? " · 阴影为阈值区间" : ""}`;
      paintChart(root, device);
    });
  });

  root.querySelector("#dd-threshold-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const next = {
      moistureMin: Number(data.moistureMin),
      moistureMax: Number(data.moistureMax),
      tempMin: Number(data.tempMin),
      tempMax: Number(data.tempMax),
      luxMin: Number(data.luxMin),
      luxMax: Number(data.luxMax),
      alarm: data.alarm === "on",
    };
    if (next.moistureMin >= next.moistureMax || next.tempMin >= next.tempMax || next.luxMin >= next.luxMax) {
      toast("下限必须小于上限", "error");
      return;
    }
    try {
      await saveDevice(device.code, { thresholds: next });
      toast("阈值已保存");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  root.querySelector("#dd-cal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const airRaw = Number(data.airRaw);
    const waterRaw = Number(data.waterRaw);
    if (airRaw <= waterRaw) {
      toast("airRaw 应大于 waterRaw（干燥时 ADC 读数更高）", "error");
      return;
    }
    try {
      await saveDevice(device.code, { calibration: { ...device.calibration, airRaw, waterRaw, source: "后台记录" } });
      toast("标定记录已保存");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  root.querySelector("#dd-edit").addEventListener("click", () => openEdit(device));
  root.querySelector("#dd-export").addEventListener("click", () => {
    if (!readings.length) {
      toast("还没有可导出的读数", "error");
      return;
    }
    downloadCsv(`${device.code}-readings.csv`, [
      ["时间", "土壤湿度(%)", "土壤温度(℃)", "光照(lx)", "固件", "IP"],
      ...readings.map((r) => [dateTime(r.created_at), r.soil_moisture ?? "", r.soil_temp ?? "", r.light_lux ?? "", r.firmware || "", r.ip_address || ""]),
    ]);
    toast("读数已导出为 CSV");
  });
  root.querySelector("#dd-refresh").addEventListener("click", () => {
    refreshView();
  });
}

function paintChart(root, device) {
  const mount = root.querySelector("#dd-chart");
  if (!mount) return;
  const m = METRICS[metric];
  const readings = (device.readings || []).filter((r) => Date.now() - new Date(r.created_at) < 24 * 3600 * 1000);
  if (!readings.length) {
    mount.innerHTML = `<div class="empty" style="padding:36px 10px">${icon("history", { size: 28 })}<b>近 24 小时没有读数</b></div>`;
    return;
  }
  const t = device.thresholds;
  const band = metric === "moisture" ? { from: t.moistureMin, to: t.moistureMax } : metric === "temp" ? { from: t.tempMin, to: t.tempMax } : null;
  const values = readings.map((r) => r[m.field]);
  if (metric === "lux" && values.every((v) => v == null)) {
    mount.innerHTML = `<div class="empty" style="padding:36px 10px">${icon("sun", { size: 28 })}<b>光照传感器无读数</b><p>BH1750 未接入或读取失败时，固件上报 light_lux 为 null。</p></div>`;
    return;
  }
  const max = metric === "lux" ? Math.max(1000, ...values.filter((v) => v != null)) : undefined;
  mount.innerHTML = chart({
    labels: readings.map((r) => r.created_at),
    series: [{
      name: m.label,
      values,
      color: m.color,
      format: (v) => `${Number(v).toFixed(m.digits)}${m.unit}`,
    }],
    height: 236,
    yMin: metric === "temp" ? Math.min(0, ...values.filter((v) => v != null)) : 0,
    yMax: max,
    band,
    unit: "",
    ariaLabel: `${device.name} 近 24 小时${m.label}曲线`,
    xFormat: (label) => timeOnly(label),
    xTickCount: 7,
  });
  hydrateCharts(mount);
}

function sensorTile(label, iconName, value, unit, digits, min, max, history, abnormal, missing = false, night = false, color = VIZ.leaf) {
  const clean = history.filter((v) => v != null);
  const lo = clean.length ? Math.min(...clean) : null;
  const hi = clean.length ? Math.max(...clean) : null;
  return `<div class="sensor-tile">
    <div class="sensor-tile__head">${icon(iconName, { size: 15 })}${label}
      ${missing ? badge("传感器无读数", "warn") : night ? badge("夜间不判定", "plain") : abnormal ? badge("超出阈值", "danger") : badge("阈值内", "ok")}
    </div>
    <div class="sensor-tile__value">${value == null ? "—" : Number(value).toFixed(digits)}<small>${unit}</small></div>
    <div class="sensor-tile__meta">目标 ${num(min)}–${num(max)} ${unit}${lo != null ? ` · 24h ${Number(lo).toFixed(digits)}–${Number(hi).toFixed(digits)}` : ""}</div>
    <div style="margin-top:8px">${missing ? `<span style="font-size:10.5px;color:var(--muted-2)">BH1750 未接入或读取失败，固件上报 null</span>` : sparkline(history, { low: abnormal, color })}</div>
  </div>`;
}

const daylightNow = () => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20;
};

/* 24 小时统计卡：每个传感器的最低 / 平均 / 最高，null 读数单独计数。 */
function summaryCard(rows) {
  const specs = [
    { key: "soil_moisture", label: "土壤湿度", unit: "%", digits: 1, iconName: "droplet" },
    { key: "soil_temp", label: "土壤温度", unit: "℃", digits: 1, iconName: "thermometer" },
    { key: "light_lux", label: "光照", unit: " lx", digits: 0, iconName: "sun" },
  ];

  const stat = (key, digits) => {
    const values = rows.map((r) => r[key]).filter((v) => v != null && Number.isFinite(v));
    if (!values.length) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    return { min, max, avg, count: values.length, digits };
  };

  const body = specs.map((spec) => {
    const s = stat(spec.key, spec.digits);
    const missing = rows.length - rows.filter((r) => r[spec.key] != null).length;
    return `<div class="sum-row">
      <span class="sum-row__label">${icon(spec.iconName, { size: 14 })}${spec.label}</span>
      ${s ? `<span class="sum-row__cells">
        <b>${s.min.toFixed(spec.digits)}</b>
        <b>${s.avg.toFixed(spec.digits)}</b>
        <b>${s.max.toFixed(spec.digits)}</b>
      </span>
      <span class="sum-row__unit">${spec.unit.trim()}</span>` : `<span class="sum-row__empty">近 24 小时无读数</span>`}
      ${missing && s ? `<span class="sum-row__gap">${missing} 条缺失</span>` : ""}
    </div>`;
  }).join("");

  return `<section class="card" aria-labelledby="dd-sum-title">
    <div class="card__head">
      <div><h2 id="dd-sum-title">24 小时统计</h2><p>共 ${rows.length} 个采样点 · 最低 / 平均 / 最高</p></div>
    </div>
    <div class="card__body">
      ${rows.length ? `<div class="sum-list">
        <div class="sum-row sum-row--head">
          <span class="sum-row__label">传感器</span>
          <span class="sum-row__cells"><small>最低</small><small>平均</small><small>最高</small></span>
          <span class="sum-row__unit">单位</span>
        </div>
        ${body}
      </div>` : `<div class="empty" style="padding:26px 10px">${icon("history", { size: 26 })}<b>近 24 小时没有读数</b><p>设备上报后这里会按传感器汇总。</p></div>`}
    </div>
  </section>`;
}

function rowStatus(reading, t) {
  if (reading.soil_moisture != null && reading.soil_moisture < t.moistureMin) return badge("湿度偏低", "danger");
  if (reading.light_lux == null) return badge("光照无读数", "warn");
  if (reading.soil_temp != null && (reading.soil_temp < t.tempMin || reading.soil_temp > t.tempMax)) return badge("土温越界", "warn");
  return badge("正常", "ok");
}

function openEdit(device) {
  const { close } = openModal({
    title: "编辑设备档案",
    subtitle: "只修改后台显示信息，不改动固件配置。",
    body: `<form id="dd-edit-form" style="display:grid;gap:12px">
      <div class="field"><label for="e-code">设备编号</label><input class="input" id="e-code" value="${esc(device.code)}" disabled></div>
      <div class="field"><label for="e-name">显示名称</label><input class="input" id="e-name" name="name" value="${esc(device.name)}" required></div>
      <div class="field"><label for="e-loc">摆放位置</label><input class="input" id="e-loc" name="location" value="${esc(device.location || "")}"></div>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-close>取消</button><button class="btn" type="submit" form="dd-edit-form">保存</button>`,
    onMount(dialog) {
      dialog.querySelector("#dd-edit-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
          await saveDevice(device.code, { name: data.name.trim(), location: data.location.trim() });
          close();
          toast("设备档案已更新");
        } catch (error) {
          toast(error.message, "error");
        }
      });
    },
  });
}
