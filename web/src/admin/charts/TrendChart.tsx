import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatValue, niceTicks, scale, smoothPath, useCompact } from "./geometry";
import type { ChartFormat } from "./geometry";

export type TrendSeries = {
  key: string;
  values: (number | null)[];
  color: string;
  label: string;
  dashed?: boolean;
  /** `false` turns the filled area off for this series (the moving average). */
  area?: boolean;
  width?: number;
  /** Per-series tooltip formatting, e.g. `money` or a fixed-decimal formatter. */
  format?: (value: number) => string;
};

export type TrendBand = { from: number; to: number; label?: string };

export type TrendChartProps = {
  labels: string[];
  series: TrendSeries[];
  format?: ChartFormat;
  ariaLabel: string;
  height?: number;
  yMin?: number | null;
  yMax?: number;
  yTicks?: number;
  unit?: string;
  band?: TrendBand | null;
  xFormat?: (label: string) => string;
  xTickCount?: number;
  smooth?: boolean;
  area?: boolean;
};

let uid = 0;
const nextId = (): string => `viz${++uid}`;

type HoverState = { index: number; viewX: number; left: number; top: number };

/**
 * Line chart with an optional threshold band and a hover tooltip.
 *
 * Ported from `chart()` in `legacy/admin/assets/js/charts.js`: the same view
 * box, padding, grid, tick maths, monotone smoothing and tooltip wording. The
 * hover is React state instead of the legacy `pointermove` handler.
 */
