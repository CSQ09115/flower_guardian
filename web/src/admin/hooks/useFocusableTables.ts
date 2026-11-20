import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Wide tables scroll sideways on phones. A scroll container must be keyboard
 * reachable, so overflowing wrappers become labelled, focusable regions.
 * Ported from `focusableTables()` in the legacy `app.js`.
 */
export function useFocusableTables(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const apply = (): void => {
      root.querySelectorAll<HTMLElement>(".table-wrap").forEach((wrap) => {
        if (wrap.dataset.a11y === "1" || wrap.scrollWidth <= wrap.clientWidth + 1) return;
        wrap.dataset.a11y = "1";
        wrap.tabIndex = 0;
        wrap.setAttribute("role", "region");
        const title = wrap.closest("section")?.querySelector("h2, h3")?.textContent?.trim();
        wrap.setAttribute("aria-label", `${title || "数据表格"}，可横向滚动查看`);
      });
    };

    apply();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(apply);
    observer.observe(root);
    return () => observer.disconnect();
  }, [ref]);
}
