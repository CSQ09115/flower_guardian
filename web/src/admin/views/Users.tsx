import { useState } from "react";
import { AdminIcon } from "../icons";
import { useAdminData } from "../data/store";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Kpi } from "../ui/Kpi";
import { Modal } from "../../shared/components/Modal";
import { Pager } from "../../shared/components/Pager";
import { dateTime, money, num, ORDER_STATUS } from "../data/util";

/* The list state survives a route change, like the legacy module variables. */
let query = "";
let page = 1;
const PAGE_SIZE = 10;

const initials = (name: string): string => String(name || "?").trim().slice(0, 1).toUpperCase();

export function Users(): JSX.Element {
  const { data } = useAdminData();
  const [, setVersion] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);

  const ordersByUser = new Map<number, typeof data.orders>();
  data.orders.forEach((order) => {
    const list = ordersByUser.get(order.user_id) || [];
    list.push(order);
    ordersByUser.set(order.user_id, list);
  });

  const verified = data.users.filter((u) => u.is_email_verified).length;

  const q = query.toLowerCase();
  const list = data.users.filter(
    (user) =>
      !q ||
      [user.username, user.email].some((value) =>
        String(value).toLowerCase().includes(q),
      ),
  );
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const rerender = (): void => setVersion((version) => version + 1);
  const detail = data.users.find((user) => user.id === detailId);
  const detailOrders = detail
    ? [...(ordersByUser.get(detail.id) || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    : [];
  const detailSpent = detailOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((total, order) => total + order.total_amount, 0);

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>用户管理</h1>
          <p>注册用户与其订单摘要。按后台口径，用户数统计的是所选区间内的新增注册，不是全量用户。</p>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="注册用户" value={num(data.users.length)} meta="当前载入的用户" icon="users" tone="rose" />
        <Kpi label="邮箱已验证" value={num(verified)} meta="is_email_verified = true" icon="check" tone="mint" />
        <Kpi label="有订单用户" value={num(ordersByUser.size)} meta="至少下过一单" icon="receipt" tone="pink" />
        <Kpi
          label="平均订单数"
          value={(data.users.length ? data.orders.length / data.users.length : 0).toFixed(1)}
          meta="订单总数 ÷ 用户数"
          icon="chart"
        />
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <AdminIcon name="search" />
            <input
              className="input"
              id="u-search"
              type="search"
              placeholder="搜索用户名或邮箱"
              value={query}
              aria-label="搜索用户"
              onChange={(event) => {
                query = event.target.value.trim();
                page = 1;
                rerender();
              }}
            />
          </div>
          <span style={{ marginLeft: "auto", color: "var(--muted-2)", fontSize: "11.5px" }}>
            共 {data.users.length} 位
          </span>
        </div>
        <div id="u-body">
          {slice.length ? (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: "820px" }}>
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>邮箱</th>
                    <th>注册时间</th>
                    <th>邮箱验证</th>
                    <th className="num">订单数</th>
                    <th className="num">消费金额</th>
                    <th>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((user) => {
                    const orders = ordersByUser.get(user.id) || [];
                    const spent = orders
                      .filter((order) => order.status !== "cancelled")
                      .reduce((total, order) => total + order.total_amount, 0);
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="cell-main">
                            <span className="avatar">{initials(user.username)}</span>
                            <span>
                              <b>{user.username}</b>
                              <small>
                                #{user.id}
                                {user.bio ? ` · ${user.bio}` : ""}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td className="nowrap" style={{ color: "var(--muted-2)" }}>
                          {dateTime(user.created_at).slice(0, 10)}
                        </td>
                        <td>
                          {user.is_email_verified ? (
                            <Badge tone="ok">已验证</Badge>
                          ) : (
                            <Badge plain>未验证</Badge>
                          )}
                        </td>
                        <td className="num">{orders.length}</td>
                        <td className="num strong">{money(spent)}</td>
                        <td>
                          <button
                            className="btn btn--ghost btn--sm"
                            type="button"
                            data-user={user.id}
                            onClick={() => setDetailId(user.id)}
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
            <EmptyState icon="users" title="没有匹配的用户" size={30}>
              换一个关键词再试。
            </EmptyState>
          )}
        </div>
        <div id="u-pager">
          {list.length ? (
            <Pager
              total={list.length}
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

      <Modal
        open={Boolean(detail)}
        wide
        title={detail?.username ?? ""}
        subtitle={detail ? `注册于 ${dateTime(detail.created_at)} · #${detail.id}` : ""}
        onClose={() => setDetailId(null)}
        footer={
          <button className="btn btn--ghost" type="button" onClick={() => setDetailId(null)}>
            关闭
          </button>
        }
      >
        <div className="grid-2" style={{ gap: "18px" }}>
          <div>
            <div className="fieldset-title">资料</div>
            <dl className="detail-list">
              <div>
                <dt>用户名</dt>
                <dd>{detail?.username}</dd>
              </div>
              <div>
                <dt>邮箱</dt>
                <dd>{detail?.email}</dd>
              </div>
              <div>
                <dt>邮箱验证</dt>
                <dd>{detail?.is_email_verified ? "已验证" : "未验证"}</dd>
              </div>
              <div>
                <dt>角色</dt>
                <dd>{detail?.role || "user"}</dd>
              </div>
              <div>
                <dt>简介</dt>
                <dd>{detail?.bio || "未填写"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <div className="fieldset-title">消费摘要</div>
            <div className="cal-grid">
              <div className="cal-card">
                <small>订单数</small>
                <b>{detailOrders.length}</b>
              </div>
              <div className="cal-card">
                <small>有效消费</small>
                <b style={{ fontSize: "13px" }}>{money(detailSpent)}</b>
              </div>
            </div>
            <div className="field__hint" style={{ marginTop: "8px" }}>
              有效消费不含已取消订单。
            </div>
          </div>
        </div>
        <div className="fieldset-title" style={{ marginTop: "18px" }}>最近订单</div>
        {detailOrders.length ? (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: "480px" }}>
              <thead>
                <tr>
                  <th>订单号</th>
                  <th className="num">金额</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {detailOrders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td className="mono">{order.order_no}</td>
                    <td className="num">{money(order.total_amount)}</td>
                    <td>
                      <Badge tone={ORDER_STATUS[order.status]?.tone}>
                        {ORDER_STATUS[order.status]?.label || order.status}
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
          <div className="empty" style={{ padding: "26px" }}>
            <AdminIcon name="receipt" size={26} />
            <b>还没有订单</b>
          </div>
        )}
      </Modal>
    </>
  );
}
