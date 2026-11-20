import { Outlet } from "react-router-dom";
import { ToastViewport } from "../../shared/components/Toast";
import { useAdminData } from "../data/store";

/**
 * Root layout: the outlet plus the toast viewport. The legacy page kept the
 * toast container outside the app shell, so it stays mounted on every route
 * (including the login screen).
 */
export function RootLayout(): JSX.Element {
  const { toasts } = useAdminData();
  return (
    <>
      <Outlet />
      <ToastViewport items={toasts} />
    </>
  );
}
