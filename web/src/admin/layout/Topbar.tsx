import { Link } from "react-router-dom";
import { AdminIcon } from "../icons";
import { routeTitle } from "../routes";
import type { RouteKey } from "../routes";
import { useAdminData } from "../data/store";

type TopbarProps = {
  activeName: RouteKey | "login";
  open: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
};

/** Page chrome: menu button, breadcrumb, data-source pill and refresh button. */
export function Topbar({ activeName, open, onToggle, onRefresh, triggerRef }: TopbarProps): JSX.Element {
  const { isDemo } = useAdminData();

  return (
    <header className="topbar">
      <button
        className="icon-btn topbar__menu"
        id="menu-toggle"
        type="button"
        aria-label="打开导航"
        aria-expanded={open}
        aria-controls="sidebar"
        ref={triggerRef}
        onClick={onToggle}
      >
        <AdminIcon name="menu" />
      </button>
      <div className="crumb" id="crumb">
        <Link to="/overview">运营后台</Link>
        <span>/</span>
        <b>{routeTitle(activeName)}</b>
      </div>
      <div className="topbar__actions">
        <span className="source-pill" id="source-pill">
          <span className={`source-dot ${isDemo ? "is-demo" : "is-live"}`} />
          {isDemo ? "演示数据" : "实时接口"}
        </span>
        <button
          className="icon-btn"
          id="refresh"
          type="button"
          aria-label="刷新当前页面"
          title="刷新当前页面"
          onClick={onRefresh}
        >
          <AdminIcon name="refresh" />
        </button>
      </div>
    </header>
  );
}
