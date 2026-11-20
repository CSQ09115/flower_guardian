import { AdminIcon } from "../../admin/icons";

export type ToastTone = "ok" | "error";
export type ToastItem = { id: number; message: string; tone: ToastTone };

/**
 * Pure viewport over the provider's queue (legacy `toast()` + `#toasts`).
 *
 * The global `admin.css` sheet owns `.toasts` / `.toast`; this component only
 * reproduces the legacy markup: icon at 16px, message in a `<span>`, `is-error`
 * for the error tone. Timers (3800ms) and the four-item cap live in the
 * provider, not here.
 */
export function ToastViewport({ items }: { items: ToastItem[] }): JSX.Element {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={item.tone === "error" ? "toast is-error" : "toast"}>
          <AdminIcon name={item.tone === "error" ? "alert" : "check"} size={16} />
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
