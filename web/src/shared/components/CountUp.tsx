import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export type CountUpFormat = "int" | "money" | "float" | "compact";

/**
 * Port of `animateNumbers()` (legacy `admin/assets/js/ui.js`).
 *
 * The final value is what React renders on the very first pass, so the number is
 * correct without JS and the site prerender never ships "0". The animation then
 * rewrites `textContent` frame by frame (0 → value, cubic ease-out, 680ms) and
 * lands on the exactly-formatted final string. Reduced motion or a missing rAF
 * leaves the rendered value alone.
 *
 * Formats:
 * - `int`   — same as `num(value)`: `zh-CN` grouping, zero fraction digits.
 * - `money` — same as `money(value)`: `¥` + two fraction digits.
 * - `float` — no legacy `data-count-format` used this; KPIs only shipped int and
 *   money. One fraction digit is the smallest rule that keeps sub-unit figures
 *   (e.g. averages) meaningful without borrowing a second rounding policy.
 * - `compact` — same as `compactMoney()`: millions as `M` with two decimals,
 *   ten-thousands as 万 with one decimal, otherwise `money`.
 */
function formatValue(value: number, format: CountUpFormat): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (format === "compact") {
    const abs = Math.abs(safe);
    if (abs >= 1_000_000) return "¥" + (safe / 1_000_000).toFixed(2) + "M";
    if (abs >= 10_000) return "¥" + (safe / 10_000).toFixed(1) + "万";
    return "¥" + safe.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (format === "money") {
    return "¥" + safe.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (format === "float") {
    return safe.toLocaleString("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return safe.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function CountUp(props: {
  value: number;
  format?: CountUpFormat;
  prefix?: string;
  suffix?: string;
  className?: string;
  durationMs?: number;
}): JSX.Element {
  const { value, prefix = "", suffix = "", className, durationMs = 680 } = props;
  const format = props.format ?? "int";
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const finalText = prefix + formatValue(value, format) + suffix;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduced) {
      node.textContent = finalText;
      return;
    }
    if (typeof requestAnimationFrame !== "function" || typeof performance === "undefined") return;

    const target = Number.isFinite(value) ? value : 0;
    const duration = durationMs > 0 ? durationMs : 680;
    const startAt = performance.now();
    let raf = 0;

    const tick = (now: number): void => {
      if (!node.isConnected) {
        raf = 0;
        return;
      }
      const progress = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress < 1) {
        node.textContent = prefix + formatValue(target * eased, format) + suffix;
        raf = requestAnimationFrame(tick);
      } else {
        node.textContent = finalText;
        raf = 0;
      }
    };

    node.textContent = prefix + formatValue(0, format) + suffix;
    raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, format, prefix, suffix, durationMs, reduced, finalText]);

  return (
    <span ref={ref} className={className}>
      {finalText}
    </span>
  );
}
