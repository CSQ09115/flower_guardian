import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminIcon } from "../icons";
import { useAdminData } from "../data/store";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Kpi } from "../ui/Kpi";
import { dateTime, num, relative } from "../data/util";
import type { Alert } from "../data/types";

/* The filter survives a route change, like the legacy module variable. */
let filter: "open" | "ack" | "all" = "open";

const METRIC_LABEL: Record<string, string> = {
  soil_moisture: "土壤湿度",
  soil_temp: "土壤温度",
  air_temp: "空气温度",
  air_humidity: "空气湿度",
  light_lux: "光照",
  online: "设备连接",
};

function metricValue(alert: Alert, value: number | null = alert.value): string {
  if (value == null) return "—";
  if (alert.metric === "soil_moisture" || alert.metric === "air_humidity") return `${Number(value).toFixed(1)}%`;
  if (alert.metric === "soil_temp" || alert.metric === "air_temp") return `${Number(value).toFixed(1)}℃`;
  if (alert.metric === "light_lux") return `${num(value)} lx`;
  return String(value);
}

export function Alerts(): JSX.Element {
  const { data, toast, acknowledgeAlert } = useAdminData();
  const [, setVersion] = useState(0);
  const [pending, setPending] = useState<number[]>([]);

  const all = data.alerts;
  const open = all.filter((a) => !a.acknowledged);
  const now = Date.now();
  const today = all.filter((a) => now - new Date(a.at).getTime() < 86400000);
  const danger = open.filter((a) => a.level === "danger");

  const rows = all
    .filter((a) => (filter === "open" ? !a.acknowledged : filter === "ack" ? a.acknowledged : true))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>告警记录</h1>
          <p>阈值越界、传感器无读数与设备离线都会落在这一页。确认只代表「已看到」，不会修改设备阈值。</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--ghost" to="/devices">
            <AdminIcon name="cpu" size={15} />
            设备列表
          </Link>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="待处理" value={num(open.length)} meta="需要人工确认" icon="bell" tone={open.length ? "coral" : ""} />
        <Kpi label="今日新增" value={num(today.length)} meta="最近 24 小时" icon="clock" tone="mint" />
        <Kpi label="高优先级" value={num(danger.length)} meta="danger 级别" icon="alert" tone={danger.length ? "pink" : ""} />
        <Kpi label="已确认" value={num(all.length - open.length)} meta="累计确认" icon="check" tone="mint" />
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="chips" role="group" aria-label="按确认状态筛选">
            {(
              [
                ["open", "待处理", open.length],
                ["ack", "已确认", all.length - open.length],
                ["all", "全部", all.length],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                className={`chip${filter === key ? " is-active" : ""}`}
                type="button"
                data-afilter={key}
                aria-pressed={filter === key}
                onClick={() => {
                  filter = key;
                  setVersion((version) => version + 1);
                }}
              >
                {label}
                <span className="chip__count">{count}</span>
              </button>
            ))}
          </div>
          <span style={{ marginLeft: "auto", color: "var(--muted-2)", fontSize: "11.5px" }}>
            阈值在设备详情页调整
          </span>
        </div>
        <div className="card__body card__body--flush" id="alert-body">
          {rows.length ? (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: "820px" }}>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>设备</th>
                    <th>指标</th>
                    <th className="num">读数</th>
                    <th className="num">阈值</th>
                    <th>级别</th>
                    <th>状态</th>
                    <th>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((alert) => {
                    const device = data.devices.find((d) => d.code === alert.device_code);
                    return (
                      <tr key={alert.id}>
                        <td className="nowrap">
                          <span className="mono">{dateTime(alert.at)}</span>
                          <div className="field__hint">{relative(alert.at, now)}</div>
                        </td>
                        <td>
                          <Link className="link" to={`/devices/${encodeURIComponent(alert.device_code)}`}>
                            {device?.name || alert.device_code}
                          </Link>
                          <div className="field__hint">{alert.device_code}</div>
                        </td>
                        <td>
                          {alert.label || METRIC_LABEL[alert.metric] || alert.metric}
                          <div className="field__hint">{alert.hint || ""}</div>
                        </td>
                        <td className="num strong">{metricValue(alert)}</td>
                        <td className="num">
                          {alert.metric === "online"
                            ? `${num(alert.threshold)} 秒`
                            : metricValue(alert, alert.value == null ? null : alert.threshold)}
                        </td>
                        <td>
                          <Badge tone={alert.level === "danger" ? "danger" : "warn"}>
                            {alert.level === "danger" ? "高" : "中"}
                          </Badge>
                        </td>
                        <td>
                          {alert.acknowledged ? (
                            <Badge tone="ok">已确认</Badge>
                          ) : (
                            <Badge tone="warn">待处理</Badge>
                          )}
                        </td>
                        <td className="nowrap">
                          {alert.acknowledged ? null : (
                            <button
                              className="btn btn--ghost btn--sm"
                              type="button"
                              data-ack={alert.id}
                              disabled={pending.includes(alert.id)}
                              onClick={async () => {
                                setPending((ids) => [...ids, alert.id]);
                                try {
                                  await acknowledgeAlert(alert.id);
                                } catch (error) {
                                  setPending((ids) => ids.filter((id) => id !== alert.id));
                                  toast((error as Error).message, "error");
                                }
                              }}
                            >
                              <AdminIcon name="check" size={13} />
                              确认
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="check" title={filter === "open" ? "没有待处理告警" : "没有匹配的记录"} size={30}>
              {filter === "open" ? "所有设备最近读数都在阈值内。" : "切换筛选条件再试。"}
            </EmptyState>
          )}
        </div>
      </section>
    </>
  );
}