export function TrendChart({
  labels,
  series,
  format,
  ariaLabel,
  height = 210,
  yMin = 0,
  yMax,
  yTicks = 4,
  unit = "",
  band = null,
  xFormat = (label) => String(label),
  xTickCount = 6,
  smooth = true,
  area = true,
}: TrendChartProps): JSX.Element {
  const compact = useCompact();
  const W = compact ? 380 : 720;
  const H = height;
  const pad = compact ? { l: 38, r: 10, t: 16, b: 28 } : { l: 44, r: 14, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const [hover, setHover] = useState<HoverState | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  /* One gradient id per series per chart instance: stable across renders and
     unique inside the document, so `url(#id)` always resolves. */
  const gradientIds = useRef<Record<string, string>>({});
  series.forEach((s) => {
    if (!gradientIds.current[s.key]) gradientIds.current[s.key] = nextId();
  });

  const values = series.flatMap((s) =>
    s.values.filter((v): v is number => v != null && Number.isFinite(v)),
  );
  const yMinValue = yMin;
  const rawMin = yMinValue !== null && yMinValue !== undefined ? yMinValue : Math.min(...values, 0);
  const rawMax = yMax !== null && yMax !== undefined ? yMax : Math.max(...values, 1);
  const domainMin = Math.min(rawMin, band ? band.from : Infinity);
  const domainMax = Math.max(rawMax, band ? band.to : -Infinity);
  const ticks = niceTicks(domainMin, domainMax, yTicks);
  const min = Math.min(...ticks);
  const max = Math.max(...ticks);
  const y = (v: number): number => scale(v, min, max, pad.t + ih, pad.t);
  const x = (i: number): number => scale(i, 0, Math.max(1, labels.length - 1), pad.l, pad.l + iw);

  /* Phones get fewer ticks so the 11px labels never collide after scaling. */
  const tickBudget = Math.max(2, compact ? 4 : xTickCount);
  const step = Math.max(1, Math.ceil(Math.max(1, labels.length - 1) / (tickBudget - 1)));

  const onPointer = (event: ReactPointerEvent<SVGRectElement>): void => {
    const svg = svgRef.current;
    const box = boxRef.current;
    if (!svg || !box || labels.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = Math.min(1, Math.max(0, (px - pad.l) / iw));
    const index = Math.round(ratio * (labels.length - 1));
    const viewX = pad.l + ratio * iw;
    const pxActual = (viewX / W) * rect.width;
    const boxRect = box.getBoundingClientRect();
    setHover({
      index,
      viewX,
      left: Math.min(rect.width - 76, Math.max(76, pxActual)),
      top: Math.max(46, Math.min(boxRect.height - 10, event.clientY - boxRect.top - 10)),
    });
  };

  const clearHover = (): void => setHover(null);

  /* Line drawing: measure each path, then hand it to the CSS draw transition.
     Under reduced motion the path is simply shown. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path[data-draw]"));
    paths.forEach((path, index) => {
      if (reduced) return;
      /* A dashed series must keep its own dash pattern; drawing it in would
         replace the pattern with one full-length dash. */
      if (path.getAttribute("stroke-dasharray")) return;
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        length = 0;
      }
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
  }, [labels, series]);

  const hoverRows =
    hover === null
      ? []
      : series.map((s) => {
          const value = s.values[hover.index];
          const text =
            value == null ? "无读数" : s.format ? String(s.format(value)) : String(value);
          return { name: s.label, color: s.color, text };
        });

  return (
    <div className={`chart${compact ? " is-compact" : ""}`} ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} ref={svgRef}>
        <defs>
          {series.map((s) =>
            area && s.area !== false ? (
              <linearGradient key={s.key} id={gradientIds.current[s.key]} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity=".28" />
                <stop offset="72%" stopColor={s.color} stopOpacity=".05" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ) : null,
          )}
        </defs>

        {band ? (
          <>
            <rect
              className="chart__band"
              x={pad.l}
              y={y(band.to).toFixed(1)}
              width={iw}
              height={Math.max(0, y(band.from) - y(band.to)).toFixed(1)}
            />
            <line
              className="chart__band-line"
              x1={pad.l}
              y1={y(band.from).toFixed(1)}
              x2={pad.l + iw}
              y2={y(band.from).toFixed(1)}
            />
            <line
              className="chart__band-line"
              x1={pad.l}
              y1={y(band.to).toFixed(1)}
              x2={pad.l + iw}
              y2={y(band.to).toFixed(1)}
            />
          </>
        ) : null}

        {ticks.map((tick) => (
          <g key={`tick-${tick}`}>
            <line
              className="chart__grid"
              x1={pad.l}
              y1={y(tick).toFixed(1)}
              x2={(pad.l + iw).toFixed(1)}
              y2={y(tick).toFixed(1)}
            />
            <text className="chart__axis" x={pad.l - 8} y={(y(tick) + 3).toFixed(1)} textAnchor="end">
              {formatValue(tick, format)}
            </text>
          </g>
        ))}

        {labels.map((label, i) => {
          if (i % step !== 0 && i !== labels.length - 1) return null;
          if (i !== 0 && i !== labels.length - 1 && labels.length - 1 - i < step / 2) return null;
          return (
            <text
              key={`x-${i}`}
              className="chart__axis"
              x={x(i).toFixed(1)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
            >
              {xFormat(label)}
            </text>
          );
        })}

        {series.map((s) => {
          const points = s.values
            .map((v, i): [number, number] | null => (v == null ? null : [x(i), y(v)]))
            .filter((p): p is [number, number] => p !== null);
          const line = smooth
            ? smoothPath(points)
            : points.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
          const areaPath = points.length
            ? `${line} L${points[points.length - 1][0].toFixed(1)} ${(pad.t + ih).toFixed(1)} L${points[0][0].toFixed(1)} ${(pad.t + ih).toFixed(1)} Z`
            : "";
          const gradientId = area && s.area !== false ? gradientIds.current[s.key] : null;
          return (
            <g key={s.key}>
              {gradientId ? (
                <path d={areaPath} fill={`url(#${gradientId})`} className="chart__area" />
              ) : null}
              <path
                d={line}
                className="chart__line"
                data-draw="1"
                stroke={s.color}
                strokeDasharray={s.dashed ? "5 5" : undefined}
                strokeWidth={s.width}
              />
            </g>
          );
        })}

        <g className="chart__hover" opacity={hover ? 1 : 0}>
          <line
            className="chart__cursor"
            x1={hover ? hover.viewX.toFixed(1) : 0}
            y1={pad.t}
            x2={hover ? hover.viewX.toFixed(1) : 0}
            y2={pad.t + ih}
          />
          <g className="chart__hover-dots">
            {hover
              ? series.map((s) => {
                  const value = s.values[hover.index];
                  if (value == null) return null;
                  return (
                    <circle
                      key={`dot-${s.key}`}
                      cx={hover.viewX.toFixed(1)}
                      cy={y(value).toFixed(1)}
                      r="3.4"
                      fill={s.color}
                      stroke="#fff"
                      strokeWidth="1.6"
                    />
                  );
                })
              : null}
          </g>
        </g>

        <rect
          className="chart__hit"
          x={pad.l}
          y={pad.t}
          width={iw}
          height={ih}
          onPointerMove={onPointer}
          onPointerLeave={clearHover}
          onPointerDown={onPointer}
        />
      </svg>

      <div className="chart-tip" hidden={hover === null} style={hover ? { left: `${hover.left}px`, top: `${hover.top}px` } : undefined}>
        {hover !== null ? (
          <>
            <b>{String(labels[hover.index] ?? "")}</b>
            {hoverRows.map((row) => (
              <span key={row.name}>
                <i style={{ background: row.color }} />
                {row.name} {row.text}
                {unit}
              </span>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
