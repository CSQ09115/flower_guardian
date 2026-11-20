import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Top-navigation state: sticky scroll shadow plus the mobile drawer.
 *
 * Ported from the nav block of `legacy/assets/app.js`. Internal state starts at
 * its resting value so the hook can run during prerender; every browser API is
 * touched inside effects only.
 */
export function useNavScroll(): {
  scrolled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  navRef: RefObject<HTMLElement>;
  linksRef: RefObject<HTMLElement>;
  buttonRef: RefObject<HTMLButtonElement>;
} {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (linksRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  const toggle = useCallback(() => setOpen((value) => !value), []);

  return { scrolled, open, setOpen, toggle, navRef, linksRef, buttonRef };
}