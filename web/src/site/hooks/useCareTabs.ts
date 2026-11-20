import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MutableRefObject, RefObject } from "react";
import { PLANT_KEYS } from "../data/plants";
import type { PlantKey } from "../data/plants";

/**
 * Roving-tab behaviour for the care card, ported from `selectTab()` and the
 * tablist keydown handler in `legacy/assets/app.js`.
 */
export function useCareTabs(): {
  active: PlantKey;
  select: (key: PlantKey, focus?: boolean) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  tabRefs: MutableRefObject<Record<PlantKey, HTMLButtonElement | null>>;
  panelRef: RefObject<HTMLElement>;
} {
  const [active, setActive] = useState<PlantKey>("pothos");
  const tabRefs = useRef<Record<PlantKey, HTMLButtonElement | null>>({
    pothos: null,
    monstera: null,
    snake: null,
    peace: null,
    aloe: null,
    ivy: null,
  });
  const panelRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  /* Replay the panel entrance animation on every switch after the first paint. */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    panel.classList.remove("is-switch");
    void panel.offsetWidth;
    panel.classList.add("is-switch");
  }, [active]);

  const select = useCallback((key: PlantKey, focus = false): void => {
    setActive(key);
    if (focus) tabRefs.current[key]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      const index = PLANT_KEYS.indexOf(active);
      if (index < 0) return;
      let next: number | null = null;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % PLANT_KEYS.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (index - 1 + PLANT_KEYS.length) % PLANT_KEYS.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = PLANT_KEYS.length - 1;

      if (next === null) return;
      event.preventDefault();
      select(PLANT_KEYS[next], true);
    },
    [active, select],
  );

  return { active, select, onKeyDown, tabRefs, panelRef };
}