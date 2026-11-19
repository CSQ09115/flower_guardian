/* Hand-rolled SVG charts: no library, no runtime dependency.
   Each chart ships an aria-label and a hover tooltip; the data table stays in the view.

   Palette: mint-white, leaf green, rose. Deep leaf carries the money series,
   rose the comparison and the peak, the lighter greens and pinks give
   categories somewhere to sit without leaving the garden. */

import { esc } from "./util.js";

export const VIZ = {
  leaf: "#2c7a56",
  coral: "#d95f82",
  green: "#3fa274",
  pink: "#ef8fa8",
  mist: "#bfe3cd",
  stone: "#93a89c",
};

/* Order-status semantics: rose for waiting, mint for acknowledged, leaf for
   movement and completion, stone for cancelled. */
export const STATUS_COLOR = {
  pending: VIZ.pink,
  confirmed: VIZ.mist,
  shipped: VIZ.green,
  completed: VIZ.leaf,
  cancelled: VIZ.stone,
};

let uid = 0;
const nextId = () => `viz${++uid}`;

/* Phone charts get a narrower viewBox so 10px axis labels stay legible when
   the card is only ~330px wide. The hover geometry is encoded with the chart. */
const isCompact = () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;

const encode = (obj) => btoa(encodeURIComponent(JSON.stringify(obj)));
const decode = (str) => JSON.parse(decodeURIComponent(atob(str)));

const scale = (value, min, max, a, b) => (max === min ? (a + b) / 2 : a + ((value - min) / (max - min)) * (b - a));

