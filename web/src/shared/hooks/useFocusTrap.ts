import { useEffect } from "react";

/**
 * Same selector the legacy modal used for its Tab cycle (ui.js `openModal`).
 * `[tabindex="-1"]` is excluded on purpose: the dialog itself is the trap
 * boundary, not a stop in the cycle.
 */
const FOCUSABLE = "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])";

/** Legacy focused the first form control, skipping the head close button. */
const INITIAL = "input, select, textarea, button:not(.modal__close)";

function visible(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

/**
 * Traps Tab inside `ref` while `active`, moves focus in on activation and puts it
 * back on the element that was focused before (the trigger button) on exit.
 *
 * The target element needs `tabIndex={-1}` so it can receive focus when the
 * panel contains nothing focusable (Modal does this; the login shell should too).
 * `active=false` is a no-op: no listeners, no focus movement.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const root = ref.current;
    if (!root) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = (): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);

    const initial = Array.from(root.querySelectorAll<HTMLElement>(INITIAL)).find(visible);
    (initial ?? root).focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (!(current instanceof HTMLElement) || !root.contains(current)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && (current === first || current === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (previous && previous.isConnected) previous.focus();
    };
  }, [ref, active]);
}
