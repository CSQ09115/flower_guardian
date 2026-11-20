import { Link } from "react-router-dom";
import { AdminIcon } from "../icons";
import { Sparkline } from "../charts/Sparkline";
import { VIZ } from "../charts/geometry";
import { Badge } from "./Badge";
import { deviceIssues, deviceState, latestReading } from "../data/selectors";
import { DEVICE_STATE, num, relative } from "../data/util";
import type { Device } from "../data/types";

/**
 * Device card. Ported from the `card()` helper in
 * `legacy/admin/assets/js/views/devices.js`.
 */
export function DeviceCard({ device, now }: { device: Device; now: number }): JSX.Element {
  const latest = latestReading(device);
  const state = deviceState(device, now);
  const issues = deviceIssues(device, now);
  const moisture = latest?.soil_moisture;
  const low = moisture != null && moisture < (device.thresholds?.moistureMin ?? 0);
  const spark = (device.readings || []).filter((_, i) => i % 6 === 0).map((reading) => reading.soil_moisture);

  return (
    <article className="device-card">
      <div className="device-card__head">
        <span style={{ color: "var(--green-2)", marginTop: "2px" }}>
          <AdminIcon name={state === "offline" ? "wifiOff" : "cpu"} size={18} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2>
            <Link to={`/devices/${encodeURIComponent(device.code)}`}>{device.name}</Link>
          </h2>
          <div className="device-card__code">
            {device.code} · {device.location || "未设置位置"}
          </div>
        </div>
        <Badge tone={DEVICE_STATE[state].tone}>{DEVICE_STATE[state].label}</Badge>
      </div>

      <div className="device-card__readings">
        <div>
          <small>土壤湿度</small>
          <b>
            {moisture != null ? moisture.toFixed(1) : "—"}
            <span>%</span>
          </b>
        </div>
        <div>
          <small>土壤温度</small>
          <b>
            {latest?.soil_temp != null ? latest.soil_temp.toFixed(1) : "—"}
            <span>℃</span>
          </b>
        </div>
        <div>
          <small>光照</small>
          <b>
            {latest?.light_lux != null ? num(latest.light_lux) : "无读数"}
            <span>{latest?.light_lux != null ? "lx" : ""}</span>
          </b>
        </div>
      </div>

      {moisture != null ? (
        <div
          className={`meter ${low ? "is-low" : ""}`}
          title={`湿度区间 ${device.thresholds.moistureMin}–${device.thresholds.moistureMax}%`}
        >
          <i style={{ width: `${Math.max(2, Math.min(100, moisture))}%` }} />
        </div>
      ) : null}

      {spark.length > 1 ? (
        <div className="device-card__spark">
          <Sparkline values={spark} color={low ? VIZ.coral : VIZ.leaf} />
          <small>近 24 小时土壤湿度</small>
        </div>
      ) : null}

      <div className="device-card__foot">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <AdminIcon name="clock" size={12} />
          {relative(device.last_seen ?? "", Date.now())}
        </span>
        <span>·</span>
        <span>固件 {device.firmware || "—"}</span>
        {issues.length ? (
          <span className={`device-card__issue${issues[0].level === "danger" ? " is-danger" : ""}`}>
            <AdminIcon name="alert" size={12} />
            {issues[0].text}
          </span>
        ) : null}
        <Link className="btn btn--ghost btn--sm" to={`/devices/${encodeURIComponent(device.code)}`}>
          详情
        </Link>
      </div>
    </article>
  );
}
