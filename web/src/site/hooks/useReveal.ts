import { useEffect } from "react";

/**
 * Section entrances, ported from the final block of `legacy/assets/app.js`.
 *
 * Runs after paint so prerendered HTML matches the client markup: `.reveal`
 * elements start without `in` (CSS only hides them when `html.js` is present)
 * and the observer adds it as each one scrolls in. Reduced-motion users are
 * handled by the CSS media query, not here — same as the legacy page.
 */
export function useReveal(): void {
  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

    if (!("IntersectionObserver" in window)) {
      reveals.forEach((element) => element.classList.add("in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const element = entry.target as HTMLElement;
          const scope = element.closest("section, footer") || document.body;
          const group = Array.from(scope.querySelectorAll<HTMLElement>(".reveal"));
          const index = Math.max(0, group.indexOf(element));
          element.style.transitionDelay = `${Math.min(index * 55, 260)}ms`;
          element.classList.add("in");
          observer.unobserve(element);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );

    reveals.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}