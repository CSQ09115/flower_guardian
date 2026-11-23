import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminIcon } from "../icons";
import { api } from "../data/api";
import type { ConfigField, ConfigGroup as ConfigGroupData } from "../data/types";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { CONFIG_PAGES } from "../routes";

/* 已知配置分组（与后端 CONFIG_GROUPS 对应）；/config/yolo 单独路由到模型管理页。 */
const VALID_GROUPS = new Set(CONFIG_PAGES.map((page) => page.group));

export function ConfigGroup(): JSX.Element {
  const params = useParams();
  const group = params.group ?? "";
  const [groups, setGroups] = useState<ConfigGroupData[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const current = useMemo(
    () => groups?.find((item) => item.key === group) ?? null,
    [groups, group],
  );

  const load = useCallback(async (): Promise<void> => {
    setError("");
    try {
      const result = await api.systemConfig();
      setGroups(result.groups);
    } catch (err) {
      setError((err as Error).message || "配置读取失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* 切换分组时，把该组当前值填进表单（secret 字段后端只回传 configured）。 */
  useEffect(() => {
    if (!current) return;
    const next: Record<string, string> = {};
    current.fields.forEach((field) => {
      next[field.key] = field.type === "secret" ? "" : field.value ?? "";
    });
    setValues(next);
  }, [current]);

  const save = async (): Promise<void> => {
    if (!current) return;
    setSaving(true);
    try {
      await api.updateSystemConfig(current.key, values);
      await load();
      setError("");
    } catch (err) {
      setError((err as Error).message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!VALID_GROUPS.has(group)) {
    return (
      <>
        <div className="page-head">
          <div className="page-head__main">
            <h1>系统配置</h1>
            <p>没有找到名为 {group} 的配置分组。</p>
          </div>
        </div>
        <div className="card">
          <EmptyState icon="settings" title="分组不存在" size={30}>
            可用分组：{CONFIG_PAGES.map((page) => page.group).join("、")}。YOLO 模型管理在
            <Link to="/config/yolo" style={{ textDecoration: "underline" }}>单独页面</Link>。
          </EmptyState>
        </div>
      </>
    );
  }

  if (error && !groups) {
    return (
      <>
        <div className="page-head">
          <div className="page-head__main">
            <h1>系统配置</h1>
            <p>配置读取失败。</p>
          </div>
        </div>
        <div className="card">
          <div className="note" style={{ margin: "16px", borderColor: "var(--coral)" }}>
            <AdminIcon name="alert" size={15} />
            <span>{error}</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>{current?.title || "系统配置"}</h1>
          <p>{current?.description || "读写 GET/PUT /api/admin/system-config/{group}。"}</p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--ghost" type="button" onClick={() => void load()}>
            <AdminIcon name="refresh" size={15} />
            重新读取
          </button>
          <button className="btn" type="button" disabled={saving || !current} onClick={() => void save()}>
            <AdminIcon name="check" size={15} />
            {saving ? "保存中…" : "保存配置"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="note" style={{ marginBottom: "14px", borderColor: "var(--coral)" }}>
          <AdminIcon name="alert" size={15} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="config-tabs" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
        {CONFIG_PAGES.map((page) => (
          <Link
            key={page.group}
            className={`chip${page.group === group ? " is-active" : ""}`}
            to={`/config/${page.group}`}
            aria-pressed={page.group === group}
          >
            {page.label}
          </Link>
        ))}
        <Link className="chip" to="/config/yolo" aria-pressed={false}>
          YOLO 模型
        </Link>
      </div>

      {current ? (
        <section className="card">
          <div className="card__head">
            <div>
              <h2>{current.title}</h2>
              <p>配置保存在数据库 system_configs 表（键名 {current.key}.*），不写入 .env。</p>
            </div>
            <div className="card__actions">
              <Badge plain>
                {current.fields.filter((field) => field.configured).length}/{current.fields.length} 已配置
              </Badge>
            </div>
          </div>
          <div className="card__body">
            <form
              style={{ display: "grid", gap: "14px", maxWidth: "560px" }}
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              {current.fields.map((field) => (
                <ConfigFieldRow
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ""}
                  onChange={(next) => setValues((prev) => ({ ...prev, [field.key]: next }))}
                />
              ))}
              <div className="field__hint">
                密钥类字段只显示「已配置」状态，不会回显明文；留空保存表示保持原值不变。
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn" type="submit" disabled={saving}>
                  <AdminIcon name="check" size={15} />
                  {saving ? "保存中…" : "保存配置"}
                </button>
                <span className="field__hint" style={{ alignSelf: "center" }}>
                  PUT /api/admin/system-config/{current.key}
                </span>
              </div>
            </form>
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="card__body">
            <div className="empty" style={{ padding: "30px" }}>
              <AdminIcon name="refresh" size={24} />
              <b>配置读取中…</b>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function ConfigFieldRow({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  const isSecret = field.type === "secret";
  const isBool = field.type === "bool";

  if (isBool) {
    const checked = value === "1" || value === "true";
    return (
      <div className="switch-row" key={field.key}>
        <span>
          <b>{field.label}</b>
          <small>
            {field.configured ? "已配置" : "未配置"}
            {field.default ? ` · 默认 ${field.default === "1" ? "开" : "关"}` : ""}
          </small>
        </span>
        <label className="switch">
          <input
            type="checkbox"
            checked={checked}
            aria-label={field.label}
            onChange={(event) => onChange(event.target.checked ? "1" : "0")}
          />
          <i />
        </label>
      </div>
    );
  }

  return (
    <div className="field">
      <label htmlFor={`cfg-${field.key}`}>
        {field.label}
        {isSecret ? (
          field.configured ? (
            <Badge tone="ok">已配置</Badge>
          ) : (
            <Badge plain>未配置</Badge>
          )
        ) : null}
      </label>
      <input
        className="input"
        id={`cfg-${field.key}`}
        type={field.type === "number" ? "number" : isSecret ? "password" : "text"}
        value={value}
        autoComplete="off"
        placeholder={
          isSecret
            ? field.configured
              ? "已配置 · 留空保持不变"
              : "请输入密钥"
            : field.value || field.default || ""
        }
        onChange={(event) => onChange(event.target.value)}
      />
      {!isSecret && field.value ? (
        <div className="field__hint">当前值：{field.value}</div>
      ) : null}
      {field.default && !isSecret && !field.value ? (
        <div className="field__hint">默认值：{field.default}</div>
      ) : null}
    </div>
  );
}
