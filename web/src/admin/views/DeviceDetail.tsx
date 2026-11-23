import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminIcon } from "../icons";
import { useAdminData } from "../data/store";
import { deviceIssues, deviceState, latestReading } from "../data/selectors";
import { Sparkline } from "../charts/Sparkline";
import { TrendChart } from "../charts/TrendChart";
import { VIZ } from "../charts/geometry";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Field } from "../../shared/components/Field";
import { Modal } from "../../shared/components/Modal";
import { dateTime, DEVICE_STATE, downloadCsv, num, relative, timeOnly, toCsv } from "../data/util";
import type { Reading, Thresholds } from "../data/types";

type MetricKey = "moisture" | "temp" | "lux";

const METRICS: Record<MetricKey, { label: string; unit: string; color: string; field: "soil_moisture" | "soil_temp" | "light_lux"; digits: number }> = {
  moisture: { label: "土壤湿度", unit: "%", color: VIZ.leaf, field: "soil_moisture", digits: 1 },
  temp: { label: "土壤温度", unit: "℃", color: VIZ.coral, field: "soil_temp", digits: 1 },
  lux: { label: "光照", unit: " lx", color: VIZ.green, field: "light_lux", digits: 0 },
};

/* The selected curve survives a route change, like the legacy module variable. */
let metric: MetricKey = "moisture";

const daylightNow = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 20;
};

