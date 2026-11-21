import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminIcon } from "../icons";
import { useAdminData } from "../data/store";
import {
  computeAovTrend,
  computeOverview,
  computeStatusBreakdown,
  computeTrend,
  computeUserTrend,
  deviceIssues,
  deviceState,
  movingAverage,
  pendingAlerts,
  sensorSummary,
} from "../data/selectors";
import { STATUS_COLOR, VIZ } from "../charts/geometry";
import { DonutChart } from "../charts/DonutChart";
import { RingGauge } from "../charts/RingGauge";
import { TrendChart } from "../charts/TrendChart";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Kpi } from "../ui/Kpi";
import { compactMoney, dateTime, DEVICE_STATE, money, num, ORDER_STATUS, relative } from "../data/util";

/* The range survives a route change: the legacy module kept it in a module
   variable, so leaving and coming back shows the same window. */
let range = 14;

const STATUS_ITEMS = [
  ["pending", "待确认"],
  ["confirmed", "已确认"],
  ["shipped", "已发货"],
  ["completed", "已完成"],
  ["cancelled", "已取消"],
] as const;

export function Overview(): JSX.Element {
  const { data, toast } = useAdminData();
  const [, setVersion] = useState(0);

  const now = Date.now();
  const overview = computeOverview(data, range, now);
  const trend = computeTrend(data, range, "day", now);
  const users = computeUserTrend(data, range, now);
  const aov = computeAovTrend(data, range, now);
  const average = movingAverage(trend.sales, 7);
  const statusCounts = computeStatusBreakdown(data, range, now);
  const summary = sensorSummary(data, now);
  const alerts = pendingAlerts(data);
  const attention = data.devices
    .map((device) => ({ device, issues: deviceIssues(device, now), state: deviceState(device, now) }))
    .filter((row) => row.state !== "online")
    .sort((a, b) => (a.state === "offline" ? 1 : 0) - (b.state === "offline" ? 1 : 0))
    .slice(0, 3);
  const recent = [...data.orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);
  const statusItems = STATUS_ITEMS.filter(([key]) => statusCounts[key]).map(([key, label]) => ({
    label,
    value: statusCounts[key],
    color: STATUS_COLOR[key],
  }));
  const fulfilled = statusCounts.completed + statusCounts.shipped;
  const fulfillment = overview.order_count
    ? Math.round((fulfilled / overview.order_count) * 100)
    : 0;
  const avgSales = trend.sales.reduce((total, value) => total + value, 0) / Math.max(1, trend.sales.length);
  const peakValue = Math.max(0, ...trend.sales);
  const peakLabel = trend.labels[trend.sales.indexOf(peakValue)] || "";

  const setRange = (days: number): void => {
    range = days;
    setVersion((version) => version + 1);
  };

  const deviceName = (code: string): string =>
    data.devices.find((d) => d.code === code)?.name || code;

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>概览</h1>
          <p>经营与花盆设备在同一张工作台上：先看今天要处理什么，再下钻到订单或某一只花盆。</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--ghost" to="/devices">
            <AdminIcon name="cpu" size={15} />
            查看设备
          </Link>
          <button
            className="btn"
            type="button"
            id="ov-refresh"
            onClick={() => {
              setVersion((version) => version + 1);
              toast("已刷新概览");
            }}
          >
            <AdminIcon name="refresh" size={15} />
            刷新
          </button>
        </div>
      </div>

      <div className="kpis" style={{ marginTop: "16px" }}>
        <Kpi
          label="销售额合计"
          value={compactMoney(overview.total_sales)}
          meta={`近 ${range} 天 · 含全部订单状态`}
          icon="chart"
          count={overview.total_sales}
          format="compact"
          spark={trend.sales}
          sparkColor={VIZ.leaf}
          tone="rose"
        />
        <Kpi
          label="订单数"
          value={num(overview.order_count)}
          meta={`近 ${range} 天 · 含已取消`}
          icon="receipt"
          count={overview.order_count}
          format="int"
          spark={trend.orders}
          sparkColor={VIZ.coral}
          tone="mint"
        />
        <Kpi
          label="客单价"
          value={money(overview.avg_order_value)}
          meta="销售额 ÷ 订单数"
          icon="gauge"
          count={overview.avg_order_value}
          format="money"
          spark={aov}
          sparkColor={VIZ.green}
          tone="pink"
        />
        <Kpi
          label="新增用户"
          value={num(overview.user_count)}
          meta={`近 ${range} 天注册`}
          icon="users"
          count={overview.user_count}
          format="int"
          spark={users}
          sparkColor={VIZ.green}
        />
      </div>

      <div className="grid-2">
        <section className="card" aria-labelledby="trend-title">
          <div className="card__head">
            <div>
              <h2 id="trend-title">销售趋势</h2>
              <p>按日汇总，实线为销售额，虚线为 7 日均线</p>
            </div>
            <div className="card__actions">
              <div className="segmented" role="group" aria-label="趋势时间范围">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    data-range={d}
                    className={d === range ? "is-active" : ""}
                    aria-pressed={d === range}
                    onClick={() => setRange(d)}
                  >
                    {d} 天
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="card__body">
            <TrendChart
              labels={trend.labels}
              series={[
                { key: "sales", label: "销售额", values: trend.sales, color: VIZ.leaf, format: money },
                {
                  key: "ma",
                  label: "7 日均线",
                  values: average,
                  color: VIZ.coral,
                  dashed: true,
                  area: false,
                  format: money,
                },
              ]}
              height={276}
              yMin={0}
              format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
              xFormat={(label) => label.slice(5)}
              ariaLabel={`近 ${range} 天销售额趋势与 7 日均线`}
            />
            <div className="chart__legend">
              <span>
                <i />
                销售额
              </span>
              <span>
                <i className="dashed" />
                7 日均线
              </span>
              <span>
                <i className="area" />
                统计口径：全部状态
              </span>
            </div>
            <div className="chart-foot">
              <span>
                日均 <b>{money(avgSales)}</b>
              </span>
              <span>
                峰值 <b>{money(peakValue)}</b>
                {peakLabel ? ` · ${peakLabel.slice(5)}` : ""}
              </span>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="sensor-title">
          <div className="card__head">
            <div>
              <h2 id="sensor-title">花盆设备</h2>
              <p>ESP32-S3 · 土壤湿度 / 土温 / 光照</p>
            </div>
            <div className="card__actions">
              <Link className="btn btn--ghost btn--sm" to="/devices">
                全部设备
                <AdminIcon name="chevronRight" size={13} />
              </Link>
            </div>
          </div>
          <div className="card__body">
            <div className="sensor-summary">
              <div className="sensor-summary__gauge">
                <RingGauge
                  value={summary.online}
                  max={summary.total}
                  label="在线设备"
                  caption="在线"
                  color={VIZ.leaf}
                  size={112}
                />
                <small>
                  {summary.online} / {summary.total} 台在线
                </small>
              </div>
              <div className="sensor-summary__stats">
                <MiniStat label="设备总数" value={num(summary.total)} unit="台" />
                <MiniStat
                  label="离线"
                  value={num(summary.offline)}
                  unit="台"
                  color={summary.offline ? "var(--coral-ink)" : "var(--ink)"}
                />
                <MiniStat
                  label="告警"
                  value={num(summary.alarm)}
                  unit="台"
                  color={summary.alarm ? "var(--danger)" : "var(--ink)"}
                />
                <MiniStat
                  label="平均湿度"
                  value={summary.online ? summary.avgMoisture.toFixed(1) : "—"}
                  unit="%"
                  color="var(--ink)"
                />
              </div>
            </div>
            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--line)" }}>
              <div className="fieldset-title">需要关注</div>
              <div style={{ display: "grid", gap: "9px", marginTop: "10px" }}>
                {attention.length ? (
                  attention.map(({ device, issues, state }) => (
                    <Link
                      key={device.code}
                      to={`/devices/${encodeURIComponent(device.code)}`}
                      style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12px" }}
                    >
                      <span className={`source-dot ${state === "offline" ? "" : "is-warn"}`} />
                      <span style={{ minWidth: 0 }}>
                        <b style={{ display: "block", fontSize: "12px" }}>{device.name}</b>
                        <small style={{ display: "block", color: "var(--muted-2)", fontSize: "10.5px" }}>
                          {issues[0]?.text || "需要查看"}
                        </small>
                      </span>
                      <span style={{ marginLeft: "auto" }}>
                        <Badge tone={DEVICE_STATE[state].tone}>{DEVICE_STATE[state].label}</Badge>
                      </span>
                    </Link>
                  ))
                ) : (
                  <div style={{ color: "var(--muted-2)", fontSize: "12px" }}>
                    全部设备在线，最近读数在阈值内。
                  </div>
                )}
              </div>
              <p className="card-note">在线判定为 90 秒内有上报；越界读数与离线会同时写入告警记录。</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: "16px" }}>
        <section className="card" aria-labelledby="status-title">
          <div className="card__head">
            <div>
              <h2 id="status-title">订单构成</h2>
              <p>近 {range} 天 · 按订单状态计数</p>
            </div>
            <div className="card__actions">
              <Link className="btn btn--ghost btn--sm" to="/orders">
                订单列表
                <AdminIcon name="chevronRight" size={13} />
              </Link>
            </div>
          </div>
          <div className="card__body">
            {statusItems.length ? (
              <>
                <DonutChart
                  items={statusItems}
                  centerValue={num(overview.order_count)}
                  centerLabel="笔订单"
                  ariaLabel={`近 ${range} 天订单状态构成，共 ${overview.order_count} 笔`}
                />
                <div className="status-foot">
                  <div className="status-foot__row">
                    <span>已发货 + 已完成</span>
                    <b>
                      {num(fulfilled)} / {num(overview.order_count)} 笔 · {fulfillment}%
                    </b>
                  </div>
                  <div className="meter meter--wide">
                    <i style={{ width: `${fulfillment}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <EmptyState icon="receipt" title="区间内没有订单" />
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="alert-title">
          <div className="card__head">
            <div>
              <h2 id="alert-title">待处理告警</h2>
              <p>阈值越界与设备离线</p>
            </div>
            <div className="card__actions">
              <Link className="btn btn--ghost btn--sm" to="/alerts">
                全部告警
                <AdminIcon name="chevronRight" size={13} />
              </Link>
            </div>
          </div>
          <div className="card__body">
            {alerts.length ? (
              <div style={{ display: "grid", gap: "2px" }}>
                {alerts.slice(0, 4).map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      display: "flex",
                      gap: "9px",
                      alignItems: "flex-start",
                      padding: "9px 0",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <span style={{ marginTop: "2px", color: alert.level === "danger" ? "var(--danger)" : "var(--coral-ink)" }}>
                      <AdminIcon name="alert" size={15} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: "12px" }}>
                        {deviceName(alert.device_code)} · {alert.label}
                      </b>
                      <small style={{ color: "var(--muted-2)", fontSize: "10.5px" }}>{alert.hint}</small>
                    </span>
                    <small style={{ marginLeft: "auto", color: "var(--muted-2)", fontSize: "10.5px", whiteSpace: "nowrap" }}>
                      {relative(alert.at)}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="check" title="没有待处理告警">
                所有设备最近读数都在阈值内。
              </EmptyState>
            )}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: "16px" }} aria-labelledby="recent-title">
        <div className="card__head">
          <div>
            <h2 id="recent-title">最近订单</h2>
            <p>按创建时间倒序，取最近 6 笔</p>
          </div>
          <div className="card__actions">
            <Link className="btn btn--ghost btn--sm" to="/orders">
              全部订单
              <AdminIcon name="chevronRight" size={13} />
            </Link>
          </div>
        </div>
        <div className="card__body card__body--flush">
          {recent.length ? (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: "620px" }}>
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>用户</th>
                    <th className="num">金额</th>
                    <th>状态</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => (
                    <tr key={order.id}>
                      <td className="mono">{order.order_no}</td>
                      <td>
                        {data.users.find((u) => u.id === order.user_id)?.username ||
                          order.contact_name ||
                          "—"}
                      </td>
                      <td className="num strong">{money(order.total_amount)}</td>
                      <td>
                        <Badge tone={ORDER_STATUS[order.status]?.tone}>
                          {ORDER_STATUS[order.status]?.label ?? order.status}
                        </Badge>
                      </td>
                      <td className="nowrap" style={{ color: "var(--muted-2)" }}>
                        {dateTime(order.created_at).slice(5, 16)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="receipt" title="还没有订单" />
          )}
        </div>
      </section>
    </>
  );
}

function MiniStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color?: string;
}): JSX.Element {
  return (
    <div>
      <small style={{ display: "block", color: "var(--muted-2)", fontSize: "10.5px" }}>{label}</small>
      <b
        style={{
          fontSize: "19px",
          letterSpacing: "-.03em",
          color: color || "var(--ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
        <span style={{ fontSize: "10px", fontWeight: 500, color: "var(--muted-2)", marginLeft: "2px" }}>
          {unit}
        </span>
      </b>
    </div>
  );
}
