import type { ReactNode } from "react";
import { AdminIcon } from "../icons";

/** Empty state block. Ported from `empty()` in `legacy/admin/assets/js/ui.js`. */
export function EmptyState({
  icon,
  title,
  children,
  size = 28,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  size?: number;
}): JSX.Element {
  return (
    <div className="empty">
      <AdminIcon name={icon} size={size} />
      <b>{title}</b>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
