import { VIZ } from "./geometry";

export type RingGaugeProps = {
  value: number;
  max: number;
  label: string;
  ariaLabel?: string;
  color?: string;
  size?: number;
  caption?: string;
};

/**
 * Circular progress: one ratio, read at a glance. Ported from `ringGauge()`
 * in the legacy charts.
 */
export function RingGauge({
  value,
  max,
  label,
  ariaLabel,
  color = VIZ.leaf,
  size = 104,
  caption = "",
}: RingGaugeProps): JSX.Element {
  const ratio = max ? Math.min(1, Math.max(0, value / max)) : 0;
  const pct = Math.round(ratio * 100);
  const r = 44;

  return (
    <div
      className="ring"
      style={{ width: `${size}px` }}
      role="img"
      aria-label={ariaLabel ?? `${label} ${value}/${max}，${pct}%`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring__track" cx="50" cy="50" r={r} strokeWidth="9" />
        <circle
          className="ring__arc"
          cx="50"
          cy="50"
          r={r}
          pathLength="100"
          stroke={color}
          strokeWidth="9"
          strokeDasharray={`${pct.toFixed(2)} 100`}
          strokeDashoffset={pct.toFixed(2)}
          transform="rotate(-90 50 50)"
          style={{ "--len": pct.toFixed(2) } as React.CSSProperties}
        />
      </svg>
      <div className="ring__center">
        <b>{pct}%</b>
        <small>{caption}</small>
      </div>
    </div>
  );
}
