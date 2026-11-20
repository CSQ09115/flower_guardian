import { useState } from "react";
import { AdminIcon } from "../icons";
import { useAdminData } from "../data/store";
import { deviceState, moistureHeatmap, sensorSummary } from "../data/selectors";
import { Heatmap } from "../charts/Heatmap";
import { Badge } from "../ui/Badge";
import { DeviceCard } from "../ui/DeviceCard";
import { EmptyState } from "../ui/EmptyState";
import { Kpi } from "../ui/Kpi";
import { Modal } from "../../shared/components/Modal";

/* The search box and the status filter survive a route change, like the legacy
   module-level variables. */
let query = "";
let filter: "all" | "online" | "alarm" | "offline" = "all";

export function Devices(): JSX.Element {
  const { data, isDemo, toast, createDevice } = useAdminData();
  const [, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const now = Date.now();
  const summary = sensorSummary(data, now);
  const counts = {
    all: data.devices.length,
    online: summary.online,
    alarm: summary.alarm,
    offline: summary.offline,
  };

  const q = query.toLowerCase();
  const rows = data.devices.filter((device) => {
    const state = deviceState(device, now);
    if (filter === "alarm" && state !== "alarm") return false;
    if (filter === "online" && state === "offline") return false;
    if (filter === "offline" && state !== "offline") return false;
    if (!q) return true;
    return [device.code, device.name, device.location, device.ip_address]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });

  const rerender = (): void => setVersion((version) => version + 1);

  const submitCreate = async (): Promise<void> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (data.devices.some((device) => device.code === trimmed)) {
      toast("设备编号已存在", "error");
      return;
    }
    try {
      await createDevice({ code: trimmed, name: name.trim(), location: location.trim() });
      setCreating(false);
      setCode("");
      setName("");
      setLocation("");
      toast("设备档案已创建");
    } catch (error) {
      toast((error as Error).message, "error");
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>花盆设备</h1>
          <p>ESP32-S3 花盆端每 10 秒上报一次土壤湿度、土壤温度与光照。这里是设备、读数与阈值的第一入口。</p>
        </div>
        <div className="page-head__actions">
          <button
            className="btn btn--ghost"
            type="button"
            id="dev-refresh"
            onClick={() => {
              rerender();
              toast("设备读数已刷新");
            }}
          >
            <AdminIcon name="refresh" size={15} />
            刷新读数
          </button>
          <button className="btn" type="button" id="dev-new" onClick={() => setCreating(true)}>
            <AdminIcon name="plus" size={15} />
            接入设备
          </button>
        </div>
      </div>

      {isDemo ? (
        <div className="note">
          <AdminIcon name="info" size={15} />
          <span>
            演示设备与读数用于界面验证，不代表真实硬件。已实现传感器：土壤湿度（电容式 ADC）、光照（BH1750）；土壤温度仍是固件内的模拟曲线，接入 DS18B20 前不应作为决策依据。
          </span>
        </div>
      ) : null}

      <div className="kpis" style={{ marginTop: "16px" }}>
        <Kpi label="设备总数" value={String(summary.total)} meta="台" icon="cpu" tone="rose" count={summary.total} />
        <Kpi label="在线" value={String(summary.online)} meta="90 秒内有上报" icon="wifi" tone="ok" count={summary.online} />
        <Kpi
          label="离线"
          value={String(summary.offline)}
          meta="超过 90 秒无上报"
          icon="wifiOff"
          tone={summary.offline ? "pink" : ""}
          count={summary.offline}
        />
        <Kpi
          label="阈值告警"
          value={String(summary.alarm)}
          meta="在线且读数越界"
          icon="alert"
          tone={summary.alarm ? "coral" : ""}
          count={summary.alarm}
        />
      </div>

      <section className="card" style={{ marginBottom: "16px" }} aria-labelledby="heat-title">
        <div className="card__head">
          <div>
            <h2 id="heat-title">土壤湿度分布</h2>
            <p>每台设备最近 24 小时，按 2 小时归并 · 颜色越深湿度越高</p>
          </div>
          <div className="card__actions">
            <Badge plain>{summary.total} 台设备</Badge>
          </div>
        </div>
        <div className="card__body">
          <Heatmap
            rows={moistureHeatmap(data, now)}
            cols={Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, "0")}`)}
            min={10}
            max={80}
            unit="%"
            ariaLabel="各设备近 24 小时土壤湿度分布热力图"
          />
          <div className="chart__legend">
            <span>
              <i className="area" />
              格内为该时段读数均值
            </span>
            <span>离线设备取最后一次上报前的 24 小时</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <AdminIcon name="search" />
            <input
              className="input"
              id="dev-search"
              type="search"
              placeholder="搜索设备编号、名称或位置"
              value={query}
              aria-label="搜索设备"
              onChange={(event) => {
                query = event.target.value.trim();
                rerender();
              }}
            />
          </div>
          <div className="chips" id="dev-chips" role="group" aria-label="按状态筛选">
            {(
              [
                ["all", "全部", counts.all],
                ["online", "在线", counts.online],
                ["alarm", "告警", counts.alarm],
                ["offline", "离线", counts.offline],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                className={`chip${filter === key ? " is-active" : ""}`}
                type="button"
                data-filter={key}
                aria-pressed={filter === key}
                onClick={() => {
                  filter = key;
                  rerender();
                }}
              >
                {label}
                <span className="chip__count">{count}</span>
              </button>
            ))}
          </div>
          <span style={{ marginLeft: "auto", color: "var(--muted-2)", fontSize: "11.5px" }}>
            共 {data.devices.length} 台
          </span>
        </div>
        <div className="card__body" id="device-list">
          {rows.length ? (
            <div className="device-grid">
              {rows.map((device) => (
                <DeviceCard key={device.code} device={device} now={now} />
              ))}
            </div>
          ) : (
            <EmptyState icon="cpu" title="没有匹配的设备">
              换一个关键词，或把筛选切回「全部」。新硬件接入后会出现在这里。
            </EmptyState>
          )}
        </div>
      </section>

      <Modal
        open={creating}
        title="接入新设备"
        subtitle="设备第一次上报时会自动登记；也可以先在这里建好档案。"
        onClose={() => setCreating(false)}
        footer={
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setCreating(false)}>
              取消
            </button>
            <button className="btn" type="button" onClick={() => void submitCreate()}>
              创建档案
            </button>
          </>
        }
      >
        <form id="dev-form" style={{ display: "grid", gap: "12px" }} onSubmit={(event) => event.preventDefault()}>
          <div className="field">
            <label htmlFor="dev-code">设备编号</label>
            <input
              className="input"
              id="dev-code"
              name="code"
              required
              pattern="[A-Za-z0-9\\-_.]+"
              placeholder="FG-ESP32-007"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <div className="field__hint">与固件 <code>wifi_config.h</code> 里的 DEVICE_CODE 一致。</div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="dev-name">显示名称</label>
              <input
                className="input"
                id="dev-name"
                name="name"
                placeholder="客厅 · 绿萝"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="dev-loc">摆放位置</label>
              <input
                className="input"
                id="dev-loc"
                name="location"
                placeholder="客厅南窗"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
          </div>
          <div className="note" style={{ marginTop: 0 }}>
            <AdminIcon name="info" size={15} />
            <span>新设备默认阈值：湿度 35–70%、土温 12–30℃、光照 500–30000 lx，可在详情页修改。</span>
          </div>
        </form>
      </Modal>
    </>
  );
}
