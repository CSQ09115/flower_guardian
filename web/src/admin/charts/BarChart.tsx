import { formatValue, niceTicks, scale, useCompact } from "./geometry";
import type { ChartFormat } from "./geometry";
import { VIZ } from "./geometry";

export type BarChartProps = {
  labels: string[];
  values: number[];
  color?: string;
  colors?: string[] | null;
  format?: ChartFormat;
  ariaLabel: string;
  height?: number;
  maxBar?: number;
  xFormat?: (label: string) => string;
};

/**
 * Bar chart. Ported from `barChart()` in `legacy/admin/assets/js/charts.js`:
 * same view box, padding, tick maths, bar width and label placement. The
 * `barGrow` entrance animation already exists in the global admin sheet.
 */
export function BarChart({
  labels,
  values,
  color = VIZ.leaf,
  colors = null,
  format,
  ariaLabel,
  height = 190,
  maxBar = 26,
  xFormat = (label) => String(label),
}: BarChartProps): JSX.Element {
  const compact = useCompact();
  const W = compact ? 380 : 720;
  const H = height;
  const pad = compact ? { l: 38, r: 10, t: 14, b: 28 } : { l: 44, r: 14, t: 14, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(1, ...values);
  const ticks = niceTicks(0, max, 4);
  const top = Math.max(...ticks);
  const y = (v: number): number => scale(v, 0, top, pad.t + ih, pad.t);
  const slot = iw / Math.max(1, values.length);
  const barW = Math.max(3, Math.min(maxBar, slot * 0.56));

  const step = Math.max(1, Math.ceil(Math.max(1, labels.length - 1) / ((compact ? 4 : 7) - 1)));
  const lastShown = Math.floor((labels.length - 1) / step) * step;
  const showLast = labels.length - 1 - lastShown >= step / 2;

  return (
    <div className={`chart${compact ? " is-compact" : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={`tick-${tick}`}>
            <line
              className="chart__grid"
              x1={pad.l}
              y1={y(tick).toFixed(1)}
              x2={pad.l + iw}
              y2={y(tick).toFixed(1)}
            />
            <text className="chart__axis" x={pad.l - 8} y={(y(tick) + 3).toFixed(1)} textAnchor="end">
              {formatValue(tick, format)}
            </text>
          </g>
        ))}

        {labels.map((label, i) => {
          const isLast = i === labels.length - 1;
          if (!((i % step === 0 && !(isLast && showLast)) || (isLast && showLast))) return null;
          const centre = pad.l + slot * i + slot / 2;
          const anchor = i === 0 ? "start" : isLast ? "end" : "middle";
          const px = i === 0 ? pad.l : isLast ? pad.l + iw : centre;
          return (
            <text
              key={`x-${i}`}
              className="chart__axis"
              x={px.toFixed(1)}
              y={H - 8}
              textAnchor={anchor}
            >
              {xFormat(label)}
            </text>
          );
        })}

        {values.map((value, i) => {
          const bx = pad.l + slot * i + (slot - barW) / 2;
          const by = y(value);
          const fill = colors ? colors[i] : color;
          return (
            <rect
              key={`bar-${i}`}
              className="chart__bar"
              x={bx.toFixed(1)}
              y={by.toFixed(1)}
              width={barW.toFixed(1)}
              height={Math.max(1, pad.t + ih - by).toFixed(1)}
              rx={Math.min(4, barW / 3).toFixed(1)}
              fill={fill}
              opacity={value ? ".9" : ".22"}
              style={{ "--i": i } as React.CSSProperties}
            >
              <title>{`${labels[i] ?? ""}: ${formatValue(value, format)}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
