/* 极简 SVG 图表：一个图一个问题，一条序列。
   规则：仅水平网格线（4 条）、无 y 轴线、基线较重、x 轴 6 个标签不旋转、
   折线 2px 直线段、无点标记、单序列无图例、事件用 1px 竖线 + 12px 标签。 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function cssv(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (const s of steps) {
      if (v <= s * mag) return s * mag;
    }
    return 10 * mag;
  }

  function frame(host, opts) {
    const width = host.clientWidth || 700;
    const height = opts.height || 195;
    const pad = { t: 8, r: 10, b: 26, l: 46 };
    const svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      width: width, height: height, role: 'img',
      'aria-label': opts.label || 'chart'
    });
    host.textContent = '';
    host.appendChild(svg);
    const x0 = pad.l, x1 = width - pad.r, y0 = pad.t, y1 = height - pad.b;
    return { svg, width, height, x0, x1, y0, y1 };
  }

  function grid(f, max, ticks, fmt, min) {
    const ink = cssv('--axis-ink', '#6b7280');
    const lines = cssv('--grid', '#f2f2f2');
    const lo = min || 0;
    for (let i = 0; i < ticks; i++) {
      const t = i / (ticks - 1);
      const y = f.y1 - t * (f.y1 - f.y0);
      f.svg.appendChild(el('line', {
        x1: f.x0, x2: f.x1, y1: y, y2: y,
        stroke: i === 0 ? cssv('--control', '#d1d5db') : lines,
        'stroke-width': i === 0 ? 1.5 : 1
      }));
      const label = el('text', {
        x: f.x0 - 8, y: y + 3.5, 'text-anchor': 'end',
        'font-size': 11, fill: ink
      });
      label.textContent = fmt(lo + (max - lo) * t);
      f.svg.appendChild(label);
    }
  }

  function line(host, opts) {
    const f = frame(host, opts);
    const data = opts.values || [];
    const ticks = opts.ticks || 4;
    const max = opts.max || niceMax(Math.max.apply(null, data.concat([1])));
    const min = opts.min || 0;
    const fmt = opts.format || function (v) { return String(Math.round(v * 10) / 10); };
    grid(f, max, ticks, fmt, min);

    const step = data.length > 1 ? (f.x1 - f.x0) / (data.length - 1) : 0;
    const px = i => f.x0 + i * step;
    const py = v => f.y1 - ((v - min) / (max - min)) * (f.y1 - f.y0);

    if (opts.filled) {
      let d = 'M' + px(0) + ',' + f.y1;
      data.forEach((v, i) => { d += 'L' + px(i) + ',' + py(v); });
      d += 'L' + px(data.length - 1) + ',' + f.y1 + 'Z';
      f.svg.appendChild(el('path', { d: d, fill: cssv('--accent-track', '#d6e8e0'), opacity: 0.5 }));
    }

    let d = '';
    data.forEach((v, i) => { d += (i ? 'L' : 'M') + px(i) + ',' + py(v); });
    f.svg.appendChild(el('path', {
      d: d, fill: 'none', stroke: cssv('--chart-1', '#1f7a58'),
      'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));

    const ink = cssv('--axis-ink', '#6b7280');
    (opts.labels || []).forEach((t, i) => {
      const x = f.x0 + (i / ((opts.labels.length - 1) || 1)) * (f.x1 - f.x0);
      const anchor = i === 0 ? 'start' : (i === opts.labels.length - 1 ? 'end' : 'middle');
      const label = el('text', {
        x: x, y: f.y1 + 17, 'text-anchor': anchor, 'font-size': 11, fill: ink
      });
      label.textContent = t;
      f.svg.appendChild(label);
    });

    (opts.annotations || []).forEach(a => {
      const x = f.x0 + (a.at / ((data.length - 1) || 1)) * (f.x1 - f.x0);
      f.svg.appendChild(el('line', {
        x1: x, x2: x, y1: f.y0, y2: f.y1,
        stroke: cssv('--muted', '#5f6672'), 'stroke-width': 1, 'stroke-dasharray': '3 3'
      }));
      const label = el('text', {
        x: x + 4, y: f.y0 + 9, 'font-size': 11, fill: cssv('--muted', '#5f6672')
      });
      label.textContent = a.label;
      f.svg.appendChild(label);
    });
    return f;
  }

  function bars(host, opts) {
    const f = frame(host, opts);
    const data = opts.values || [];
    const max = opts.max || niceMax(Math.max.apply(null, data.concat([1])));
    const fmt = opts.format || function (v) { return String(Math.round(v)); };
    grid(f, max, opts.ticks || 4, fmt);
    const slot = (f.x1 - f.x0) / (data.length || 1);
    const bw = Math.max(2, Math.min(opts.barWidth || 18, slot - 3));
    const silence = opts.mutedFrom === undefined ? data.length : opts.mutedFrom;
    data.forEach((v, i) => {
      if (v === null || v === undefined) return;
      const h = Math.max(0, (v / max) * (f.y1 - f.y0));
      const x = f.x0 + i * slot + (slot - bw) / 2;
      f.svg.appendChild(el('rect', {
        x: x, y: f.y1 - h, width: bw, height: h,
        fill: i >= silence ? cssv('--chart-muted', '#cfd3d6') : cssv('--accent-track', '#d6e8e0')
      }));
    });
    const ink = cssv('--axis-ink', '#6b7280');
    (opts.labels || []).forEach((t, i) => {
      const x = f.x0 + (i / ((opts.labels.length - 1) || 1)) * (f.x1 - f.x0);
      const anchor = i === 0 ? 'start' : (i === opts.labels.length - 1 ? 'end' : 'middle');
      const label = el('text', { x: x, y: f.y1 + 17, 'text-anchor': anchor, 'font-size': 11, fill: ink });
      label.textContent = t;
      f.svg.appendChild(label);
    });
    return f;
  }

  window.Charts = { line: line, bars: bars };
})();
