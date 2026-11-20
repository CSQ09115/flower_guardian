import type { ReactNode } from "react";

/** Small status pill. Ported from `badge()` in `legacy/admin/assets/js/ui.js`. */
export function Badge({
  children,
  tone,
  plain,
}: {
  children: ReactNode;
  tone?: string;
  plain?: boolean;
}): JSX.Element {
  return (
    <span className={`badge${tone ? ` badge--${tone}` : ""}${plain ? " badge--plain" : ""}`}>
      {children}
    </span>
  );
}
