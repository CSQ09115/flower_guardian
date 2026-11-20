import { VIZ } from "./geometry";

export type DonutItem = { label: string; value: number; color: string };

export type DonutChartProps = {
  items: DonutItem[];
  /** Optional explicit total; the legacy chart derived it from the items. */
  total?: number;
  centerLabel?: string;
  centerValue?: string;
  ariaLabel?: string;
  size?: number;
  thickness?: number;
};

/**
 * Donut with a real centre figure and a legend carrying the same numbers, so
 * the ring never hides the data behind colour alone. Ported from
 * `donutChart()` in `legacy/admin/assets/js/charts.js`.
 */
export function DonutChart({
  items,
  total,
  centerLabel = "",
  centerValue = "",
  ariaLabel = "构成图",
  size = 168,
  thickness = 20,
}: DonutChartProps): JSX.Element {
  const sum = items.reduce((s, item) => s + Number(item.value || 0), 0);
  const grandTotal = total ?? sum;
  const r = 50 - thickness / 2;
  let cursor = 0;

  const arcs = items.map((item, i) => {
    const value = Number(item.value || 0);
    if (!grandTotal || !value) return null;
    const len = (value / grandTotal) * 100;
    const offset = -cursor;
    cursor += len;
    return (
      <circle
        key={`arc-${i}`}
        className="donut__arc"
        cx="50"
        cy="50"
        r={r}
        pathLength="100"
        stroke={item.color}
        strokeWidth={thickness}
        strokeDasharray={`${len.toFixed(2)} ${(100 - len + 0.6).toFixed(2)}`}
        strokeDashoffset={offset.toFixed(2)}
        style={{ "--i": i } as React.CSSProperties}
        transform="rotate(-90 50 50)"
      >
        <title>{`${item.label} ${value}`}</title>
      </circle>
    );
  });

  return (
    <div className="donut-wrap">
      <div className="donut" role="img" aria-label={ariaLabel} style={{ width: `${size}px` }}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="donut__track" cx="50" cy="50" r={r} strokeWidth={thickness} />
          {arcs}
        </svg>
        <div className="donut__center">
          <b>{centerValue}</b>
          <small>{centerLabel}</small>
        </div>
      </div>
      <ul className="donut__legend">
        {items.map((item, i) => {
          const value = Number(item.value || 0);
          const share = grandTotal ? Math.round((value / grandTotal) * 100) : 0;
          return (
            <li key={`legend-${i}`}>
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
              <b>{value}</b>
              <small>{share}%</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