export function DeviceDetail(): JSX.Element {
  const params = useParams();
  const code = decodeURIComponent(params.code ?? "");
  const { data, toast, saveDevice, loadDevice } = useAdminData();
  const [, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [calibration, setCalibration] = useState<{ airRaw: string; waterRaw: string } | null>(null);

  /* The list endpoint only returns the latest reading. Pull the detail endpoint
     so the 24h curve and the readings table have history. */
  useEffect(() => {
    void loadDevice(code);
  }, [code, loadDevice]);

  /* 每 3 秒自动刷新最新读数（设备每 10 秒上报一次）；编辑弹窗打开时暂停，
     避免刷新重渲染打断输入。 */
  useEffect(() => {
    if (editing) return;
    const timer = window.setInterval(() => {
      void loadDevice(code);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [code, loadDevice, editing]);

  const device = data.devices.find((row) => row.code === code);
  const rerender = (): void => setVersion((version) => version + 1);

  if (!device) {
    return (
      <>
        <div className="page-head">
          <div className="page-head__main">
            <h1>设备详情</h1>
            <p>没有找到编号为 {code} 的设备。</p>
          </div>
          <div className="page-head__actions">
            <Link className="btn btn--ghost" to="/devices">
              <AdminIcon name="arrowLeft" size={15} />
              返回设备列表
            </Link>
          </div>
        </div>
        <div className="card">
          <EmptyState icon="cpu" title="设备不存在" size={30}>
            如果硬件已经上报过，请确认设备编号与固件 DEVICE_CODE 是否一致。
          </EmptyState>
        </div>
      </>
    );
  }

  if (!METRICS[metric]) metric = "moisture";
  const now = Date.now();
  const latest = latestReading(device);
  const state = deviceState(device, now);
  const issues = deviceIssues(device, now);
  const readings = device.readings || [];
  const t = device.thresholds;
  const deviceAlerts = data.alerts.filter((a) => a.device_code === device.code && !a.acknowledged);
  const window24 = readings.filter((r) => now - new Date(r.created_at).getTime() < 24 * 3600 * 1000);

  const form = thresholds ?? {
    moistureMin: t.moistureMin,
    moistureMax: t.moistureMax,
    tempMin: t.tempMin,
    tempMax: t.tempMax,
    luxMin: t.luxMin,
    luxMax: t.luxMax,
    alarm: t.alarm,
  };
  const cal = calibration ?? {
    airRaw: String(device.calibration.airRaw),
    waterRaw: String(device.calibration.waterRaw),
  };

  const m = METRICS[metric];
  const chartReadings = readings.filter((r) => now - new Date(r.created_at).getTime() < 24 * 3600 * 1000);
  const chartValues = chartReadings.map((r) => r[m.field]);
  const band =
    metric === "moisture"
      ? { from: t.moistureMin, to: t.moistureMax }
      : metric === "temp"
        ? { from: t.tempMin, to: t.tempMax }
        : null;

  const saveThresholds = async (): Promise<void> => {
    const next: Thresholds = {
      moistureMin: Number(form.moistureMin),
      moistureMax: Number(form.moistureMax),
      tempMin: Number(form.tempMin),
      tempMax: Number(form.tempMax),
      luxMin: Number(form.luxMin),
      luxMax: Number(form.luxMax),
      alarm: form.alarm,
    };
    if (
      next.moistureMin >= next.moistureMax ||
      next.tempMin >= next.tempMax ||
      next.luxMin >= next.luxMax
    ) {
      toast("下限必须小于上限", "error");
      return;
    }
    try {
      await saveDevice(device.code, { thresholds: next });
      toast("阈值已保存");
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  const saveCalibration = async (): Promise<void> => {
    const airRaw = Number(cal.airRaw);
    const waterRaw = Number(cal.waterRaw);
    if (airRaw <= waterRaw) {
      toast("airRaw 应大于 waterRaw（干燥时 ADC 读数更高）", "error");
      return;
    }
    try {
      await saveDevice(device.code, {
        calibration: { ...device.calibration, airRaw, waterRaw, source: "后台记录" },
      });
      toast("标定记录已保存");
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <div className="crumb" style={{ marginBottom: "6px" }}>
            <Link to="/devices">花盆设备</Link>
            <span>/</span>
            <b>{device.code}</b>
          </div>
          <h1>{device.name}</h1>
          <p>
            {device.location || "未设置摆放位置"} · 共 {readings.length} 条读数缓存 · 每 3 秒自动刷新
          </p>
        </div>
        <div className="page-head__actions">
          <button
            className="btn btn--ghost"
            type="button"
            id="dd-edit"
            onClick={() => {
              setEditName(device.name);
              setEditLocation(device.location || "");
              setEditing(true);
            }}
          >
            <AdminIcon name="edit" size={15} />
            编辑档案
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            id="dd-export"
            onClick={() => {
              if (!readings.length) {
                toast("还没有可导出的读数", "error");
                return;
              }
              downloadCsv(
                `${device.code}-readings.csv`,
                toCsv([
                  ["时间", "土壤湿度(%)", "土壤温度(℃)", "光照(lx)", "固件", "IP"],
                  ...readings.map((r) => [
                    dateTime(r.created_at),
                    r.soil_moisture ?? "",
                    r.soil_temp ?? "",
                    r.light_lux ?? "",
                    r.firmware || "",
                    r.ip_address || "",
                  ]),
                ]),
              );
              toast("读数已导出为 CSV");
            }}
          >
            <AdminIcon name="download" size={15} />
            导出读数
          </button>
          <button
            className="btn"
            type="button"
            id="dd-refresh"
            onClick={() => {
              void loadDevice(code);
              rerender();
            }}
          >
            <AdminIcon name="refresh" size={15} />
            刷新
          </button>
        </div>
      </div>

      <section className="device-hero" style={{ marginTop: "16px" }}>
        <span className="device-hero__icon">
          <AdminIcon name={state === "offline" ? "wifiOff" : "cpu"} size={22} />
        </span>
        <div>
          <h2>
            {device.code} <Badge tone={DEVICE_STATE[state].tone}>{DEVICE_STATE[state].label}</Badge>
          </h2>
          <div className="device-hero__meta">
            <span>
              <AdminIcon name="leaf" size={13} />
              {device.name}
            </span>
            <span>
              <AdminIcon name="cpu" size={13} />
              固件 {device.firmware || "—"}
            </span>
            <span>
              <AdminIcon name="link" size={13} />
              {device.ip_address || "未上报 IP"}
            </span>
            <span>
              <AdminIcon name="clock" size={13} />
              {device.last_seen ? `${relative(device.last_seen, now)}上报` : "尚未上报"}
            </span>
            <span>
              <AdminIcon name="activity" size={13} />
              每 {device.report_interval || 10} 秒上报
            </span>
          </div>
        </div>
        <div className="device-hero__actions">
          {issues.length ? (
            <span className={`badge badge--${issues[0].level === "danger" ? "danger" : "warn"}`}>
              <AdminIcon name="alert" size={12} />
              {issues[0].text}
            </span>
          ) : (
            <Badge tone="ok">读数正常</Badge>
          )}
        </div>
      </section>

      <div className="sensor-tiles" style={{ marginTop: "14px" }}>
        <SensorTile
          label="土壤湿度"
          icon="droplet"
          value={latest?.soil_moisture ?? null}
          unit="%"
          digits={1}
          min={t.moistureMin}
          max={t.moistureMax}
          history={window24.map((r) => r.soil_moisture)}
          abnormal={latest?.soil_moisture != null && latest.soil_moisture < t.moistureMin}
          color={VIZ.leaf}
        />
        <SensorTile
          label="土壤温度"
          icon="thermometer"
          value={latest?.soil_temp ?? null}
          unit="℃"
          digits={1}
          min={t.tempMin}
          max={t.tempMax}
          history={window24.map((r) => r.soil_temp)}
          abnormal={
            latest?.soil_temp != null && (latest.soil_temp < t.tempMin || latest.soil_temp > t.tempMax)
          }
          color={VIZ.coral}
        />
        <SensorTile
          label="光照"
          icon="sun"
          value={latest?.light_lux ?? null}
          unit="lx"
          digits={0}
          min={t.luxMin}
          max={t.luxMax}
          history={window24.map((r) => r.light_lux)}
          abnormal={latest?.light_lux != null && daylightNow() && latest.light_lux < t.luxMin}
          missing={latest?.light_lux == null}
          night={!daylightNow()}
          color={VIZ.green}
        />
      </div>

      <div className="grid-2" style={{ marginTop: "16px", alignItems: "start" }}>
        <div className="stack">
          <section className="card" aria-labelledby="dd-chart-title">
            <div className="card__head">
              <div>
                <h2 id="dd-chart-title">近 24 小时读数</h2>
                <p id="dd-chart-note">
                  {m.label}
                  {metric === "moisture" ? " · 阴影为阈值区间" : ""}
                </p>
              </div>
              <div className="card__actions">
                <div className="segmented" role="group" aria-label="选择曲线">
                  {(Object.keys(METRICS) as MetricKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      data-metric={key}
                      className={key === metric ? "is-active" : ""}
                      aria-pressed={key === metric}
                      onClick={() => {
                        metric = key;
                        rerender();
                      }}
                    >
                      {METRICS[key].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="card__body">
              {!chartReadings.length ? (
                <EmptyState icon="history" title="近 24 小时没有读数" size={28} />
              ) : metric === "lux" && chartValues.every((v) => v == null) ? (
                <EmptyState icon="sun" title="光照传感器无读数" size={28}>
                  BH1750 未接入或读取失败时，固件上报 light_lux 为 null。
                </EmptyState>
              ) : (
                <TrendChart
                  labels={chartReadings.map((r) => r.created_at)}
                  series={[
                    {
                      key: metric,
                      label: m.label,
                      values: chartValues,
                      color: m.color,
                      format: (v) => `${Number(v).toFixed(m.digits)}${m.unit}`,
                    },
                  ]}
                  height={236}
                  yMin={metric === "temp" ? Math.min(0, ...chartValues.filter((v) => v != null)) : 0}
                  yMax={
                    metric === "lux"
                      ? Math.max(1000, ...chartValues.filter((v) => v != null))
                      : undefined
                  }
                  band={band}
                  unit=""
                  ariaLabel={`${device.name} 近 24 小时${m.label}曲线`}
                  xFormat={(label) => timeOnly(label)}
                  xTickCount={7}
                />
              )}
              <div className="chart__legend">
                {metric === "moisture" ? (
                  <>
                    <span>
                      <i />
                      土壤湿度
                    </span>
                    <span>
                      <i className="area" />
                      {t.moistureMin}–{t.moistureMax}% 目标区间
                    </span>
                  </>
                ) : null}
                {metric === "temp" ? (
                  <>
                    <span>
                      <i style={{ background: "var(--viz-2)" }} />
                      土壤温度
                    </span>
                    <span>
                      <i className="area" />
                      {t.tempMin}–{t.tempMax}℃ 目标区间
                    </span>
                  </>
                ) : null}
                {metric === "lux" ? (
                  <>
                    <span>
                      <i style={{ background: "var(--viz-3)" }} />
                      光照
                    </span>
                    <span>
                      <i className="dashed" />
                      下限 {num(t.luxMin)} lx
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </section>
          <SummaryCard rows={window24} />
        </div>

        <section className="card" aria-labelledby="dd-threshold-title">
          <div className="card__head">
            <div>
              <h2 id="dd-threshold-title">阈值与告警</h2>
              <p>越界后在告警页生成记录</p>
            </div>
          </div>
          <div className="card__body">
            <form
              className="threshold-form"
              id="dd-threshold-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveThresholds();
              }}
            >
              <div className="fieldset-title">土壤湿度（%）</div>
              <div className="form-row">
                <Field
                  label="下限"
                  name="moistureMin"
                  type="number"
                  value={String(form.moistureMin)}
                  onChange={(value) => setThresholds({ ...form, moistureMin: Number(value) })}
                  min={0}
                  max={100}
                  step={1}
                  icon={<AdminIcon name="droplet" size={13} />}
                />
                <Field
                  label="上限"
                  name="moistureMax"
                  type="number"
                  value={String(form.moistureMax)}
                  onChange={(value) => setThresholds({ ...form, moistureMax: Number(value) })}
                  min={0}
                  max={100}
                  step={1}
                  icon={<AdminIcon name="droplet" size={13} />}
                />
              </div>
              <div className="fieldset-title">土壤温度（℃）</div>
              <div className="form-row">
                <Field
                  label="下限"
                  name="tempMin"
                  type="number"
                  value={String(form.tempMin)}
                  onChange={(value) => setThresholds({ ...form, tempMin: Number(value) })}
                  min={-10}
                  max={60}
                  step={0.5}
                  icon={<AdminIcon name="thermometer" size={13} />}
                />
                <Field
                  label="上限"
                  name="tempMax"
                  type="number"
                  value={String(form.tempMax)}
                  onChange={(value) => setThresholds({ ...form, tempMax: Number(value) })}
                  min={-10}
                  max={60}
                  step={0.5}
                  icon={<AdminIcon name="thermometer" size={13} />}
                />
              </div>
              <div className="fieldset-title">光照（lx）</div>
              <div className="form-row">
                <Field
                  label="下限"
                  name="luxMin"
                  type="number"
                  value={String(form.luxMin)}
                  onChange={(value) => setThresholds({ ...form, luxMin: Number(value) })}
                  min={0}
                  step={50}
                  icon={<AdminIcon name="sun" size={13} />}
                />
                <Field
                  label="上限"
                  name="luxMax"
                  type="number"
                  value={String(form.luxMax)}
                  onChange={(value) => setThresholds({ ...form, luxMax: Number(value) })}
                  min={0}
                  step={500}
                  icon={<AdminIcon name="sun" size={13} />}
                />
              </div>
              <div className="field__hint" style={{ marginTop: "-6px" }}>
                光照阈值只在 06:00–20:00 判定，夜间不因低于下限而告警。
              </div>
              <div className="switch-row">
                <span>
                  <b>启用阈值告警</b>
                  <small>关闭后仍记录读数，只是不生成告警</small>
                </span>
                <label className="switch">
                  <input
                    type="checkbox"
                    name="alarm"
                    checked={form.alarm}
                    aria-label="启用阈值告警"
                    onChange={(event) =>
                      setThresholds({ ...form, alarm: event.target.checked })
                    }
                  />
                  <i />
                </label>
              </div>
              <button className="btn" type="submit">
                <AdminIcon name="check" size={15} />
                保存阈值
              </button>
            </form>
            {deviceAlerts.length ? (
              <div className="note" style={{ borderStyle: "solid", background: "var(--coral-soft)", borderColor: "var(--pink-mist)" }}>
                <AdminIcon name="alert" size={14} />
                <span>
                  当前有 {deviceAlerts.length} 条待处理告警，可在
                  <Link to="/alerts" style={{ color: "var(--danger)", textDecoration: "underline" }}>
                    告警记录
                  </Link>
                  确认。
                </span>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: "16px" }}>
        <section className="card" aria-labelledby="dd-recent-title">
          <div className="card__head">
            <div>
              <h2 id="dd-recent-title">最近读数</h2>
              <p>最新 {Math.min(12, readings.length)} 条 · 每 10 秒上报后按 10 分钟归档</p>
            </div>
            <div className="card__actions">
              <Badge plain>{readings.length} 条缓存</Badge>
            </div>
          </div>
          <div className="card__body card__body--flush">
            {readings.length ? (
              <div className="table-wrap">
                <table className="table" style={{ minWidth: "560px" }}>
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th className="num">土壤湿度</th>
                      <th className="num">土壤温度</th>
                      <th className="num">光照</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings
                      .slice(-12)
                      .reverse()
                      .map((reading) => (
                        <tr key={reading.created_at}>
                          <td className="mono">{dateTime(reading.created_at).slice(5, 16)}</td>
                          <td className="num">
                            {reading.soil_moisture != null ? `${reading.soil_moisture.toFixed(1)}%` : "—"}
                          </td>
                          <td className="num">
                            {reading.soil_temp != null ? `${reading.soil_temp.toFixed(1)}℃` : "—"}
                          </td>
                          <td className="num">
                            {reading.light_lux != null ? `${num(reading.light_lux)} lx` : "无读数"}
                          </td>
                          <td>
                            <RowStatus reading={reading} thresholds={t} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="history" title="还没有读数">
                固件第一次上报后会在这里出现。
              </EmptyState>
            )}
          </div>
        </section>

        <div className="stack">
          <section className="card" aria-labelledby="dd-cal-title">
            <div className="card__head">
              <div>
                <h2 id="dd-cal-title">土壤湿度标定</h2>
                <p>两点标定：全干 airRaw、全湿 waterRaw</p>
              </div>
            </div>
            <div className="card__body">
              <div className="cal-grid">
                <div className="cal-card">
                  <small>全干 airRaw</small>
                  <b>{num(device.calibration.airRaw)}</b>
                </div>
                <div className="cal-card">
                  <small>全湿 waterRaw</small>
                  <b>{num(device.calibration.waterRaw)}</b>
                </div>
              </div>
              <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "11.5px" }}>
                当前读数反推原始值约{" "}
                <b style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                  {latest?.soil_moisture != null
                    ? num(
                        device.calibration.airRaw -
                          (latest.soil_moisture *
                            (device.calibration.airRaw - device.calibration.waterRaw)) /
                            100,
                      )
                    : "—"}
                </b>
                <span style={{ color: "var(--muted-2)" }}>
                  （airRaw − 湿度% × (airRaw − waterRaw) ÷ 100）
                </span>
              </div>
              <ol className="steps" style={{ marginTop: "12px" }}>
                <li>
                  探针悬空放空气中，串口输入 <code>adc</code> 看读数是否稳定，再输入 <code>cal air</code>。
                </li>
                <li>
                  探针插入水中（别淹到电路板），输入 <code>cal water</code>。
                </li>
                <li>
                  输入 <code>cal show</code> 确认；标定值写入 NVS，断电不丢。
                </li>
                <li>把串口读到的两个值记录在这里，方便换板或排查时对照。</li>
              </ol>
              <form
                id="dd-cal-form"
                style={{ display: "grid", gap: "10px", marginTop: "12px" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveCalibration();
                }}
              >
                <div className="form-row">
                  <Field
                    label="airRaw 记录值"
                    name="airRaw"
                    type="number"
                    value={cal.airRaw}
                    onChange={(value) => setCalibration({ ...cal, airRaw: value })}
                    min={0}
                    max={4095}
                    step={1}
                  />
                  <Field
                    label="waterRaw 记录值"
                    name="waterRaw"
                    type="number"
                    value={cal.waterRaw}
                    onChange={(value) => setCalibration({ ...cal, waterRaw: value })}
                    min={0}
                    max={4095}
                    step={1}
                  />
                </div>
                <button className="btn btn--ghost" type="submit">
                  <AdminIcon name="wrench" size={15} />
                  保存标定记录
                </button>
                <div className="field__hint">
                  后台只保存记录，不会把值下发到设备；设备端以串口命令写入的 NVS 为准。
                </div>
              </form>
            </div>
          </section>

          <section className="card" aria-labelledby="dd-proto-title">
            <div className="card__head">
              <div>
                <h2 id="dd-proto-title">上报协议</h2>
                <p>
                  固件 <code>postReading()</code> 每 10 秒调用
                </p>
              </div>
            </div>
            <div className="card__body">
              <div
                className="mono"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  overflowX: "auto",
                  whiteSpace: "pre",
                  lineHeight: 1.7,
                }}
              >
                {`POST /api/devices/${device.code}/readings
Content-Type: application/json

{
  "soil_moisture": ${latest?.soil_moisture ?? 0},
  "soil_temp": ${latest?.soil_temp ?? 0},
  "light_lux": ${latest?.light_lux == null ? "null" : latest.light_lux},
  "firmware": "${device.firmware || "0.4.0"}",
  "ip_address": "${device.ip_address || ""}"
}`}
              </div>
              <div className="field__hint" style={{ marginTop: "8px" }}>
                成功判定 200 / 201；其他状态码会让板载 LED 急闪三下。WiFi 未连接时跳过本次上报。
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={editing}
        title="编辑设备档案"
        subtitle="只修改后台显示信息，不改动固件配置。"
        onClose={() => setEditing(false)}
        footer={
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setEditing(false)}>
              取消
            </button>
            <button
              className="btn"
              type="button"
              onClick={async () => {
                try {
                  await saveDevice(device.code, {
                    name: editName.trim(),
                    location: editLocation.trim(),
                  });
                  setEditing(false);
                  toast("设备档案已更新");
                } catch (error) {
                  toast((error as Error).message, "error");
                }
              }}
            >
              保存
            </button>
          </>
        }
      >
        <form id="dd-edit-form" style={{ display: "grid", gap: "12px" }} onSubmit={(event) => event.preventDefault()}>
          <div className="field">
            <label htmlFor="e-code">设备编号</label>
            <input className="input" id="e-code" value={device.code} disabled />
          </div>
          <div className="field">
            <label htmlFor="e-name">显示名称</label>
            <input
              className="input"
              id="e-name"
              name="name"
              value={editName}
              required
              onChange={(event) => setEditName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="e-loc">摆放位置</label>
            <input
              className="input"
              id="e-loc"
              name="location"
              value={editLocation}
              onChange={(event) => setEditLocation(event.target.value)}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}

function SensorTile({
  label,
  icon,
  value,
  unit,
  digits,
  min,
  max,
  history,
  abnormal,
  missing = false,
  night = false,
  color,
}: {
  label: string;
  icon: string;
  value: number | null;
  unit: string;
  digits: number;
  min: number;
  max: number;
  history: (number | null)[];
  abnormal: boolean;
  missing?: boolean;
  night?: boolean;
  color: string;
}): JSX.Element {
  const clean = history.filter((v): v is number => v != null);
  const lo = clean.length ? Math.min(...clean) : null;
  const hi = clean.length ? Math.max(...clean) : null;

  return (
    <div className="sensor-tile">
      <div className="sensor-tile__head">
        <AdminIcon name={icon} size={15} />
        {label}
        {missing ? (
          <Badge tone="warn">传感器无读数</Badge>
        ) : night ? (
          <Badge plain>夜间不判定</Badge>
        ) : abnormal ? (
          <Badge tone="danger">超出阈值</Badge>
        ) : (
          <Badge tone="ok">阈值内</Badge>
        )}
      </div>
      <div className="sensor-tile__value">
        {value == null ? "—" : Number(value).toFixed(digits)}
        <small>{unit}</small>
      </div>
      <div className="sensor-tile__meta">
        目标 {num(min)}–{num(max)} {unit}
        {lo != null ? ` · 24h ${Number(lo).toFixed(digits)}–${Number(hi).toFixed(digits)}` : ""}
      </div>
      <div style={{ marginTop: "8px" }}>
        {missing ? (
          <span style={{ fontSize: "10.5px", color: "var(--muted-2)" }}>
            BH1750 未接入或读取失败，固件上报 null
          </span>
        ) : (
          <Sparkline values={history} low={abnormal} color={color} />
        )}
      </div>
    </div>
  );
}

function RowStatus({ reading, thresholds }: { reading: Reading; thresholds: Thresholds }): JSX.Element {
  if (reading.soil_moisture != null && reading.soil_moisture < thresholds.moistureMin) {
    return <Badge tone="danger">湿度偏低</Badge>;
  }
  if (reading.light_lux == null) return <Badge tone="warn">光照无读数</Badge>;
  if (
    reading.soil_temp != null &&
    (reading.soil_temp < thresholds.tempMin || reading.soil_temp > thresholds.tempMax)
  ) {
    return <Badge tone="warn">土温越界</Badge>;
  }
  return <Badge tone="ok">正常</Badge>;
}

function SummaryCard({ rows }: { rows: Reading[] }): JSX.Element {
  const specs = [
    { key: "soil_moisture", label: "土壤湿度", unit: "%", digits: 1, icon: "droplet" },
    { key: "soil_temp", label: "土壤温度", unit: "℃", digits: 1, icon: "thermometer" },
    { key: "light_lux", label: "光照", unit: " lx", digits: 0, icon: "sun" },
  ] as const;

  return (
    <section className="card" aria-labelledby="dd-sum-title">
      <div className="card__head">
        <div>
          <h2 id="dd-sum-title">24 小时统计</h2>
          <p>共 {rows.length} 个采样点 · 最低 / 平均 / 最高</p>
        </div>
      </div>
      <div className="card__body">
        {rows.length ? (
          <div className="sum-list">
            <div className="sum-row sum-row--head">
              <span className="sum-row__label">传感器</span>
              <span className="sum-row__cells">
                <small>最低</small>
                <small>平均</small>
                <small>最高</small>
              </span>
              <span className="sum-row__unit">单位</span>
            </div>
            {specs.map((spec) => {
              const values = rows
                .map((row) => row[spec.key])
                .filter((v): v is number => v != null && Number.isFinite(v));
              const missing = rows.length - rows.filter((row) => row[spec.key] != null).length;
              return (
                <div className="sum-row" key={spec.key}>
                  <span className="sum-row__label">
                    <AdminIcon name={spec.icon} size={14} />
                    {spec.label}
                  </span>
                  {values.length ? (
                    <>
                      <span className="sum-row__cells">
                        <b>{Math.min(...values).toFixed(spec.digits)}</b>
                        <b>
                          {(values.reduce((s, v) => s + v, 0) / values.length).toFixed(spec.digits)}
                        </b>
                        <b>{Math.max(...values).toFixed(spec.digits)}</b>
                      </span>
                      <span className="sum-row__unit">{spec.unit.trim()}</span>
                    </>
                  ) : (
                    <span className="sum-row__empty">近 24 小时无读数</span>
                  )}
                  {missing && values.length ? (
                    <span className="sum-row__gap">{missing} 条缺失</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="history" title="近 24 小时没有读数" size={26}>
            设备上报后这里会按传感器汇总。
          </EmptyState>
        )}
      </div>
    </section>
  );
}
