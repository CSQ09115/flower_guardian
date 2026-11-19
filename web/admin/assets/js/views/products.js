import { icon } from "../icons.js";
import { badge, confirmDialog, field, openModal, pager, selectField, toast } from "../ui.js";
import { refreshView, removeProduct, saveProduct, store } from "../store.js";
import { dateTime, esc, money, num, PRODUCT_STATUS } from "../util.js";

let query = "";
let status = "all";
let page = 1;
const PAGE_SIZE = 8;

export async function render(root) {
  const rows = filtered();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  page = Math.min(page, pages);
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const active = store.data.products.filter((p) => p.status === "active").length;
  const lowStock = store.data.products.filter((p) => p.stock <= 20).length;

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <h1>商品管理</h1>
        <p>维护商城在售商品：价格、库存、关联植物与上下架状态。库存 ≤ 20 时在列表里标黄提醒。</p>
      </div>
      <div class="page-head__actions">
        <button class="btn" type="button" id="p-new">${icon("plus", { size: 15 })}新建商品</button>
      </div>
    </div>

    <div class="kpis">
      ${kpi("商品总数", num(store.data.products.length), "含已下架", "box", "rose")}
      ${kpi("在售", num(active), "status = active", "check", "mint")}
      ${kpi("库存偏低", num(lowStock), "库存 ≤ 20", "alert", lowStock ? "pink" : "")}
      ${kpi("关联植物", num(store.data.products.filter((p) => p.plant_id).length), "已绑定植物库条目", "leaf", "pink")}
    </div>

    <section class="card">
      <div class="toolbar">
        <div class="search">${icon("search")}
          <input class="input" id="p-search" type="search" placeholder="搜索商品名称或描述" value="${esc(query)}" aria-label="搜索商品">
        </div>
        <div class="chips" role="group" aria-label="按状态筛选">
          <button class="chip${status === "all" ? " is-active" : ""}" type="button" data-status="all">全部<span class="chip__count">${store.data.products.length}</span></button>
          <button class="chip${status === "active" ? " is-active" : ""}" type="button" data-status="active">在售<span class="chip__count">${active}</span></button>
          <button class="chip${status === "inactive" ? " is-active" : ""}" type="button" data-status="inactive">已下架<span class="chip__count">${store.data.products.length - active}</span></button>
        </div>
      </div>
      <div id="p-body"></div>
      <div id="p-pager"></div>
    </section>`;

  const body = root.querySelector("#p-body");
  const pagerEl = root.querySelector("#p-pager");
  const search = root.querySelector("#p-search");

  const paint = () => {
    const list = filtered();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const view = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    body.innerHTML = view.length ? `<div class="table-wrap"><table class="table" style="min-width:880px">
      <thead><tr><th>商品</th><th class="num">价格</th><th class="num">库存</th><th>关联植物</th><th>状态</th><th>更新时间</th><th><span class="sr-only">操作</span></th></tr></thead>
      <tbody>${view.map(row).join("")}</tbody>
    </table></div>` : `<div class="empty">${icon("box", { size: 30 })}<b>没有匹配的商品</b><p>换一个关键词，或切换状态筛选。</p></div>`;
    pagerEl.innerHTML = list.length ? pager(list.length, page, PAGE_SIZE) : "";
    pagerEl.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => { page = Number(btn.dataset.page); paint(); });
    });
    body.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openForm(store.data.products.find((p) => p.id === Number(btn.dataset.edit))));
    });
    body.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const product = store.data.products.find((p) => p.id === Number(btn.dataset.del));
        const ok = await confirmDialog({
          title: "删除商品",
          message: `确定删除「${product.name}」？历史订单里的商品名称与金额不会受影响。`,
          confirmText: "删除",
        });
        if (!ok) return;
        try { await removeProduct(product.id); toast("商品已删除"); } catch (error) { toast(error.message, "error"); }
      });
    });
  };

  search.addEventListener("input", () => { query = search.value.trim(); page = 1; paint(); });
  root.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      status = btn.dataset.status;
      root.querySelectorAll("[data-status]").forEach((b) => b.classList.toggle("is-active", b === btn));
      page = 1;
      paint();
    });
  });
  root.querySelector("#p-new").addEventListener("click", () => openForm(null));
  paint();
}

function filtered() {
  const q = query.toLowerCase();
  return store.data.products.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (!q) return true;
    return [p.name, p.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });
}

function row(product) {
  const plant = store.data.plants.find((p) => p.id === product.plant_id);
  return `<tr>
    <td><div class="cell-main">
      ${product.image_url ? `<img src="${esc(product.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="thumb-fallback">${esc(product.name.slice(0, 1))}</span>`}
      <span><b>${esc(product.name)}</b><small>#${product.id}</small></span>
    </div></td>
    <td class="num strong">${money(product.price)}</td>
    <td class="num" style="${product.stock <= 20 ? "color:var(--coral-ink);font-weight:600" : ""}">${num(product.stock)}</td>
    <td>${plant ? `<a class="link" href="#/plants">${esc(plant.name)}</a>` : `<span style="color:var(--muted-2)">未关联</span>`}</td>
    <td>${badge(PRODUCT_STATUS[product.status]?.label || product.status, PRODUCT_STATUS[product.status]?.tone || "")}</td>
    <td class="nowrap" style="color:var(--muted-2)">${dateTime(product.updated_at).slice(0, 10)}</td>
    <td class="nowrap">
      <button class="icon-btn" type="button" data-edit="${product.id}" aria-label="编辑 ${esc(product.name)}" title="编辑">${icon("edit", { size: 15 })}</button>
      <button class="icon-btn icon-btn--danger" type="button" data-del="${product.id}" aria-label="删除 ${esc(product.name)}" title="删除">${icon("trash", { size: 15 })}</button>
    </td>
  </tr>`;
}

function kpi(label, value, meta, iconName, tone = "") {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}">
    <div class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(iconName, { size: 15 })}</span></div>
    <div class="kpi__value">${value}</div><div class="kpi__meta">${meta}</div>
  </div>`;
}

