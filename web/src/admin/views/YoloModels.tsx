import { useCallback, useEffect, useRef, useState } from "react";
import { AdminIcon } from "../icons";
import { api } from "../data/api";
import type { YoloSummary } from "../data/types";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { dateTime, num } from "../data/util";

const KINDS: { kind: "plant" | "pest"; label: string; hint: string }[] = [
  { kind: "plant", label: "植物识别模型", hint: "植物识别服务当前加载的 .pt 权重" },
  { kind: "pest", label: "病虫害识别模型", hint: "病虫害识别服务当前加载的 .pt 权重" },
];

const humanSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${num(bytes)} B`;

export function YoloModels(): JSX.Element {
  const [data, setData] = useState<{ plant: YoloSummary; pest: YoloSummary } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [uploadKind, setUploadKind] = useState<"plant" | "pest" | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError("");
    try {
      setData(await api.yoloModels());
    } catch (err) {
      setError((err as Error).message || "模型列表读取失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async (kind: "plant" | "pest", filename: string): Promise<void> => {
    setBusy(`${kind}:${filename}`);
    try {
      await api.setActiveYoloModel(kind, filename);
      await load();
      setError("");
    } catch (err) {
      setError((err as Error).message || "启用模型失败");
    } finally {
      setBusy("");
    }
  };

  const remove = async (kind: "plant" | "pest", filename: string): Promise<void> => {
    if (!window.confirm(`确定删除模型「${filename}」吗？此操作不可恢复。`)) return;
    setBusy(`${kind}:${filename}`);
    try {
      await api.deleteYoloModel(kind, filename);
      await load();
      setError("");
    } catch (err) {
      setError((err as Error).message || "删除模型失败");
    } finally {
      setBusy("");
    }
  };

  const onPickFile = async (file: File | null): Promise<void> => {
    const kind = uploadKind;
    setUploadKind(null);
    if (!file || !kind) return;
    setBusy(`${kind}:upload`);
    try {
      await api.uploadYoloModel(kind, file);
      await load();
      setError("");
    } catch (err) {
      setError((err as Error).message || "上传失败");
    } finally {
      setBusy("");
    }
  };

  /* uploadKind 被按钮设置后，下一帧打开系统文件选择框。 */
  useEffect(() => {
    if (uploadKind) fileRef.current?.click();
  }, [uploadKind]);

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>YOLO 模型</h1>
          <p>
            植物识别与病虫害识别使用的模型权重，来自 GET /api/admin/system-config/yolo/models。切换模型立即生效，无需重启后端。
          </p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--ghost" type="button" onClick={() => void load()}>
            <AdminIcon name="refresh" size={15} />
            刷新
          </button>
          <button className="btn" type="button" onClick={() => setUploadKind("plant")}>
            <AdminIcon name="plus" size={15} />
            上传植物模型
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => setUploadKind("pest")}
          >
            <AdminIcon name="plus" size={15} />
            上传病虫害模型
          </button>
        </div>
      </div>

      {error ? (
        <div className="note" style={{ marginBottom: "14px", borderColor: "var(--coral)" }}>
          <AdminIcon name="alert" size={15} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid-2" style={{ alignItems: "start" }}>
        {KINDS.map(({ kind, label, hint }) => {
          const summary = data?.[kind];
          const models = summary?.models ?? [];
          return (
            <section className="card" key={kind} aria-labelledby={`yolo-${kind}`}>
              <div className="card__head">
                <div>
                  <h2 id={`yolo-${kind}`}>{label}</h2>
                  <p>{hint}</p>
                </div>
                <div className="card__actions">
                  <Badge tone={summary?.active ? "ok" : "warn"}>
                    {summary?.active ? "已加载" : "使用默认"}
                  </Badge>
                </div>
              </div>
              <div className="card__body card__body--flush">
                {models.length ? (
                  <div className="table-wrap">
                    <table className="table" style={{ minWidth: "520px" }}>
                      <thead>
                        <tr>
                          <th>模型文件</th>
                          <th className="num">大小</th>
                          <th>更新时间</th>
                          <th>状态</th>
                          <th>
                            <span className="sr-only">操作</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {models.map((model) => (
                          <tr key={model.filename}>
                            <td>
                              <div className="cell-main">
                                <AdminIcon name="box" size={15} />
                                <span>
                                  <b>{model.filename}</b>
                                  <small>{model.builtin ? "内置默认模型" : "上传模型"}</small>
                                </span>
                              </div>
                            </td>
                            <td className="num">{humanSize(model.size)}</td>
                            <td className="nowrap" style={{ color: "var(--muted-2)" }}>
                              {model.uploaded_at ? dateTime(model.uploaded_at) : "—"}
                            </td>
                            <td>
                              {model.active ? (
                                <Badge tone="ok">使用中</Badge>
                              ) : (
                                <Badge plain>备用</Badge>
                              )}
                            </td>
                            <td className="nowrap">
                              {model.active ? null : (
                                <button
                                  className="btn btn--ghost btn--sm"
                                  type="button"
                                  disabled={busy === `${kind}:${model.filename}`}
                                  onClick={() => void activate(kind, model.filename)}
                                >
                                  <AdminIcon name="power" size={13} />
                                  启用
                                </button>
                              )}
                              {!model.builtin ? (
                                <button
                                  className="btn btn--ghost btn--sm icon-btn--danger"
                                  type="button"
                                  style={{ marginLeft: "6px" }}
                                  disabled={busy === `${kind}:${model.filename}`}
                                  onClick={() => void remove(kind, model.filename)}
                                >
                                  <AdminIcon name="trash" size={13} />
                                  删除
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon="box" title="没有可用模型" size={30}>
                    模型目录为空或读取失败；默认权重缺失时识别服务不可用。
                  </EmptyState>
                )}
              </div>
              <div className="card__body" style={{ borderTop: "1px solid var(--line)" }}>
                <div className="field__hint">
                  允许格式：{summary?.allowed_exts?.join("、") || ".pt"} · 上传大小上限{" "}
                  {num((summary?.max_size ?? 0) / 1024 / 1024)} MB · 模型目录 models/uploads/{kind}/
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pt,.onnx"
        style={{ display: "none" }}
        onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)}
      />
    </>
  );
}
