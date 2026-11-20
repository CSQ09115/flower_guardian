import { useEffect, useRef } from "react";
import { scale, smoothPath, VIZ } from "./geometry";

export type SparklineProps = {
  values: (number | null)[];
  color?: string;
  /** `true` paints the sparkline in the danger colour (out of range). */
  low?: boolean;
};

let uid = 0;
const nextId = (): string => `viz${++uid}`;

/**
 * Tiny trend line without axes or hover. Ported from `sparkline()` in
 * `legacy/admin/assets/js/charts.js`; it stays decorative, so it is hidden
 * from assistive technology.
 */
export function Sparkline({ values, color = VIZ.leaf, low = false }: SparklineProps): JSX.Element {
  const pathRef = useRef<SVGPathElement | null>(null);
  const gradientId = `viz-spark-${useRef(nextId()).current}`;

  const clean = values.filter((v): v is number => v != null && Number.isFinite(v));
  const min = clean.length ? Math.min(...clean) : 0;
  const max = clean.length ? Math.max(...clean) : 0;
  const points = clean.map(
    (v, i): [number, number] => [
      (i / Math.max(1, clean.length - 1)) * 90 + 1,
      24 - scale(v, min, max, 0, 22),
    ],
  );
  const d = smoothPath(points);
  const stroke = low ? "var(--danger)" : color;

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let length = 0;
    try {
      length = path.getTotalLength();
    } catch {
      length = 0;
    }
    if (!length) return;
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    void path.getBoundingClientRect();
    requestAnimationFrame(() => {
      path.style.transition = "stroke-dashoffset 900ms cubic-bezier(.22,.61,.36,1)";
      path.style.strokeDashoffset = "0";
    });
  }, [d]);

  if (clean.length < 2) {
    return <svg className={`sparkline${low ? " is-low" : ""}`} viewBox="0 0 92 26" aria-hidden="true" />;
  }

  return (
    <svg className={`sparkline${low ? " is-low" : ""}`} viewBox="0 0 92 26" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity=".26" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="sparkline__area" d={`${d} L91 26 L1 26 Z`} fill={`url(#${gradientId})`} />
      <path ref={pathRef} className="sparkline__line" d={d} stroke={stroke} data-draw="1" />
    </svg>
  );
}
