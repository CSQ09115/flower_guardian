import { Link } from "react-router-dom";
import { AdminIcon } from "../icons";
import { NAV_GROUPS, ROUTES } from "../routes";
import type { RouteKey } from "../routes";
import { useAdminData } from "../data/store";
import { pendingAlerts } from "../data/selectors";
import { sensorSummary } from "../data/selectors";

type SidebarProps = {
  activeName: RouteKey | "login";
  sidebarRef: React.RefObject<HTMLElement>;
  onConnect: () => void;
  onExit: () => void;
};

/**
 * Sidebar with the brand block, the grouped navigation and the footer.
 * Markup and copy are ported from `renderSidebar()` in the legacy `app.js`.
 */
export function Sidebar({ activeName, sidebarRef, onConnect, onExit }: SidebarProps): JSX.Element {
  const { data, admin } = useAdminData();
  const counts: Partial<Record<RouteKey, number>> = {
    alerts: pendingAlerts(data).length,
    devices: sensorSummary(data).alarm,
  };

  const name = admin.username || "管理员";

  return (
    <aside className="sidebar" id="sidebar" ref={sidebarRef}>
      <Link className="sidebar__brand" to="/overview">
        <img src="/assets/logo.png" alt="" width="34" height="34" decoding="async" />
        <span>
          <b>护花使者</b>
          <small>OPERATIONS</small>
        </span>
      </Link>

      <nav className="sidebar__nav" id="sidebar-nav" aria-label="后台导航">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group__label">{group.label}</div>
            {group.keys.map((key) => {
              const route = ROUTES[key];
              const active = key === activeName || (key === "devices" && activeName === "deviceDetail");
              const count = counts[key] || 0;
              return (
                <Link
                  key={key}
                  className={`nav-item${active ? " is-active" : ""}`}
                  to={`/${key}`}
                  aria-current={active ? "page" : undefined}
                >
                  <AdminIcon name={route.iconName} size={17} />
                  <span>{route.title}</span>
                  {count ? <span className="nav-item__badge">{count}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar__foot" id="sidebar-foot">
        <div className="source-line">
          <span className="source-dot is-live" />
          <span>数据源</span>
          <b>实时接口</b>
        </div>
        <div className="sidebar__user">
          <span className="avatar">{String(name).slice(0, 1).toUpperCase()}</span>
          <span>
            <b>{name}</b>
            <small>管理员</small>
          </span>
          <button
            className="icon-btn"
            type="button"
            id="foot-data"
            aria-label="刷新接口数据"
            title="刷新接口数据"
            onClick={onConnect}
          >
            <AdminIcon name="refresh" size={16} />
          </button>
          <button
            className="icon-btn icon-btn--danger"
            type="button"
            id="foot-exit"
            aria-label="退出登录"
            title="退出登录"
            onClick={onExit}
          >
            <AdminIcon name="logout" size={16} />
          </button>
        </div>
        <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
          <a
            className="btn btn--ghost btn--sm"
            style={{ flex: 1, height: "29px" }}
            href="../index.html"
          >
            <AdminIcon name="external" size={13} />
            查看官网
          </a>
        </div>
      </div>
    </aside>
  );
}
