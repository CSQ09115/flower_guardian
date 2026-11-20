import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function mediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  try {
    return window.matchMedia(QUERY);
  } catch {
    return null;
  }
}

/**
 * `prefers-reduced-motion: reduce` as a boolean, SSR-safe.
 *
 * The lazy initializer never touches `matchMedia` on the server, so the site
 * prerender can render this hook's consumers (CountUp) without a DOM. The first
 * client render during hydration may differ from the server value, but every
 * consumer renders its final state for both values, so there is nothing to
 * mismatch.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => mediaQuery()?.matches ?? false);

  useEffect(() => {
    const mql = mediaQuery();
    if (!mql) return;
    const onChange = (event: MediaQueryListEvent): void => setReduced(event.matches);
    setReduced(mql.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14 only has the deprecated pair.
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}
