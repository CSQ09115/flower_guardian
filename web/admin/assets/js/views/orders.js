import { icon } from "../icons.js";
import { badge, openModal, pager, selectField, toast } from "../ui.js";
import { refreshView, saveOrder, store } from "../store.js";
import {
  dateTime, DELIVERY_TYPE, esc, money, num, ORDER_STATUS, sum,
} from "../util.js";

let query = "";
let status = "all";
let page = 1;
const PAGE_SIZE = 8;

export async function render(root) {
  const orders = store.data.orders;
  const paid = orders.filter((o) => o.status !== "cancelled");
  const pending = orders.filter((o) => o.status === "pending").length;
  const completed = orders.filter((o) => o.status === "completed").length;

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <h1>订单管理</h1>
        <p>查看订单主体与订单项，推进状态。金额等于各订单项小计之和，取消订单仍计入统计数据。</p>
      </div>
      <div class="page-head__actions"><a class="btn btn--ghost" href="#/stats">${icon("chart", { size: 15 })}数据统计</a></div>
    </div>

    <div class="kpis">
      ${kpi("订单总数", num(orders.length), "含已取消", "receipt", "rose")}
      ${kpi("待确认", num(pending), "status = pending", "clock", pending ? "pink" : "")}
      ${kpi("有效订单金额", money(sum(paid, (o) => o.total_amount)), "不含已取消订单", "chart", "mint")}
      ${kpi("已完成", num(completed), "status = completed", "check")}
    </div>

    <section class="card">
      <div class="toolbar">
        <div class="search">${icon("search")}
          <input class="input" id="o-search" type="search" placeholder="搜索订单号、联系人或手机号" value="${esc(query)}" aria-label="搜索订单">
        </div>
        <select class="select" id="o-status" aria-label="按订单状态筛选">
          <option value="all">全部状态</option>
          ${Object.entries(ORDER_STATUS).map(([key, meta]) => `<option value="${key}"${status === key ? " selected" : ""}>${meta.label}</option>`).join("")}
        </select>
        <span style="margin-left:auto;color:var(--muted-2);font-size:11.5px">共 ${orders.length} 笔</span>
      </div>
      <div id="o-body"></div>
      <div id="o-pager"></div>
    </section>`;

  const body = root.querySelector("#o-body");
  const pagerEl = root.querySelector("#o-pager");
  const search = root.querySelector("#o-search");

  const paint = () => {
    const list = filtered();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const view = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    body.innerHTML = view.length ? `<div class="table-wrap"><table class="table" style="min-width:900px">
      <thead><tr><th>订单号</th><th>用户</th><th class="num">商品数</th><th class="num">金额</th><th>配送</th><th>状态</th><th>下单时间</th><th><span class="sr-only">操作</span></th></tr></thead>
      <tbody>${view.map(row).join("")}</tbody>
    </table></div>` : `<div class="empty">${icon("receipt", { size: 30 })}<b>没有匹配的订单</b><p>换一个关键词，或把状态切回「全部状态」。</p></div>`;
    pagerEl.innerHTML = list.length ? pager(list.length, page, PAGE_SIZE) : "";
    pagerEl.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => { page = Number(btn.dataset.page); paint(); });
    });
    body.querySelectorAll("[data-order]").forEach((btn) => {
      btn.addEventListener("click", () => openDetail(store.data.orders.find((o) => o.id === Number(btn.dataset.order))));
    });
  };

  search.addEventListener("input", () => { query = search.value.trim(); page = 1; paint(); });
  root.querySelector("#o-status").addEventListener("change", (event) => {
    status = event.target.value;
    page = 1;
    paint();
  });

  paint();
}

function filtered() {
  const q = query.toLowerCase();
  return store.data.orders.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    if (!q) return true;
    const user = store.data.users.find((u) => u.id === order.user_id);
    return [order.order_no, order.contact_name, order.contact_phone, user?.username]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });
}

function row(order) {
  const user = store.data.users.find((u) => u.id === order.user_id);
  const meta = ORDER_STATUS[order.status] || { label: order.status, tone: "" };
  return `<tr>
    <td><span class="mono">${esc(order.order_no)}</span><div class="field__hint">#${order.id}</div></td>
    <td><b class="strong" style="font-size:12.5px">${esc(user?.username || order.contact_name || "—")}</b><div class="field__hint">${esc(order.contact_phone || "")}</div></td>
    <td class="num">${order.items.length}</td>
    <td class="num strong">${money(order.total_amount)}</td>
    <td>${DELIVERY_TYPE[order.delivery_type] || order.delivery_type || "—"}</td>
    <td>${badge(meta.label, meta.tone)}</td>
    <td class="nowrap" style="color:var(--muted-2)">${dateTime(order.created_at).slice(5, 16)}</td>
    <td><button class="btn btn--ghost btn--sm" type="button" data-order="${order.id}">详情</button></td>
  </tr>`;
}

function kpi(label, value, meta, iconName, tone = "") {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}">
    <div class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(iconName, { size: 15 })}</span></div>
    <div class="kpi__value">${value}</div><div class="kpi__meta">${meta}</div>
  </div>`;
}