function niceTicks(min, max, count = 4) {
  if (min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/* Monotone cubic interpolation: a smooth line that never overshoots the data,
   so a sales curve cannot invent a peak between two readings. */
function smoothPath(points) {
  if (points.length < 2) return points.length ? `M${points[0][0]} ${points[0][1]}` : "";

  const n = points.length;
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1][0] - points[i][0];
    slope[i] = dx[i] === 0 ? 0 : (points[i + 1][1] - points[i][1]) / dx[i];
  }

  const tangent = new Array(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) tangent[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }

  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(points[i][0] + h).toFixed(1)} ${(points[i][1] + tangent[i] * h).toFixed(1)}` +
      ` ${(points[i + 1][0] - h).toFixed(1)} ${(points[i + 1][1] - tangent[i + 1] * h).toFixed(1)}` +
      ` ${points[i + 1][0].toFixed(1)} ${points[i + 1][1].toFixed(1)}`;
  }
  return d;
}

export function chart(config) {
  const {
    labels = [],
    series = [],
    height = 210,
    yMin = 0,
    yMax,
    yTicks = 4,
    format = (v) => String(Math.round(v)),
    xFormat = (label) => String(label),
    band = null,
    area = true,
    smooth = true,
    unit = "",
    ariaLabel = "趋势图",
    xTickCount = 6,
  } = config;

  const W = isCompact() ? 380 : 720;
  const H = height;
  const pad = isCompact() ? { l: 38, r: 10, t: 16, b: 28 } : { l: 44, r: 14, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const values = series.flatMap((s) => s.values.filter((v) => v != null && Number.isFinite(v)));
  const rawMin = yMin !== null ? yMin : Math.min(...values, 0);
  const rawMax = yMax !== null && yMax !== undefined ? yMax : Math.max(...values, 1);
  const domainMin = Math.min(rawMin, band ? band.from : Infinity);
  const domainMax = Math.max(rawMax, band ? band.to : -Infinity);
  const ticks = niceTicks(domainMin, domainMax, yTicks);
  const min = Math.min(...ticks);
  const max = Math.max(...ticks);
  const y = (v) => scale(v, min, max, pad.t + ih, pad.t);
  const x = (i) => scale(i, 0, Math.max(1, labels.length - 1), pad.l, pad.l + iw);

  const grid = ticks.map((tick) => {
    const ty = y(tick);
    return `<line class="chart__grid" x1="${pad.l}" y1="${ty.toFixed(1)}" x2="${(pad.l + iw).toFixed(1)}" y2="${ty.toFixed(1)}"/>
      <text class="chart__axis" x="${pad.l - 8}" y="${(ty + 3).toFixed(1)}" text-anchor="end">${esc(format(tick))}</text>`;
  }).join("");

  /* Phones get fewer ticks so the 11px labels never collide after scaling. */
  const tickBudget = Math.max(2, isCompact() ? 4 : xTickCount);
  const step = Math.max(1, Math.ceil(Math.max(1, labels.length - 1) / (tickBudget - 1)));
  const xLabels = labels.map((label, i) => {
    if (i % step !== 0 && i !== labels.length - 1) return "";
    if (i !== 0 && i !== labels.length - 1 && labels.length - 1 - i < step / 2) return "";
    return `<text class="chart__axis" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}">${esc(xFormat(label))}</text>`;
  }).join("");

  const bandMarkup = band
    ? `<rect class="chart__band" x="${pad.l}" y="${y(band.to).toFixed(1)}" width="${iw}" height="${Math.max(0, y(band.from) - y(band.to)).toFixed(1)}"/>
       <line class="chart__band-line" x1="${pad.l}" y1="${y(band.from).toFixed(1)}" x2="${pad.l + iw}" y2="${y(band.from).toFixed(1)}"/>
       <line class="chart__band-line" x1="${pad.l}" y1="${y(band.to).toFixed(1)}" x2="${pad.l + iw}" y2="${y(band.to).toFixed(1)}"/>`
    : "";

  const defs = [];
  const paths = series.map((s, si) => {
    const points = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    const line = smooth ? smoothPath(points) : points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const areaPath = points.length
      ? `${line} L${points[points.length - 1][0].toFixed(1)} ${(pad.t + ih).toFixed(1)} L${points[0][0].toFixed(1)} ${(pad.t + ih).toFixed(1)} Z`
      : "";
    const gid = nextId();
    if (area && s.area !== false) {
      defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.color}" stop-opacity=".28"/>
        <stop offset="72%" stop-color="${s.color}" stop-opacity=".05"/>
        <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>
      </linearGradient>`);
    }
    return `${area && s.area !== false ? `<path d="${areaPath}" fill="url(#${gid})" class="chart__area"/>` : ""}
      <path d="${line}" class="chart__line" data-draw="1" stroke="${s.color}"${s.dashed ? ' stroke-dasharray="5 5"' : ""}${s.width ? ` stroke-width="${s.width}"` : ""}/>
      <g data-series="${si}" opacity="0">${points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 60)) === 0).map((p) => `<circle class="chart__dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="0"/>`).join("")}</g>`;
  }).join("");

  const hover = {
    labels,
    series: series.map((s) => ({
      name: s.name,
      /* Functions do not survive JSON in data-*, so the tooltip receives the
         already formatted strings. */
      values: s.values.map((v) => (v == null ? null : s.format ? String(s.format(v)) : v)),
      points: s.values.map((v) => (v == null ? null : Number(y(v).toFixed(1)))),
      color: s.color,
    })),
    unit,
    band: band ? { from: band.from, to: band.to, label: band.label } : null,
    w: W,
    pad,
  };

  return `<div class="chart${isCompact() ? " is-compact" : ""}" data-chart="${encode(hover)}" data-format="${encode({ unit })}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">
      <defs>${defs.join("")}</defs>
      ${bandMarkup}
      ${grid}
      ${xLabels}
      ${paths}
      <g class="chart__hover" opacity="0">
        <line class="chart__cursor" x1="0" y1="${pad.t}" x2="0" y2="${pad.t + ih}"/>
        <g class="chart__hover-dots"></g>
      </g>
      <rect class="chart__hit" x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}"></rect>
    </svg>
    <div class="chart-tip" hidden></div>
  </div>`;
}

export function hydrateCharts(root = document) {
  drawLines(root);

  root.querySelectorAll("[data-chart]").forEach((box) => {
    if (box.dataset.bound) return;
    box.dataset.bound = "1";
    const data = decode(box.dataset.chart);
    const svg = box.querySelector("svg");
    const tip = box.querySelector(".chart-tip");
    const hover = box.querySelector(".chart__hover");
    const cursor = box.querySelector(".chart__cursor");
    const dots = box.querySelector(".chart__hover-dots");
    const hit = box.querySelector(".chart__hit");
    if (!hit) return;

    const W = data.w || 720;
    const pad = data.pad || { l: 44, r: 14, t: 16, b: 28 };
    const iw = W - pad.l - pad.r;

    const show = (event) => {
      const rect = svg.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * W;
      const ratio = Math.min(1, Math.max(0, (px - pad.l) / iw));
      const index = Math.round(ratio * (data.labels.length - 1));
      const viewX = pad.l + ratio * iw;
      cursor.setAttribute("x1", viewX);
      cursor.setAttribute("x2", viewX);
      hover.setAttribute("opacity", "1");

      const rows = data.series.map((s) => {
        const value = s.values[index];
        /* values arrive preformatted from chart(); data-chart is JSON. */
        return `<span><i style="background:${s.color}"></i>${esc(s.name)} ${value == null ? "无读数" : esc(String(value))}${esc(data.unit)}</span>`;
      }).join("");

      dots.innerHTML = data.series.map((s) => {
        const yPix = s.points[index];
        if (yPix == null) return "";
        return `<circle cx="${viewX.toFixed(1)}" cy="${yPix}" r="3.4" fill="${s.color}" stroke="#fff" stroke-width="1.6"/>`;
      }).join("");

      const label = data.labels[index];
      tip.innerHTML = `<b>${esc(String(label))}</b>${rows}`;
      tip.hidden = false;
      const pxActual = (viewX / W) * rect.width;
      const boxRect = box.getBoundingClientRect();
      tip.style.left = `${Math.min(rect.width - 76, Math.max(76, pxActual))}px`;
      tip.style.top = `${Math.max(46, Math.min(boxRect.height - 10, event.clientY - boxRect.top - 10))}px`;
    };

    const hide = () => {
      hover.setAttribute("opacity", "0");
      tip.hidden = true;
    };

    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerleave", hide);
    hit.addEventListener("pointerdown", show);
  });
}

/* Line drawings: measure each path, then hand it to the CSS draw transition.
   Under reduced motion the path is simply shown. */
function drawLines(root) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll("path[data-draw]").forEach((path, index) => {
    if (path.dataset.drawn) return;
    path.dataset.drawn = "1";
    if (reduced) return;
    /* A dashed series must keep its own dash pattern; drawing it in would
       replace the pattern with one full-length dash. */
    if (path.getAttribute("stroke-dasharray")) return;
    let length = 0;
    try { length = path.getTotalLength(); } catch (error) { length = 0; }
    if (!length) return;
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.style.transitionDelay = `${index * 70}ms`;
    void path.getBoundingClientRect();
    requestAnimationFrame(() => {
      path.style.transition = "stroke-dashoffset 900ms cubic-bezier(.22,.61,.36,1)";
      path.style.strokeDashoffset = "0";
    });
  });
}

export function sparkline(values, { low = false, color = VIZ.leaf } = {}) {
  const clean = values.filter((v) => v != null && Number.isFinite(v));
  if (clean.length < 2) return `<svg class="sparkline${low ? " is-low" : ""}" viewBox="0 0 92 26" aria-hidden="true"></svg>`;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const pts = clean.map((v, i) => [
    (i / (clean.length - 1)) * 90 + 1,
    24 - scale(v, min, max, 0, 22),
  ]);
  const d = smoothPath(pts);
  const stroke = low ? "var(--danger)" : color;
  const gid = nextId();
  return `<svg class="sparkline${low ? " is-low" : ""}" viewBox="0 0 92 26" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${stroke}" stop-opacity=".26"/><stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
    </linearGradient></defs>
    <path class="sparkline__area" d="${d} L91 26 L1 26 Z" fill="url(#${gid})"/>
    <path class="sparkline__line" d="${d}" stroke="${stroke}" data-draw="1"/>
  </svg>`;
}

export function barChart({
  labels, values, height = 190, format = (v) => String(v), xFormat = (l) => String(l),
  ariaLabel = "柱状图", color = VIZ.leaf, colors = null, maxBar = 26,
}) {
  const W = isCompact() ? 380 : 720;
  const H = height;
  const pad = isCompact() ? { l: 38, r: 10, t: 14, b: 28 } : { l: 44, r: 14, t: 14, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(1, ...values);
  const ticks = niceTicks(0, max, 4);
  const top = Math.max(...ticks);
  const y = (v) => scale(v, 0, top, pad.t + ih, pad.t);
  const slot = iw / Math.max(1, values.length);
  const barW = Math.max(3, Math.min(maxBar, slot * 0.56));
  const bars = values.map((v, i) => {
    const bx = pad.l + slot * i + (slot - barW) / 2;
    const by = y(v);
    const fill = colors ? colors[i] : color;
    return `<rect class="chart__bar" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, pad.t + ih - by).toFixed(1)}" rx="${Math.min(4, barW / 3).toFixed(1)}" fill="${fill}" opacity="${v ? ".9" : ".22"}" style="--i:${i}"><title>${esc(labels[i])}: ${esc(format(v))}</title></rect>`;
  }).join("");
  const ticksMarkup = ticks.map((t) => `<line class="chart__grid" x1="${pad.l}" y1="${y(t).toFixed(1)}" x2="${pad.l + iw}" y2="${y(t).toFixed(1)}"/><text class="chart__axis" x="${pad.l - 8}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end">${esc(format(t))}</text>`).join("");
  const step = Math.max(1, Math.ceil(Math.max(1, labels.length - 1) / ((isCompact() ? 4 : 7) - 1)));
  const lastShown = Math.floor((labels.length - 1) / step) * step;
  const showLast = labels.length - 1 - lastShown >= step / 2;
  const xLabels = labels.map((label, i) => {
    const isLast = i === labels.length - 1;
    if (!((i % step === 0 && !(isLast && showLast)) || (isLast && showLast))) return "";
    const x = pad.l + slot * i + slot / 2;
    const anchor = i === 0 ? "start" : isLast ? "end" : "middle";
    const px = i === 0 ? pad.l : isLast ? pad.l + iw : x;
    return `<text class="chart__axis" x="${px.toFixed(1)}" y="${H - 8}" text-anchor="${anchor}">${esc(xFormat(label))}</text>`;
  }).join("");
  return `<div class="chart${isCompact() ? " is-compact" : ""}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">${ticksMarkup}${xLabels}${bars}</svg></div>`;
}

