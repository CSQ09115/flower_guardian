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
};

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
export function Modal({ open, title, onClose, children, footer, labelledBy }: ModalProps): JSX.Element | null {
  const rawId = useId();
  const titleId = `modal-title-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const pressOnBackdrop = useRef(false);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      setHost(null);
      return;
    }
    setHost(document.getElementById("modal-root") ?? document.body);
  }, [open]);

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

  if (!open || !host) return null;

  return createPortal(
    <div
      className={`modal-backdrop ${styles.backdrop}`}
      onMouseDown={(event) => {
        pressOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressOnBackdrop.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        tabIndex={-1}
      >
        <div className="modal__head">
          <div>
            <h2 id={titleId}>{title}</h2>
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
