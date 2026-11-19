import { icon } from "../icons.js";
import { badge, confirmDialog, field, openModal, pager, selectField, toast } from "../ui.js";
import { removePlant, savePlant, store } from "../store.js";
import { CARE_LEVEL, esc, num } from "../util.js";

let query = "";
let category = "all";
let level = "all";
let page = 1;
const PAGE_SIZE = 8;

export async function render(root) {
  const plants = store.data.plants;
  const categories = [...new Set(plants.map((p) => p.category).filter(Boolean))];
  const easy = plants.filter((p) => p.care_level === 1).length;
  const mapped = plants.filter((p) => p.yolo_class_id != null).length;

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <h1>植物库</h1>
        <p>识别结果背后的养护知识：光照、浇水、温度与常见错误。YOLO 类别 ID 对应识别模型的输出类别。</p>
      </div>
      <div class="page-head__actions"><button class="btn" type="button" id="pl-new">${icon("plus", { size: 15 })}新建条目</button></div>
    </div>

    <div class="kpis">
      ${kpi("条目总数", num(plants.length), "植物库全部条目", "leaf", "rose")}
      ${kpi("省心级", num(easy), "care_level = 1", "check", "mint")}
      ${kpi("需留意", num(plants.length - easy), "care_level ≥ 2", "alert", plants.length - easy ? "pink" : "")}
      ${kpi("已映射类别", num(mapped), "有 YOLO 类别 ID", "cpu", "pink")}
    </div>

    <section class="card">
      <div class="toolbar">
        <div class="search">${icon("search")}
          <input class="input" id="pl-search" type="search" placeholder="搜索中文名或学名" value="${esc(query)}" aria-label="搜索植物">
        </div>
        <select class="select" id="pl-cat" aria-label="按分类筛选">
          <option value="all">全部分类</option>
          ${categories.map((c) => `<option value="${esc(c)}"${category === c ? " selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
        <div class="chips" role="group" aria-label="按养护难度筛选">
          ${["all", 1, 2, 3].map((v) => `<button class="chip${String(level) === String(v) ? " is-active" : ""}" type="button" data-level="${v}">${v === "all" ? "全部难度" : CARE_LEVEL[v].label}</button>`).join("")}
        </div>
      </div>
      <div id="pl-body"></div>
      <div id="pl-pager"></div>
    </section>`;

  const body = root.querySelector("#pl-body");
  const pagerEl = root.querySelector("#pl-pager");

  const paint = () => {
    const q = query.toLowerCase();
    const list = plants.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (level !== "all" && String(p.care_level) !== String(level)) return false;
      if (!q) return true;
      return [p.name, p.scientific_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const view = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    body.innerHTML = view.length ? `<div class="table-wrap"><table class="table" style="min-width:940px">
      <thead><tr><th>植物</th><th>分类</th><th>养护难度</th><th>光照</th><th>浇水</th><th class="num">YOLO ID</th><th><span class="sr-only">操作</span></th></tr></thead>
      <tbody>${view.map(row).join("")}</tbody>
    </table></div>` : `<div class="empty">${icon("leaf", { size: 30 })}<b>没有匹配的植物</b><p>换一个关键词或筛选条件。</p></div>`;
    pagerEl.innerHTML = list.length ? pager(list.length, page, PAGE_SIZE) : "";
    pagerEl.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => { page = Number(btn.dataset.page); paint(); });
    });
    body.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openForm(plants.find((p) => p.id === Number(btn.dataset.edit))));
    });
    body.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const plant = plants.find((p) => p.id === Number(btn.dataset.del));
        const ok = await confirmDialog({ title: "删除植物条目", message: `确定删除「${plant.name}」？已绑定该植物的商品会失去关联显示。`, confirmText: "删除" });
        if (!ok) return;
        try { await removePlant(plant.id); toast("植物条目已删除"); } catch (error) { toast(error.message, "error"); }
      });
    });
  };

  root.querySelector("#pl-search").addEventListener("input", (event) => { query = event.target.value.trim(); page = 1; paint(); });
  root.querySelector("#pl-cat").addEventListener("change", (event) => { category = event.target.value; page = 1; paint(); });
  root.querySelectorAll("[data-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      level = btn.dataset.level;
      root.querySelectorAll("[data-level]").forEach((b) => b.classList.toggle("is-active", b === btn));
      page = 1;
      paint();
    });
  });
  root.querySelector("#pl-new").addEventListener("click", () => openForm(null));
  paint();
}