/* Donut with a real centre figure and a legend carrying the same numbers,
   so the ring never hides the data behind colour alone. */
export function donutChart({ items = [], size = 168, thickness = 20, centerValue = "", centerLabel = "", ariaLabel = "构成图" }) {
  const total = items.reduce((s, item) => s + Number(item.value || 0), 0);
  const r = 50 - thickness / 2;
  const circumference = 2 * Math.PI * r;
  let cursor = 0;

  const arcs = items.map((item, i) => {
    const value = Number(item.value || 0);
    if (!total || !value) return "";
    const len = (value / total) * 100;
    const offset = -cursor;
    cursor += len;
    return `<circle class="donut__arc" cx="50" cy="50" r="${r}"
      pathLength="100" stroke="${item.color}" stroke-width="${thickness}"
      stroke-dasharray="${len.toFixed(2)} ${(100 - len + 0.6).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
      style="--i:${i}" transform="rotate(-90 50 50)"><title>${esc(item.label)} ${value}</title></circle>`;
  }).join("");

  const legend = items.map((item) => {
    const value = Number(item.value || 0);
    const share = total ? Math.round((value / total) * 100) : 0;
    return `<li><i style="background:${item.color}"></i><span>${esc(item.label)}</span><b>${value}</b><small>${share}%</small></li>`;
  }).join("");

  return `<div class="donut-wrap">
    <div class="donut" role="img" aria-label="${esc(ariaLabel)}">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="donut__track" cx="50" cy="50" r="${r}" stroke-width="${thickness}"/>
        ${arcs}
      </svg>
      <div class="donut__center"><b>${esc(centerValue)}</b><small>${esc(centerLabel)}</small></div>
    </div>
    <ul class="donut__legend">${legend}</ul>
  </div>`;
}

