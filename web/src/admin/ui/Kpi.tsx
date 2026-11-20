import type { ReactNode } from "react";
import { AdminIcon } from "../icons";
import { Sparkline } from "../charts/Sparkline";
import { VIZ } from "../charts/geometry";
import { CountUp } from "../../shared/components/CountUp";

export type KpiProps = {
  label: string;
  value: string;
  meta: ReactNode;
  icon: string;
  count?: number;
  format?: "int" | "money" | "compact";
  spark?: number[];
  sparkColor?: string;
  tone?: string;
};

/**
 * KPI card. Ported from the `kpi()` helper in
 * `legacy/admin/assets/js/views/overview.js`: the value is count-up animated
 * when a numeric `count` is given, the sparkline sits behind the number.
 */
export function Kpi({
  label,
  value,
  meta,
  icon,
  count,
  format = "int",
  spark,
  sparkColor = VIZ.leaf,
  tone,
}: KpiProps): JSX.Element {
  return (
    <div className={`kpi${tone ? ` kpi--${tone}` : ""}`}>
      <div className="kpi__top">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon">
          <AdminIcon name={icon} size={15} />
        </span>
      </div>
      <div className="kpi__value" data-count={count} data-count-format={format}>
        {count != null ? <CountUp value={count} format={format} /> : value}
      </div>
      {spark && spark.length > 1 ? (
        <span className="kpi__spark">
          <Sparkline values={spark} color={sparkColor} />
        </span>
      ) : null}
      <div className="kpi__meta">{meta}</div>
    </div>
  );
}