function openForm(product) {
  const editing = Boolean(product);
  const { close } = openModal({
    title: editing ? "编辑商品" : "新建商品",
    subtitle: editing ? `${product.name} · #${product.id}` : "创建后会出现在商城列表。",
    wide: true,
    body: `<form id="p-form" style="display:grid;gap:12px">
      <div class="form-row">
        ${field({ label: "商品名称", name: "name", value: product?.name || "", placeholder: "如：绿萝水培套装" })}
        ${field({ label: "价格（元）", name: "price", type: "number", value: product?.price ?? "", min: 0, step: "0.01", placeholder: "35.00" })}
      </div>
      <div class="form-row">
        ${field({ label: "库存", name: "stock", type: "number", value: product?.stock ?? 0, min: 0, step: "1" })}
        ${selectField({
          label: "关联植物", name: "plant_id", value: product?.plant_id ?? "",
          options: [{ value: "", label: "不关联" }, ...store.data.plants.map((p) => ({ value: p.id, label: p.name }))],
        })}
      </div>
      ${field({ label: "图片地址", name: "image_url", value: product?.image_url || "", placeholder: "https://… 或 ../assets/xxx.jpg", hint: "留空时用商品名称首字生成占位缩略图。" })}
      <div class="field">
        <label for="f-description">商品描述</label>
        <textarea class="input" id="f-description" name="description" rows="3" style="height:auto;padding:9px 12px;resize:vertical" placeholder="一句话说明包含什么、适合谁">${esc(product?.description || "")}</textarea>
      </div>
      ${selectField({ label: "状态", name: "status", value: product?.status || "active", options: [{ value: "active", label: "在售" }, { value: "inactive", label: "已下架" }] })}
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-close>取消</button>
      <button class="btn" type="submit" form="p-form">${editing ? "保存修改" : "创建商品"}</button>`,
    onMount(dialog) {
      dialog.querySelector("#p-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        const name = String(data.name || "").trim();
        const price = Number(data.price);
        if (!name) return toast("请填写商品名称", "error");
        if (!Number.isFinite(price) || price < 0) return toast("价格需为不小于 0 的数字", "error");
        const payload = {
          name,
          price,
          stock: Number(data.stock || 0),
          image_url: data.image_url.trim() || null,
          plant_id: data.plant_id ? Number(data.plant_id) : null,
          status: data.status,
          description: data.description.trim() || null,
        };
        try {
          await saveProduct(payload, product?.id);
          close();
          if (!editing) { page = 1; refreshView(); }
        } catch (error) { toast(error.message, "error"); }
      });
    },
  });
}
