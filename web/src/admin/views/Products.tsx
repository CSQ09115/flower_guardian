import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminIcon } from "../icons";
import { useAdminData } from "../data/store";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Kpi } from "../ui/Kpi";
import { ProductForm } from "../ui/ProductForm";
import type { ProductFormValue } from "../ui/ProductForm";
import { Modal } from "../../shared/components/Modal";
import { Pager } from "../../shared/components/Pager";
import { dateTime, money, num, PRODUCT_STATUS } from "../data/util";
import type { Product } from "../data/types";

/* The list state survives a route change, like the legacy module variables. */
let query = "";
let status: "all" | "active" | "inactive" = "all";
let page = 1;
const PAGE_SIZE = 8;

export function Products(): JSX.Element {
  const { data, toast, saveProduct, removeProduct } = useAdminData();
  const [, setVersion] = useState(0);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const active = data.products.filter((p) => p.status === "active").length;
  const lowStock = data.products.filter((p) => p.stock <= 20).length;

  const q = query.toLowerCase();
  const rows = data.products.filter((product) => {
    if (status !== "all" && product.status !== status) return false;
    if (!q) return true;
    return [product.name, product.description]
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
          <h1>商品管理</h1>
          <p>维护商城在售商品：价格、库存、关联植物与上下架状态。库存 ≤ 20 时在列表里标黄提醒。</p>
        </div>
        <div className="page-head__actions">
          <button
            className="btn"
            type="button"
            id="p-new"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <AdminIcon name="plus" size={15} />
            新建商品
          </button>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="商品总数" value={num(data.products.length)} meta="含已下架" icon="box" tone="rose" />
        <Kpi label="在售" value={num(active)} meta="status = active" icon="check" tone="mint" />
        <Kpi
          label="库存偏低"
          value={num(lowStock)}
          meta="库存 ≤ 20"
          icon="alert"
          tone={lowStock ? "pink" : ""}
        />
        <Kpi
          label="关联植物"
          value={num(data.products.filter((p) => p.plant_id).length)}
          meta="已绑定植物库条目"
          icon="leaf"
          tone="pink"
        />
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <AdminIcon name="search" />
            <input
              className="input"
              id="p-search"
              type="search"
              placeholder="搜索商品名称或描述"
              value={query}
              aria-label="搜索商品"
              onChange={(event) => {
                query = event.target.value.trim();
                page = 1;
                rerender();
              }}
            />
          </div>
          <div className="chips" role="group" aria-label="按状态筛选">
            {(
              [
                ["all", "全部", data.products.length],
                ["active", "在售", active],
                ["inactive", "已下架", data.products.length - active],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                className={`chip${status === key ? " is-active" : ""}`}
                type="button"
                data-status={key}
                aria-pressed={status === key}
                onClick={() => {
                  status = key;
                  page = 1;
                  rerender();
                }}
              >
                {label}
                <span className="chip__count">{count}</span>
              </button>
            ))}
          </div>
        </div>
        <div id="p-body">
          {slice.length ? (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: "880px" }}>
                <thead>
                  <tr>
                    <th>商品</th>
                    <th className="num">价格</th>
                    <th className="num">库存</th>
                    <th>关联植物</th>
                    <th>状态</th>
                    <th>更新时间</th>
                    <th>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((product) => {
                    const plant = data.plants.find((p) => p.id === product.plant_id);
                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="cell-main">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt=""
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="thumb-fallback">{product.name.slice(0, 1)}</span>
                            )}
                            <span>
                              <b>{product.name}</b>
                              <small>#{product.id}</small>
                            </span>
                          </div>
                        </td>
                        <td className="num strong">{money(product.price)}</td>
                        <td
                          className="num"
                          style={
                            product.stock <= 20
                              ? { color: "var(--coral-ink)", fontWeight: 600 }
                              : undefined
                          }
                        >
                          {num(product.stock)}
                        </td>
                        <td>
                          {plant ? (
                            <Link className="link" to="/plants">
                              {plant.name}
                            </Link>
                          ) : (
                            <span style={{ color: "var(--muted-2)" }}>未关联</span>
                          )}
                        </td>
                        <td>
                          <Badge tone={PRODUCT_STATUS[product.status]?.tone}>
                            {PRODUCT_STATUS[product.status]?.label || product.status}
                          </Badge>
                        </td>
                        <td className="nowrap" style={{ color: "var(--muted-2)" }}>
                          {dateTime(product.updated_at).slice(0, 10)}
                        </td>
                        <td className="nowrap">
                          <button
                            className="icon-btn"
                            type="button"
                            data-edit={product.id}
                            aria-label={`编辑 ${product.name}`}
                            title="编辑"
                            onClick={() => {
                              setEditing(product);
                              setFormOpen(true);
                            }}
                          >
                            <AdminIcon name="edit" size={15} />
                          </button>
                          <button
                            className="icon-btn icon-btn--danger"
                            type="button"
                            data-del={product.id}
                            aria-label={`删除 ${product.name}`}
                            title="删除"
                            onClick={() => setDeleting(product)}
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
            <EmptyState icon="box" title="没有匹配的商品" size={30}>
              换一个关键词，或切换状态筛选。
            </EmptyState>
          )}
        </div>
        <div id="p-pager">
          {rows.length ? (
            <Pager total={rows.length} page={current} size={PAGE_SIZE} onPage={(next) => {
              page = next;
              rerender();
            }} />
          ) : null}
        </div>
      </section>

      {formOpen ? (
        <ProductForm
          key={editing?.id ?? "new"}
          open={formOpen}
          product={editing}
          plants={data.plants}
          onClose={() => setFormOpen(false)}
          onError={(message) => toast(message, "error")}
          onSave={async (value: ProductFormValue) => {
            try {
              await saveProduct(
                {
                  name: value.name,
                  description: value.description ?? "",
                  price: value.price,
                  stock: value.stock,
                  image_url: value.image_url,
                  plant_id: value.plant_id,
                  status: value.status,
                },
                editing?.id,
              );
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
        title="删除商品"
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
                const product = deleting;
                if (!product) return;
                setDeleting(null);
                try {
                  await removeProduct(product.id);
                  toast("商品已删除");
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
          确定删除「{deleting?.name}」？历史订单里的商品名称与金额不会受影响。
        </p>
      </Modal>
    </>
  );
}
