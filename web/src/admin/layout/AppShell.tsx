import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAdminData } from "../data/store";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useDrawer } from "../hooks/useDrawer";
import { useFocusableTables } from "../hooks/useFocusableTables";
import { routeKeyFromPath } from "../routes";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ViewErrorBoundary } from "./ViewErrorBoundary";

/**
 * The console chrome: sidebar, topbar and the view outlet.
 * Ported from the legacy `app.js` shell (`#app` → `.main` → `#view`).
 */
export function AppShell(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { refresh, toast, logout } = useAdminData();
  const drawer = useDrawer();
  const viewRef = useRef<HTMLElement | null>(null);
  const firstRender = useRef(true);
  const [viewVersion, setViewVersion] = useState(0);

  useDocumentTitle();
  useFocusableTables(viewRef);

  const activeName = routeKeyFromPath(location.pathname);

  /* Route change: scroll to the top (but not on the first paint) and replay the
     entrance animation, like the legacy `render({ scroll: true })`. */
  useEffect(() => {
    const el = viewRef.current;
    if (firstRender.current) {
      firstRender.current = false;
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (!el) return;
    el.classList.remove("is-enter");
    const raf = requestAnimationFrame(() => {
      el.classList.add("is-enter");
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      toast("已同步实时接口数据");
    } catch (error) {
      toast(`同步失败：${(error as Error).message}`, "error");
    }
  }, [refresh, toast]);

  const handleExit = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  return (
    <div className="app">
      <Sidebar
        activeName={activeName}
        sidebarRef={drawer.sidebarRef}
        onConnect={() => {
          void handleRefresh();
        }}
        onExit={handleExit}
      />

      <div className="main">
        <Topbar
          activeName={activeName}
          open={drawer.open}
          onToggle={drawer.toggle}
          onRefresh={() => {
            void handleRefresh();
          }}
          triggerRef={drawer.triggerRef}
        />
        <main className="view" id="view" tabIndex={-1} ref={viewRef}>
          <ViewErrorBoundary>
            <Outlet key={viewVersion} />
          </ViewErrorBoundary>
        </main>
      </div>

      <button
        type="button"
        className="scrim"
        aria-label="关闭导航"
        hidden={!drawer.open}
        onClick={drawer.close}
      />
    </div>
  );
}
