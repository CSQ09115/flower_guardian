export type HeatmapRow = { label: string; sub?: string; cells: (number | null)[] };

export type HeatmapProps = {
  rows: HeatmapRow[];
  cols: string[];
  min: number;
  max: number;
  unit: string;
  ariaLabel?: string;
  legend?: string;
};

/**
 * 24 × N heatmap. Each cell carries its own title; the block has one summary.
 * The ramp runs rose (dry) → mint → deep leaf (wet), so a thirsty pot reads as
 * pink at a glance while the value stays in the title. Ported from
 * `heatmapChart()` in the legacy charts.
 */
export function Heatmap({
  rows,
  cols,
  min,
  max,
  unit,
  ariaLabel = "热力图",
  legend = "低 → 高",
}: HeatmapProps): JSX.Element {
  const RAMP = [
    [248, 211, 221],
    [191, 227, 205],
    [44, 122, 86],
  ];
  const mix = (from: number[], to: number[], t: number): number[] =>
    from.map((v, i) => Math.round(v + (to[i] - v) * t));
  const color = (value: number | null): string => {
    if (value == null || !Number.isFinite(value)) return "var(--surface-3)";
    const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
    const [from, to, k] = t < 0.5 ? [RAMP[0], RAMP[1], t / 0.5] : [RAMP[1], RAMP[2], (t - 0.5) / 0.5];
    const [r, g, b] = mix(from, to, k);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="heat" role="img" aria-label={ariaLabel}>
      <div className="heat__head">
        <span />
        <div className="heat__cols" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map((label, i) => (
            <span key={`col-${i}`} style={{ "--i": i } as React.CSSProperties}>
              {label}
            </span>
          ))}
        </div>
      </div>
      {rows.map((row, ri) => (
        <div className="heat__row" key={`row-${ri}`}>
          <div className="heat__rowlabel">
            <b>{row.label}</b>
            {row.sub ? <small>{row.sub}</small> : null}
          </div>
          <div className="heat__cells" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
            {row.cells.map((value, i) => (
              <i
                key={`cell-${ri}-${i}`}
                style={{ background: color(value), "--i": i } as React.CSSProperties}
                title={`${cols[i] ?? ""} · ${value == null ? "无读数" : `${Number(value).toFixed(1)}${unit}`}`}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="heat__legend">
        <span>{legend}</span>
        <i style={{ background: color(min) }} />
        <i style={{ background: color((min + max) / 2) }} />
        <i style={{ background: color(max) }} />
        <b>{`${Number(min).toFixed(0)}–${Number(max).toFixed(0)}${unit}`}</b>
      </div>
    </div>
  );
}