/* Horizontal ranking: the same numbers as the table it replaces, with length
   doing the comparing. */
export function hbarChart({ rows = [], format = (v) => String(v), meta = null, ariaLabel = "排行图" }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.value || 0)));
  return `<div class="hbar" role="img" aria-label="${esc(ariaLabel)}">
    ${rows.map((row, i) => `
      <div class="hbar__row" style="--i:${i}">
        <div class="hbar__label"><b>${esc(row.label)}</b>${row.sub ? `<small>${esc(row.sub)}</small>` : ""}</div>
        <div class="hbar__track"><i style="--w:${Math.max(3, (Number(row.value || 0) / max) * 100).toFixed(1)}%;background:${row.color || VIZ.leaf}"></i></div>
        <div class="hbar__value"><b>${esc(format(row.value))}</b>${meta ? `<small>${esc(meta(row))}</small>` : ""}</div>
      </div>`).join("")}
  </div>`;
}

/* Circular progress: one ratio, read at a glance. */
export function ringGauge({ value = 0, max = 100, label = "", caption = "", color = VIZ.leaf, size = 104 }) {
  const ratio = max ? Math.min(1, Math.max(0, value / max)) : 0;
  const pct = Math.round(ratio * 100);
  const r = 44;
  return `<div class="ring" style="width:${size}px" role="img" aria-label="${esc(`${label} ${value}/${max}，${pct}%`)}">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle class="ring__track" cx="50" cy="50" r="${r}" stroke-width="9"/>
      <circle class="ring__arc" cx="50" cy="50" r="${r}" pathLength="100" stroke="${color}" stroke-width="9"
        stroke-dasharray="${(pct * 1).toFixed(2)} 100" stroke-dashoffset="${(pct * 1).toFixed(2)}"
        transform="rotate(-90 50 50)" style="--len:${(pct * 1).toFixed(2)}"/>
    </svg>
    <div class="ring__center"><b>${pct}%</b><small>${esc(caption)}</small></div>
  </div>`;
}

