import { icon } from "../icons.js";
import { badge, initials, openModal, pager } from "../ui.js";
import { store } from "../store.js";
import { dateTime, esc, money, num, ORDER_STATUS } from "../util.js";

let query = "";
let page = 1;
const PAGE_SIZE = 10;

export async function render(root) {
  const ordersByUser = new Map();
  store.data.orders.forEach((order) => {
    const list = ordersByUser.get(order.user_id) || [];
    list.push(order);
    ordersByUser.set(order.user_id, list);
  });

  const verified = store.data.users.filter((u) => u.is_email_verified).length;

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <h1>用户管理</h1>
        <p>注册用户与其订单摘要。按后台口径，用户数统计的是所选区间内的新增注册，不是全量用户。</p>
      </div>
    </div>

    <div class="kpis">
      ${kpi("注册用户", num(store.data.users.length), "当前载入的用户", "users", "rose")}
      ${kpi("邮箱已验证", num(verified), "is_email_verified = true", "check", "mint")}
      ${kpi("有订单用户", num([...ordersByUser.keys()].length), "至少下过一单", "receipt", "pink")}
      ${kpi("平均订单数", (store.data.users.length ? store.data.orders.length / store.data.users.length : 0).toFixed(1), "订单总数 ÷ 用户数", "chart")}
    </div>

    <section class="card">
      <div class="toolbar">
        <div class="search">${icon("search")}
          <input class="input" id="u-search" type="search" placeholder="搜索用户名或邮箱" value="${esc(query)}" aria-label="搜索用户">
        </div>
        <span style="margin-left:auto;color:var(--muted-2);font-size:11.5px">共 ${store.data.users.length} 位</span>
      </div>
      <div id="u-body"></div>
      <div id="u-pager"></div>
    </section>`;

  const body = root.querySelector("#u-body");
  const pagerEl = root.querySelector("#u-pager");
  const search = root.querySelector("#u-search");

  const paint = () => {
    const q = query.toLowerCase();
    const list = store.data.users.filter((u) => !q || [u.username, u.email].some((v) => String(v).toLowerCase().includes(q)));
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const view = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    body.innerHTML = view.length ? `<div class="table-wrap"><table class="table" style="min-width:820px">
      <thead><tr><th>用户</th><th>邮箱</th><th>注册时间</th><th>邮箱验证</th><th class="num">订单数</th><th class="num">消费金额</th><th><span class="sr-only">操作</span></th></tr></thead>
      <tbody>${view.map((user) => {
        const orders = ordersByUser.get(user.id) || [];
        const spent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total_amount, 0);
        return `<tr>
          <td><div class="cell-main"><span class="avatar">${esc(initials(user.username))}</span><span><b>${esc(user.username)}</b><small>#${user.id}${user.bio ? ` · ${esc(user.bio)}` : ""}</small></span></div></td>
          <td>${esc(user.email)}</td>
          <td class="nowrap" style="color:var(--muted-2)">${dateTime(user.created_at).slice(0, 10)}</td>
          <td>${user.is_email_verified ? badge("已验证", "ok") : badge("未验证", "plain")}</td>
          <td class="num">${orders.length}</td>
          <td class="num strong">${money(spent)}</td>
          <td><button class="btn btn--ghost btn--sm" type="button" data-user="${user.id}">详情</button></td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>` : `<div class="empty">${icon("users", { size: 30 })}<b>没有匹配的用户</b><p>换一个关键词再试。</p></div>`;
    pagerEl.innerHTML = list.length ? pager(list.length, page, PAGE_SIZE) : "";
    pagerEl.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => { page = Number(btn.dataset.page); paint(); });
    });
    body.querySelectorAll("[data-user]").forEach((btn) => {
      btn.addEventListener("click", () => openUser(store.data.users.find((u) => u.id === Number(btn.dataset.user)), ordersByUser));
    });
  };

  search.addEventListener("input", () => { query = search.value.trim(); page = 1; paint(); });
  paint();
}

function kpi(label, value, meta, iconName, tone = "") {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}">
    <div class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(iconName, { size: 15 })}</span></div>
    <div class="kpi__value">${value}</div><div class="kpi__meta">${meta}</div>
  </div>`;
}

function openUser(user, ordersByUser) {
  const orders = [...(ordersByUser.get(user.id) || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const spent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total_amount, 0);
  openModal({
    title: user.username,
    subtitle: `注册于 ${dateTime(user.created_at)} · #${user.id}`,
    wide: true,
    body: `
      <div class="grid-2" style="gap:18px">
        <div>
          <div class="fieldset-title">资料</div>
          <dl class="detail-list">
            <div><dt>用户名</dt><dd>${esc(user.username)}</dd></div>
            <div><dt>邮箱</dt><dd>${esc(user.email)}</dd></div>
            <div><dt>邮箱验证</dt><dd>${user.is_email_verified ? "已验证" : "未验证"}</dd></div>
            <div><dt>角色</dt><dd>${esc(user.role || "user")}</dd></div>
            <div><dt>简介</dt><dd>${esc(user.bio || "未填写")}</dd></div>
          </dl>
        </div>
        <div>
          <div class="fieldset-title">消费摘要</div>
          <div class="cal-grid">
            <div class="cal-card"><small>订单数</small><b>${orders.length}</b></div>
            <div class="cal-card"><small>有效消费</small><b style="font-size:13px">${money(spent)}</b></div>
          </div>
          <div class="field__hint" style="margin-top:8px">有效消费不含已取消订单。</div>
        </div>
      </div>
      <div class="fieldset-title" style="margin-top:18px">最近订单</div>
      ${orders.length ? `<div class="table-wrap"><table class="table" style="min-width:480px">
        <thead><tr><th>订单号</th><th class="num">金额</th><th>状态</th><th>时间</th></tr></thead>
        <tbody>${orders.slice(0, 5).map((o) => `<tr>
          <td class="mono">${esc(o.order_no)}</td>
          <td class="num">${money(o.total_amount)}</td>
          <td>${badge(ORDER_STATUS[o.status]?.label || o.status, ORDER_STATUS[o.status]?.tone || "")}</td>
          <td class="nowrap" style="color:var(--muted-2)">${dateTime(o.created_at).slice(5, 16)}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty" style="padding:26px">${icon("receipt", { size: 26 })}<b>还没有订单</b></div>`}`,
    footer: `<button class="btn btn--ghost" type="button" data-close>关闭</button>`,
  });
  void num;
}