function openDetail(order) {
  const user = store.data.users.find((u) => u.id === order.user_id);
  const { close } = openModal({
    title: `订单 ${order.order_no}`,
    subtitle: `${dateTime(order.created_at)} · ${DELIVERY_TYPE[order.delivery_type] || order.delivery_type || "—"}`,
    wide: true,
    body: `
      <div class="grid-2" style="gap:18px">
        <div>
          <div class="fieldset-title">订单项</div>
          <div class="order-items">
            ${order.items.map((item) => `<div class="order-item">
              <div><b>${esc(item.product_name)}</b><small>${money(item.unit_price)} × ${item.quantity}</small></div>
              <span class="num">${money(item.subtotal)}</span>
            </div>`).join("")}
          </div>
          <div style="display:flex;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
            <span style="color:var(--muted);font-size:12px">订单总额</span>
            <b style="margin-left:auto;font-size:18px;color:var(--green-2);font-variant-numeric:tabular-nums">${money(order.total_amount)}</b>
          </div>
        </div>
        <div>
          <div class="fieldset-title">收件与用户</div>
          <dl class="detail-list">
            <div><dt>用户</dt><dd>${esc(user?.username || "—")}</dd></div>
            <div><dt>邮箱</dt><dd>${esc(user?.email || "—")}</dd></div>
            <div><dt>联系人</dt><dd>${esc(order.contact_name || "—")} ${esc(order.contact_phone || "")}</dd></div>
            <div><dt>地址</dt><dd>${esc(order.delivery_address || "—")}</dd></div>
            <div><dt>备注</dt><dd>${esc(order.remark || "无")}</dd></div>
            <div><dt>更新时间</dt><dd>${dateTime(order.updated_at)}</dd></div>
          </dl>
        </div>
      </div>
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
        ${selectField({
          label: "订单状态", name: "orderStatus", value: order.status,
          options: Object.entries(ORDER_STATUS).map(([key, meta]) => ({ value: key, label: meta.label })),
          hint: "状态流转没有强制顺序，按实际履约情况选择即可。",
        })}
      </div>`,
    footer: `<button class="btn btn--ghost" type="button" data-close>关闭</button>
      <button class="btn" type="button" id="o-save">${icon("check", { size: 15 })}保存状态</button>`,
    onMount(dialog) {
      dialog.querySelector("#o-save").addEventListener("click", async () => {
        const next = dialog.querySelector("#f-orderStatus").value;
        try {
          await saveOrder(order.id, { status: next });
          close();
        } catch (error) {
          toast(error.message, "error");
        }
      });
    },
  });
  void refreshView;
  void num;
}
