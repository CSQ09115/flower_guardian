import { useState } from "react";
import { AdminIcon } from "../icons";
import { useAdminData } from "../data/store";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Kpi } from "../ui/Kpi";
import { PlantForm } from "../ui/PlantForm";
import { Modal } from "../../shared/components/Modal";
import { Pager } from "../../shared/components/Pager";
import { CARE_LEVEL, num } from "../data/util";
import { mediaUrl } from "../data/api";
import type { Plant, PlantInput } from "../data/types";

/* The list state survives a route change, like the legacy module variables. */
let query = "";
let category = "all";
let level: "all" | "1" | "2" | "3" = "all";
let page = 1;
const PAGE_SIZE = 8;

/* Live rows carry `/static/plants/<name>.jpg`, served by the API origin; demo
   rows carry `/assets/…` and pass through. A broken URL falls back to the
   first character instead of leaving an empty cell. */
function PlantThumb({ plant }: { plant: Plant }): JSX.Element {
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(plant.image_url);
  if (!src || failed) {
    return <span className="thumb-fallback">{plant.name.slice(0, 1)}</span>;
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

export function Plants(): JSX.Element {
  const { data, toast, savePlant, removePlant, batchRemove } = useAdminData();
  const [, setVersion] = useState(0);
  const [editing, setEditing] = useState<Plant | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Plant | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const plants = data.plants;
  const categories = [
    ...new Set(plants.map((p) => p.category).filter((value): value is string => Boolean(value))),
  ];
  const easy = plants.filter((p) => p.care_level === 1).length;
  const mapped = plants.filter((p) => p.yolo_class_id != null).length;

  const q = query.toLowerCase();
  const rows = plants.filter((plant) => {
    if (category !== "all" && plant.category !== category) return false;
    if (level !== "all" && String(plant.care_level) !== level) return false;
    if (!q) return true;
    return [plant.name, plant.scientific_name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const rerender = (): void => setVersion((version) => version + 1);

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>植物库</h1>
          <p>识别结果背后的养护知识：光照、浇水、温度与常见错误。YOLO 类别 ID 对应识别模型的输出类别。</p>
        </div>
        <div className="page-head__actions">
          <button
            className="btn btn--coral"
            type="button"
            disabled={!selected.size}
            onClick={() => setBulkConfirm(true)}
          >
            <AdminIcon name="trash" size={15} />
            批量删除{selected.size ? `（${selected.size}）` : ""}
          </button>
          <button
            className="btn"
            type="button"
            id="pl-new"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <AdminIcon name="plus" size={15} />
            新建条目
          </button>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="条目总数" value={num(plants.length)} meta="植物库全部条目" icon="leaf" tone="rose" />
        <Kpi label="省心级" value={num(easy)} meta="care_level = 1" icon="check" tone="mint" />
        <Kpi
          label="需留意"
          value={num(plants.length - easy)}
          meta="care_level ≥ 2"
          icon="alert"
          tone={plants.length - easy ? "pink" : ""}
        />
        <Kpi label="已映射类别" value={num(mapped)} meta="有 YOLO 类别 ID" icon="cpu" tone="pink" />
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <AdminIcon name="search" />
            <input
              className="input"
              id="pl-search"
              type="search"
              placeholder="搜索中文名或学名"
              value={query}
              aria-label="搜索植物"
              onChange={(event) => {
                query = event.target.value.trim();
                page = 1;
                rerender();
              }}
            />
          </div>
          <select
            className="select"
            id="pl-cat"
            aria-label="按分类筛选"
            value={category}
            onChange={(event) => {
              category = event.target.value;
              page = 1;
              rerender();
            }}
          >
            <option value="all">全部分类</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="chips" role="group" aria-label="按养护难度筛选">
            {(["all", "1", "2", "3"] as const).map((value) => (
              <button
                key={value}
                className={`chip${level === value ? " is-active" : ""}`}
                type="button"
                data-level={value}
                aria-pressed={level === value}
                onClick={() => {
                  level = value;
                  page = 1;
                  rerender();
                }}
              >
                {value === "all" ? "全部难度" : CARE_LEVEL[Number(value)].label}
              </button>
            ))}
          </div>
        </div>
        <div id="pl-body">
          {slice.length ? (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: "940px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "36px" }}>
                      <input
                        type="checkbox"
                        aria-label="全选本页"
                        checked={slice.length > 0 && slice.every((plant) => selected.has(plant.id))}
                        onChange={(event) => {
                          const next = new Set(selected);
                          slice.forEach((plant) =>
                            event.target.checked ? next.add(plant.id) : next.delete(plant.id),
                          );
                          setSelected(next);
                        }}
                      />
                    </th>
                    <th>植物</th>
                    <th>分类</th>
                    <th>养护难度</th>
                    <th>光照</th>
                    <th>浇水</th>
                    <th className="num">YOLO ID</th>
                    <th>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((plant) => {
                    const care = CARE_LEVEL[plant.care_level] || CARE_LEVEL[1];
                    return (
                      <tr key={plant.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`选择 ${plant.name}`}
                            checked={selected.has(plant.id)}
                            onChange={(event) => {
                              const next = new Set(selected);
                              if (event.target.checked) next.add(plant.id);
                              else next.delete(plant.id);
                              setSelected(next);
                            }}
                          />
                        </td>
                        <td>
                          <div className="cell-main">
                            <PlantThumb plant={plant} />
                            <span>
                              <b>{plant.name}</b>
                              <small>
                                {plant.scientific_name || "—"} · #{plant.id}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>{plant.category || "—"}</td>
                        <td>
                          <Badge tone={care.tone}>{care.label}</Badge>
                        </td>
                        <td style={{ maxWidth: "170px" }}>{plant.light_requirement || "—"}</td>
                        <td style={{ maxWidth: "190px" }}>{plant.water_requirement || "—"}</td>
                        <td className="num mono">{plant.yolo_class_id ?? "—"}</td>
                        <td className="nowrap">
                          <button
                            className="icon-btn"
                            type="button"
                            data-edit={plant.id}
                            aria-label={`编辑 ${plant.name}`}
                            title="编辑"
                            onClick={() => {
                              setEditing(plant);
                              setFormOpen(true);
                            }}
                          >
                            <AdminIcon name="edit" size={15} />
                          </button>
                          <button
                            className="icon-btn icon-btn--danger"
                            type="button"
                            data-del={plant.id}
                            aria-label={`删除 ${plant.name}`}
                            title="删除"
                            onClick={() => setDeleting(plant)}
                          >
                            <AdminIcon name="trash" size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="leaf" title="没有匹配的植物" size={30}>
              换一个关键词或筛选条件。
            </EmptyState>
          )}
        </div>
        <div id="pl-pager">
          {rows.length ? (
            <Pager
              total={rows.length}
              page={current}
              size={PAGE_SIZE}
              onPage={(next) => {
                page = next;
                rerender();
              }}
            />
          ) : null}
        </div>
      </section>

      {formOpen ? (
        <PlantForm
          key={editing?.id ?? "new"}
          open={formOpen}
          plant={editing}
          onClose={() => setFormOpen(false)}
          onError={(message) => toast(message, "error")}
          onSave={async (value: PlantInput) => {
            try {
              await savePlant(value, editing?.id);
              setFormOpen(false);
              if (!editing) page = 1;
              rerender();
            } catch (error) {
              toast((error as Error).message, "error");
            }
          }}
        />
      ) : null}

      <Modal
        open={Boolean(deleting)}
        title="删除植物条目"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button
              className="btn btn--coral"
              type="button"
              onClick={async () => {
                const plant = deleting;
                if (!plant) return;
                setDeleting(null);
                try {
                  await removePlant(plant.id);
                  toast("植物条目已删除");
                } catch (error) {
                  toast((error as Error).message, "error");
                }
              }}
            >
              删除
            </button>
          </>
        }
      >
        <p style={{ color: "var(--muted)", fontSize: "13px" }}>
          确定删除「{deleting?.name}」？已绑定该植物的商品会失去关联显示。
        </p>
      </Modal>

      <Modal
        open={bulkConfirm}
        title="批量删除植物条目"
        subtitle={`将调用 POST /api/admin/plants/batch-delete 删除 ${selected.size} 条条目。`}
        onClose={() => setBulkConfirm(false)}
        footer={
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setBulkConfirm(false)}>
              取消
            </button>
            <button
              className="btn btn--coral"
              type="button"
              disabled={bulkBusy}
              onClick={async () => {
                setBulkBusy(true);
                try {
                  await batchRemove("plants", [...selected]);
                  setSelected(new Set());
                  setBulkConfirm(false);
                  page = 1;
                  rerender();
                } catch (error) {
                  toast((error as Error).message, "error");
                } finally {
                  setBulkBusy(false);
                }
              }}
            >
              确认删除
            </button>
          </>
        }
      >
        <p style={{ color: "var(--muted)", fontSize: "13px" }}>
          选中的 {selected.size} 个植物条目会被永久删除（含关联展示），此操作不可撤销。
        </p>
      </Modal>
    </>
  );
}
