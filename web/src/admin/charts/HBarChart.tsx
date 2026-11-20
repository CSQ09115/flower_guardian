import { VIZ } from "./geometry";

export type HBarItem = {
  label: string;
  value: number;
  sub?: string;
  color?: string;
  /** Optional secondary number rendered under the value (e.g. the amount). */
  amount?: number;
};

export type HBarChartProps = {
  items: HBarItem[];
  format?: "money" | "int" | ((value: number) => string);
  ariaLabel?: string;
  max?: number;
  meta?: (row: HBarItem) => string;
};

/**
 * Horizontal ranking: the same numbers as the table it replaces, with length
 * doing the comparing. Ported from `hbarChart()` in the legacy charts.
 */
export function HBarChart({
  items,
  format = "int",
  ariaLabel = "排行图",
  max,
  meta,
}: HBarChartProps): JSX.Element {
  const peak = max ?? Math.max(1, ...items.map((row) => Number(row.value || 0)));
  const text = (value: number): string => {
    if (typeof format === "function") return format(value);
    if (format === "money") {
      return (
        "¥" +
        Number(value || 0).toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }
    return Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div className="hbar" role="img" aria-label={ariaLabel}>
      {items.map((row, i) => (
        <div className="hbar__row" key={`row-${i}`} style={{ "--i": i } as React.CSSProperties}>
          <div className="hbar__label">
            <b>{row.label}</b>
            {row.sub ? <small>{row.sub}</small> : null}
          </div>
          <div className="hbar__track">
            <i
              style={
                {
                  "--w": `${Math.max(3, (Number(row.value || 0) / peak) * 100).toFixed(1)}%`,
                  background: row.color || VIZ.leaf,
                } as React.CSSProperties
              }
            />
          </div>
          <div className="hbar__value">
            <b>{text(Number(row.value || 0))}</b>
            {meta ? <small>{meta(row)}</small> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
