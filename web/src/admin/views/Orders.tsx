import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminIcon } from "../icons";
import { useAdminData } from "../data/store";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Kpi } from "../ui/Kpi";
import { OrderDetail } from "../ui/OrderDetail";
import { Pager } from "../../shared/components/Pager";
import { dateTime, DELIVERY_TYPE, money, num, ORDER_STATUS, sum } from "../data/util";
import type { OrderStatus } from "../data/types";

/* The list state survives a route change, like the legacy module variables. */
let query = "";
let status: "all" | OrderStatus = "all";
let page = 1;
const PAGE_SIZE = 8;

export function Orders(): JSX.Element {
  const { data, toast, saveOrder } = useAdminData();
  const [, setVersion] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);

  const orders = data.orders;
  const paid = orders.filter((o) => o.status !== "cancelled");
  const pending = orders.filter((o) => o.status === "pending").length;
  const completed = orders.filter((o) => o.status === "completed").length;

  const q = query.toLowerCase();
  const rows = orders.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    if (!q) return true;
    const user = data.users.find((u) => u.id === order.user_id);
    return [order.order_no, order.contact_name, order.contact_phone, user?.username]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const rerender = (): void => setVersion((version) => version + 1);
  const detail = orders.find((order) => order.id === detailId);

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>订单管理</h1>
          <p>查看订单主体与订单项，推进状态。金额等于各订单项小计之和，取消订单仍计入统计数据。</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--ghost" to="/stats">
            <AdminIcon name="chart" size={15} />
            数据统计
          </Link>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="订单总数" value={num(orders.length)} meta="含已取消" icon="receipt" tone="rose" />
        <Kpi
          label="待确认"
          value={num(pending)}
          meta="status = pending"
          icon="clock"
          tone={pending ? "pink" : ""}
        />
        <Kpi
          label="有效订单金额"
          value={money(sum(paid, (o) => o.total_amount))}
          meta="不含已取消订单"
          icon="chart"
          tone="mint"
        />
        <Kpi label="已完成" value={num(completed)} meta="status = completed" icon="check" />
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <AdminIcon name="search" />
            <input
              className="input"
              id="o-search"
              type="search"
              placeholder="搜索订单号、联系人或手机号"
              value={query}
              aria-label="搜索订单"
              onChange={(event) => {
                query = event.target.value.trim();
                page = 1;
                rerender();
              }}
            />
          </div>
          <select
            className="select"
            id="o-status"
            aria-label="按订单状态筛选"
            value={status}
            onChange={(event) => {
              status = event.target.value as "all" | OrderStatus;
              page = 1;
              rerender();
            }}
          >
            <option value="all">全部状态</option>
            {Object.entries(ORDER_STATUS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
          <span style={{ marginLeft: "auto", color: "var(--muted-2)", fontSize: "11.5px" }}>
            共 {orders.length} 笔
          </span>
        </div>
        <div id="o-body">
          {slice.length ? (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>用户</th>
                    <th className="num">商品数</th>
                    <th className="num">金额</th>
                    <th>配送</th>
                    <th>状态</th>
                    <th>下单时间</th>
                    <th>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((order) => {
                    const user = data.users.find((u) => u.id === order.user_id);
                    const meta = ORDER_STATUS[order.status] || { label: order.status, tone: "" };
                    return (
                      <tr key={order.id}>
                        <td>
                          <span className="mono">{order.order_no}</span>
                          <div className="field__hint">#{order.id}</div>
                        </td>
                        <td>
                          <b className="strong" style={{ fontSize: "12.5px" }}>
                            {user?.username || order.contact_name || "—"}
                          </b>
                          <div className="field__hint">{order.contact_phone || ""}</div>
                        </td>
                        <td className="num">{order.items.length}</td>
                        <td className="num strong">{money(order.total_amount)}</td>
                        <td>{DELIVERY_TYPE[order.delivery_type] || order.delivery_type || "—"}</td>
                        <td>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="nowrap" style={{ color: "var(--muted-2)" }}>
                          {dateTime(order.created_at).slice(5, 16)}
                        </td>
                        <td>
                          <button
                            className="btn btn--ghost btn--sm"
                            type="button"
                            data-order={order.id}
                            onClick={() => setDetailId(order.id)}
                          >
                            详情
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="receipt" title="没有匹配的订单" size={30}>
              换一个关键词，或把状态切回「全部状态」。
            </EmptyState>
          )}
        </div>
        <div id="o-pager">
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

      <OrderDetail
        key={detail?.id ?? "none"}
        order={detail ?? null}
        user={data.users.find((u) => u.id === detail?.user_id)}
        onClose={() => setDetailId(null)}
        onSave={async (next) => {
          if (!detail) return;
          try {
            await saveOrder(detail.id, { status: next });
            setDetailId(null);
          } catch (error) {
            toast((error as Error).message, "error");
          }
        }}
      />
    </>
  );
}
