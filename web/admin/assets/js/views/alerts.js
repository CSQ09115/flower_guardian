import { icon } from "../icons.js";
import { acknowledgeAlert, store } from "../store.js";
import { badge, toast } from "../ui.js";
import { dateTime, esc, num, relative } from "../util.js";

let filter = "open";

const METRIC_LABEL = { soil_moisture: "土壤湿度", soil_temp: "土壤温度", light_lux: "光照", online: "设备连接" };

export async function render(root) {
  const all = store.data.alerts;
  const open = all.filter((a) => !a.acknowledged);
  const today = all.filter((a) => Date.now() - new Date(a.at).getTime() < 86400000);
  const danger = open.filter((a) => a.level === "danger");

  const rows = all
    .filter((a) => (filter === "open" ? !a.acknowledged : filter === "ack" ? a.acknowledged : true))
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <h1>告警记录</h1>
        <p>阈值越界、传感器无读数与设备离线都会落在这一页。确认只代表「已看到」，不会修改设备阈值。</p>
      </div>
      <div class="page-head__actions">
        <a class="btn btn--ghost" href="#/devices">${icon("cpu", { size: 15 })}设备列表</a>
      </div>
    </div>

    <div class="kpis">
      ${kpi("待处理", num(open.length), "需要人工确认", "bell", open.length ? "coral" : "")}
      ${kpi("今日新增", num(today.length), "最近 24 小时", "clock", "mint")}
      ${kpi("高优先级", num(danger.length), "danger 级别", "alert", danger.length ? "pink" : "")}
      ${kpi("已确认", num(all.length - open.length), "累计确认", "check", "mint")}
    </div>

    <section class="card">
      <div class="toolbar">
        <div class="chips" role="group" aria-label="按确认状态筛选">
          <button class="chip${filter === "open" ? " is-active" : ""}" type="button" data-afilter="open">待处理<span class="chip__count">${open.length}</span></button>
          <button class="chip${filter === "ack" ? " is-active" : ""}" type="button" data-afilter="ack">已确认<span class="chip__count">${all.length - open.length}</span></button>
          <button class="chip${filter === "all" ? " is-active" : ""}" type="button" data-afilter="all">全部<span class="chip__count">${all.length}</span></button>
        </div>
        <span style="margin-left:auto;color:var(--muted-2);font-size:11.5px">阈值在设备详情页调整</span>
      </div>
      <div class="card__body card__body--flush" id="alert-body"></div>
    </section>`;

  const body = root.querySelector("#alert-body");
  const paint = () => {
    const current = all
      .filter((a) => (filter === "open" ? !a.acknowledged : filter === "ack" ? a.acknowledged : true))
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    body.innerHTML = current.length ? `<div class="table-wrap"><table class="table" style="min-width:820px">
      <thead><tr><th>时间</th><th>设备</th><th>指标</th><th class="num">读数</th><th class="num">阈值</th><th>级别</th><th>状态</th><th><span class="sr-only">操作</span></th></tr></thead>
      <tbody>${current.map((a) => {
        const device = store.data.devices.find((d) => d.code === a.device_code);
        return `<tr>
          <td class="nowrap"><span class="mono">${dateTime(a.at)}</span><div class="field__hint">${relative(a.at)}</div></td>
          <td><a class="link" href="#/devices/${encodeURIComponent(a.device_code)}">${esc(device?.name || a.device_code)}</a><div class="field__hint">${esc(a.device_code)}</div></td>
          <td>${esc(a.label || METRIC_LABEL[a.metric] || a.metric)}<div class="field__hint">${esc(a.hint || "")}</div></td>
          <td class="num strong">${a.value == null ? "—" : metricValue(a)}</td>
          <td class="num">${a.metric === "online" ? `${num(a.threshold)} 秒` : a.value == null ? "—" : metricValue({ ...a, value: a.threshold })}</td>
          <td>${badge(a.level === "danger" ? "高" : "中", a.level === "danger" ? "danger" : "warn")}</td>
          <td>${a.acknowledged ? badge("已确认", "ok") : badge("待处理", "warn")}</td>
          <td class="nowrap">${a.acknowledged ? "" : `<button class="btn btn--ghost btn--sm" type="button" data-ack="${a.id}">${icon("check", { size: 13 })}确认</button>`}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>` : `<div class="empty">${icon("check", { size: 30 })}<b>${filter === "open" ? "没有待处理告警" : "没有匹配的记录"}</b><p>${filter === "open" ? "所有设备最近读数都在阈值内。" : "切换筛选条件再试。"}</p></div>`;

    body.querySelectorAll("[data-ack]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await acknowledgeAlert(Number(btn.dataset.ack));
        } catch (error) {
          btn.disabled = false;
          toast(error.message, "error");
        }
      });
    });
  };

  root.querySelectorAll("[data-afilter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.afilter;
      root.querySelectorAll("[data-afilter]").forEach((b) => b.classList.toggle("is-active", b === btn));
      paint();
    });
  });

  paint();

  function metricValue(a) {
    if (a.metric === "soil_moisture") return `${Number(a.value).toFixed(1)}%`;
    if (a.metric === "soil_temp") return `${Number(a.value).toFixed(1)}℃`;
    if (a.metric === "light_lux") return `${num(a.value)} lx`;
    return String(a.value);
  }
}

function kpi(label, value, meta, iconName, tone = "") {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}">
    <div class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(iconName, { size: 15 })}</span></div>
    <div class="kpi__value">${value}</div>
    <div class="kpi__meta">${meta}</div>
  </div>`;
}