/* 24 × N heatmap. Each cell carries its own title; the block has one summary.
   The ramp runs rose (dry) → mint → deep leaf (wet), so a thirsty pot reads as
   pink at a glance while the value stays in the title. */
export function heatmapChart({ rows = [], cols = [], min = 0, max = 100, unit = "", ariaLabel = "热力图", legend = "低 → 高" }) {
  const RAMP = [[248, 211, 221], [191, 227, 205], [44, 122, 86]];
  const mix = (from, to, t) => from.map((v, i) => Math.round(v + (to[i] - v) * t));
  const color = (value) => {
    if (value == null || !Number.isFinite(value)) return "var(--surface-3)";
    const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
    const [from, to, k] = t < 0.5 ? [RAMP[0], RAMP[1], t / 0.5] : [RAMP[1], RAMP[2], (t - 0.5) / 0.5];
    const [r, g, b] = mix(from, to, k);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const colLabels = cols.map((label, i) => `<span style="--i:${i}">${esc(label)}</span>`).join("");
  const body = rows.map((row) => `
    <div class="heat__row">
      <div class="heat__rowlabel"><b>${esc(row.label)}</b>${row.sub ? `<small>${esc(row.sub)}</small>` : ""}</div>
      <div class="heat__cells" style="grid-template-columns:repeat(${cols.length}, minmax(0, 1fr))">
        ${row.values.map((value, i) => `<i style="background:${color(value)};--i:${i}" title="${esc(cols[i])} · ${value == null ? "无读数" : `${Number(value).toFixed(1)}${unit}`}"></i>`).join("")}
      </div>
    </div>`).join("");

  return `<div class="heat" role="img" aria-label="${esc(ariaLabel)}">
    <div class="heat__head"><span></span><div class="heat__cols" style="grid-template-columns:repeat(${cols.length}, minmax(0, 1fr))">${colLabels}</div></div>
    ${body}
    <div class="heat__legend"><span>${esc(legend)}</span><i style="background:${color(min)}"></i><i style="background:${color((min + max) / 2)}"></i><i style="background:${color(max)}"></i><b>${Number(min).toFixed(0)}–${Number(max).toFixed(0)}${esc(unit)}</b></div>
  </div>`;
}