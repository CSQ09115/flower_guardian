import type { ReactNode } from "react";

/**
 * Chrome for the login screen. The legacy page replaced the whole console with
 * a two-column `.login` layout and toggled `body.is-login`.
 */
export function LoginShell({ children }: { children: ReactNode }): JSX.Element {
  return <div className="login">{children}</div>;
}
