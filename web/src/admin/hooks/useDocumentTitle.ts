import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { routeKeyFromPath, routeTitle } from "../routes";

/**
 * Keeps `document.title` and the `is-login` body class in sync with the route
 * (legacy `app.js` did both inside `render()`).
 */
export function useDocumentTitle(): void {
  const location = useLocation();

  useEffect(() => {
    const key = routeKeyFromPath(location.pathname);
    document.title =
      key === "login" ? "登录 · 护花使者运营后台" : `${routeTitle(key)} · 护花使者运营后台`;
    document.body.classList.toggle("is-login", key === "login");
  }, [location.pathname]);
}
