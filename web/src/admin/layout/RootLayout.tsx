import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ToastViewport } from "../../shared/components/Toast";
import { useAdminData } from "../data/store";

/**
 * Root layout: the route guard, the outlet and the toast viewport. Everything
 * under `/admin/` except the login screen requires a session; without one the
 * router redirects to `#/login` instead of rendering an empty console.
 *
 * The toast container stays outside the app shell, so it keeps working on the
 * login screen too.
 */
export function RootLayout(): JSX.Element {
  const { toasts, signedIn } = useAdminData();
  const location = useLocation();
  const onLogin = location.pathname === "/login";

  return (
    <>
      {signedIn || onLogin ? <Outlet /> : <Navigate to="/login" replace />}
      <ToastViewport items={toasts} />
    </>
  );
}