import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AdminIcon } from "../../admin/icons";
import { useFocusTrap } from "../hooks/useFocusTrap";
import styles from "./Modal.module.css";

export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  labelledBy?: string;
  subtitle?: string;
  wide?: boolean;
};

/** Must stay in sync with the exit transition in `admin.css`. */
const EXIT_MS = 190;

type Presence = "closed" | "entering" | "open" | "leaving";

function reducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/* One lock for every open dialog: `padding-right` replaces the scrollbar so the
   page behind the scrim does not jump sideways as it stops scrolling. */
let bodyLocks = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function lockBodyScroll(): () => void {
  const body = document.body;
  if (bodyLocks === 0) {
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) {
      const current = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbar}px`;
    }
  }
  bodyLocks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    bodyLocks = Math.max(0, bodyLocks - 1);
    if (bodyLocks === 0) {
      body.style.overflow = savedOverflow;
      body.style.paddingRight = savedPaddingRight;
    }
  };
}

/**
 * Port of `openModal()` from `legacy/admin/assets/js/ui.js`, minus the `<dialog>`
 * element and the `innerHTML` round-trip.
 *
 * Markup keeps the legacy classes (`.modal-backdrop`, `.modal`, `.modal__head`,
 * `.modal__body`, `.modal__foot`) because the global admin sheet styles exactly
 * those names. The portal target is `#modal-root` when the shell renders one,
 * `document.body` otherwise; host lookup and focus work happen in effects only,
 * so importing this module during the site prerender never touches the DOM.
 */
export function Modal({ open, title, onClose, children, footer, labelledBy, subtitle, wide }: ModalProps): JSX.Element | null {
  const rawId = useId();
  const titleId = `modal-title-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const pressOnBackdrop = useRef(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [presence, setPresence] = useState<Presence>("closed");

  /* Opening mounts into the portal and plays the entrance; closing keeps the
     dialog mounted for one exit. Reopening during that exit jumps straight back
     to the open values, so the animation reverses from wherever it is instead
     of restarting from a hidden state. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      setHost(document.getElementById("modal-root") ?? document.body);
      setPresence((current) =>
        reducedMotion() || current === "open" || current === "leaving" ? "open" : "entering",
      );
    } else {
      setPresence((current) => (current === "closed" ? "closed" : "leaving"));
    }
  }, [open]);

  /* Two frames: the first paints the closed values, the second flips to the
     open ones, giving the transition a start value without a hard-coded timer. */
  useEffect(() => {
    if (presence !== "entering" || typeof window === "undefined") return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setPresence("open"));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [presence]);

  useEffect(() => {
    if (presence !== "leaving" || typeof window === "undefined") return;
    const timer = window.setTimeout(
      () => {
        setPresence("closed");
        setHost(null);
      },
      reducedMotion() ? 0 : EXIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [presence]);

  const mounted = presence !== "closed";

  useEffect(() => {
    if (!mounted || typeof document === "undefined") return;
    return lockBodyScroll();
  }, [mounted]);

  useFocusTrap(dialogRef, open && host !== null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !host) return null;

  return createPortal(
    <div
      className={`modal-backdrop ${styles.backdrop}`}
      data-state={presence}
      onMouseDown={(event) => {
        pressOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressOnBackdrop.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal${wide ? " modal--wide" : ""} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        tabIndex={-1}
      >
        <div className="modal__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn modal__close" aria-label="关闭" onClick={onClose}>
            <AdminIcon name="close" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>,
    host,
  );
}
