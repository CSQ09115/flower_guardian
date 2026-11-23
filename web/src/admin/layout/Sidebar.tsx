import { Link, useLocation } from "react-router-dom";
import { AdminIcon } from "../icons";
import { SIDEBAR_NAV, ROUTES } from "../routes";
import type { RouteKey } from "../routes";
import { useAdminData } from "../data/store";
import { pendingAlerts } from "../data/selectors";
import { useDevicesOverview } from "../hooks/useDevicesOverview";

type SidebarProps = {
  activeName: RouteKey | "login";
  sidebarRef: React.RefObject<HTMLElement>;
  onConnect: () => void;
  onExit: () => void;
};

/**
 * Sidebar with the brand block, the grouped navigation and the footer.
 * Markup and copy are ported from `renderSidebar()` in the legacy `app.js`.
 * The devices entry carries a red dot badge fed by the 30s overview poll
 * (unacknowledged alerts); log/config groups expand into per-page entries.
 */
export function Sidebar({ activeName, sidebarRef, onConnect, onExit }: SidebarProps): JSX.Element {
  const { data, admin, signedIn } = useAdminData();
  const location = useLocation();
  const overview = useDevicesOverview(signedIn);
  const alertsBadge = pendingAlerts(data).length;

  const name = admin.username || "管理员";
  const pathname = location.pathname.replace(/\/+$/, "") || "/";

  const isActive = (key: RouteKey, path: string): boolean => {
    if (key === "devices" && activeName === "deviceDetail") return true;
    if (key === "configGroup") {
      // config/:group pages highlight their own menu entry
      return pathname === path;
    }
    return activeName === key;
  };

  /* Group entries by meta group label, preserving the declared order. */
  const groups: { label: string; items: typeof SIDEBAR_NAV }[] = [];
  SIDEBAR_NAV.forEach((item) => {
    const label =
      item.kind === "route" ? ROUTES[item.key].group : ROUTES.configGroup.group;
    let group = groups.find((entry) => entry.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });

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
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group__label">{group.label}</div>
            {group.items.map((item) => {
              if (item.kind === "config") {
                const path = `/config/${item.group}`;
                const active = isActive("configGroup", path);
                return (
                  <Link
                    key={path}
                    className={`nav-item${active ? " is-active" : ""}`}
                    to={path}
                    aria-current={active ? "page" : undefined}
                  >
                    <AdminIcon name={item.iconName} size={17} />
                    <span>{item.label}</span>
                  </Link>
                );
              }
              const route = ROUTES[item.key];
              const path =
                item.key === "emailLogs"
                  ? "/logs/email"
                  : item.key === "smsLogs"
                    ? "/logs/sms"
                    : item.key === "configYolo"
                      ? "/config/yolo"
                      : item.key === "apiDocs"
                        ? "/docs/api"
                        : `/${item.key === "deviceDetail" ? "devices" : item.key}`;
              const active = isActive(item.key, path);
              /* 未确认告警红点：设备菜单用 overview 轮询值，告警菜单用已载入数据 */
              const dot =
                item.key === "devices"
                  ? overview.unacknowledged_alerts
                  : item.key === "alerts"
                    ? alertsBadge
                    : 0;
              return (
                <Link
                  key={item.key}
                  className={`nav-item${active ? " is-active" : ""}`}
                  to={path}
                  aria-current={active ? "page" : undefined}
                  title={dot ? `${dot} 条未确认告警` : undefined}
                >
                  <AdminIcon name={route.iconName} size={17} />
                  <span>{route.title}</span>
                  {item.key === "alerts" && alertsBadge ? (
                    <span className="nav-item__badge">{alertsBadge}</span>
                  ) : null}
                  {dot ? <span className="nav-item__dot" aria-label={`${dot} 条未确认告警`} /> : null}
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
