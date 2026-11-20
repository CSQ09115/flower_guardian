import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export type DrawerState = {
  open: boolean;
  toggle: () => void;
  close: () => void;
  sidebarRef: RefObject<HTMLElement>;
  triggerRef: RefObject<HTMLButtonElement>;
};

/**
 * Mobile drawer behaviour, ported from the legacy `app.js`:
 *  - `toggle()` opens the sidebar, expands the menu button and moves focus to
 *    the active nav item;
 *  - `close()` closes it, restores the focus to the menu button and only when
 *    the drawer was actually open;
 *  - while open, the `.main` region is `inert` so Tab cannot wander behind the
 *    scrim;
 *  - Escape closes it, and crossing the 981px breakpoint closes it too.
 */
export function useDrawer(): DrawerState {
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const main = document.querySelector<HTMLElement>(".main");

    if (open) {
      wasOpen.current = true;
      sidebar?.classList.add("is-open");
      if (main) {
        main.inert = true;
        main.setAttribute("inert", "");
      }
      const first =
        sidebar?.querySelector<HTMLElement>(".nav-item.is-active") ??
        sidebar?.querySelector<HTMLElement>(".nav-item");
      first?.focus({ preventScroll: true });
      return;
    }

    sidebar?.classList.remove("is-open");
    if (main) {
      main.inert = false;
      main.removeAttribute("inert");
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(min-width: 981px)");
    const onChange = (event: MediaQueryListEvent): void => {
      if (event.matches) close();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [close]);

  return { open, toggle, close, sidebarRef, triggerRef };
}