function row(plant) {
  const care = CARE_LEVEL[plant.care_level] || CARE_LEVEL[1];
  return `<tr>
    <td><div class="cell-main">
      ${plant.image_url ? `<img src="${esc(plant.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="thumb-fallback">${esc(plant.name.slice(0, 1))}</span>`}
      <span><b>${esc(plant.name)}</b><small>${esc(plant.scientific_name || "—")} · #${plant.id}</small></span>
    </div></td>
    <td>${esc(plant.category || "—")}</td>
    <td>${badge(care.label, care.tone)}</td>
    <td style="max-width:170px">${esc(plant.light_requirement || "—")}</td>
    <td style="max-width:190px">${esc(plant.water_requirement || "—")}</td>
    <td class="num mono">${plant.yolo_class_id ?? "—"}</td>
    <td class="nowrap">
      <button class="icon-btn" type="button" data-edit="${plant.id}" aria-label="编辑 ${esc(plant.name)}" title="编辑">${icon("edit", { size: 15 })}</button>
      <button class="icon-btn icon-btn--danger" type="button" data-del="${plant.id}" aria-label="删除 ${esc(plant.name)}" title="删除">${icon("trash", { size: 15 })}</button>
    </td>
  </tr>`;
}

function kpi(label, value, meta, iconName, tone = "") {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}">
    <div class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(iconName, { size: 15 })}</span></div>
    <div class="kpi__value">${value}</div><div class="kpi__meta">${meta}</div>
  </div>`;
}

function openForm(plant) {
  const editing = Boolean(plant);
  const { close } = openModal({
    title: editing ? "编辑植物条目" : "新建植物条目",
    subtitle: editing ? `${plant.name} · #${plant.id}` : "新条目会出现在养护百科与推荐中。",
    wide: true,
    body: `<form id="pl-form" style="display:grid;gap:12px">
      <div class="form-row">
        ${field({ label: "中文名", name: "name", value: plant?.name || "", placeholder: "绿萝" })}
        ${field({ label: "学名", name: "scientific_name", value: plant?.scientific_name || "", placeholder: "Epipremnum aureum" })}
      </div>
      <div class="form-row form-row--3">
        ${field({ label: "分类", name: "category", value: plant?.category || "", placeholder: "观叶" })}
        ${selectField({ label: "养护难度", name: "care_level", value: plant?.care_level || 1, options: [
          { value: 1, label: "省心" }, { value: 2, label: "一般" }, { value: 3, label: "费心" },
        ] })}
        ${field({ label: "YOLO 类别 ID", name: "yolo_class_id", type: "number", value: plant?.yolo_class_id ?? "", min: 0, step: "1", placeholder: "0" })}
      </div>
      <div class="form-row">
        ${field({ label: "光照要求", name: "light_requirement", value: plant?.light_requirement || "", placeholder: "明亮散射光" })}
        ${field({ label: "浇水要求", name: "water_requirement", value: plant?.water_requirement || "", placeholder: "表土干 2cm 再浇透" })}
      </div>
      <div class="form-row">
        ${field({ label: "温度范围", name: "temperature_range", value: plant?.temperature_range || "", placeholder: "18–28℃" })}
        ${field({ label: "湿度范围", name: "humidity_range", value: plant?.humidity_range || "", placeholder: "50–70%" })}
      </div>
      ${field({ label: "图片地址", name: "image_url", value: plant?.image_url || "", placeholder: "../assets/pothos.jpg" })}
      <div class="field">
        <label for="f-description">描述</label>
        <textarea class="input" id="f-description" name="description" rows="3" style="height:auto;padding:9px 12px;resize:vertical">${esc(plant?.description || "")}</textarea>
      </div>
      <div class="field">
        <label for="f-tips">养护提示</label>
        <textarea class="input" id="f-tips" name="tips" rows="2" style="height:auto;padding:9px 12px;resize:vertical">${esc(plant?.tips || "")}</textarea>
      </div>
      <div class="switch-row">
        <span><b>对宠物有毒</b><small>会显示在养护卡的风险提示里</small></span>
        <label class="switch"><input type="checkbox" name="is_toxic" ${plant?.is_toxic ? "checked" : ""} aria-label="对宠物有毒"><i></i></label>
      </div>
    </form>`,
    footer: `<button class="btn btn--ghost" type="button" data-close>取消</button>
      <button class="btn" type="submit" form="pl-form">${editing ? "保存修改" : "创建条目"}</button>`,
    onMount(dialog) {
      dialog.querySelector("#pl-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        if (!String(data.name || "").trim()) return toast("请填写中文名", "error");
        const payload = {
          name: data.name.trim(),
          scientific_name: data.scientific_name.trim() || null,
          category: data.category.trim() || null,
          care_level: Number(data.care_level),
          yolo_class_id: data.yolo_class_id === "" ? null : Number(data.yolo_class_id),
          light_requirement: data.light_requirement.trim() || null,
          water_requirement: data.water_requirement.trim() || null,
          watering_tip: data.water_requirement.trim() || null,
          temperature_range: data.temperature_range.trim() || null,
          humidity_range: data.humidity_range.trim() || null,
          image_url: data.image_url.trim() || null,
          description: data.description.trim() || null,
          tips: data.tips.trim() || null,
          is_toxic: data.is_toxic === "on",
        };
        try {
          await savePlant(payload, plant?.id);
          close();
          if (!editing) { page = 1; }
        } catch (error) { toast(error.message, "error"); }
      });
    },
  });
}
