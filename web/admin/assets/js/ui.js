/* Toasts, modal dialogs and a few HTML fragments shared by the views. */

import { icon } from "./icons.js";
import { compactMoney, esc, money, num } from "./util.js";

let toastTimer = 0;

export function toast(message, tone = "ok") {
  const root = document.getElementById("toasts");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast${tone === "error" ? " is-error" : ""}`;
  el.innerHTML = `${icon(tone === "error" ? "alert" : "check", { size: 16 })}<span>${esc(message)}</span>`;
  root.append(el);
  while (root.children.length > 4) root.firstElementChild.remove();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3800);
}

/* Count-up for KPI figures. The final value is already in the DOM, so this is
   pure enhancement: reduced motion (or a missing API) leaves the number alone. */
export function animateNumbers(root = document) {
  if (typeof requestAnimationFrame !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const format = (value, kind) => {
    if (kind === "money") return money(value);
    if (kind === "compact") return compactMoney(value);
    return num(value);
  };

  root.querySelectorAll("[data-count]").forEach((node) => {
    const target = Number(node.dataset.count);
    if (!Number.isFinite(target) || !node.isConnected) return;
    const kind = node.dataset.countFormat || "int";
    const startAt = performance.now();
    const duration = 680;

    const tick = (now) => {
      if (!node.isConnected) return;
      const progress = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = format(target * eased, kind);
      if (progress < 1) requestAnimationFrame(tick);
      else node.textContent = format(target, kind);
    };

    node.textContent = format(0, kind);
    requestAnimationFrame(tick);
  });
}

export function badge(label, tone = "") {
  return `<span class="badge${tone ? ` badge--${tone}` : ""}">${esc(label)}</span>`;
}

export function empty(title, text = "", iconName = "sprout") {
  return `<div class="empty">${icon(iconName, { size: 30 })}<b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ""}</div>`;
}

export function openModal({ title, subtitle = "", body = "", footer = "", wide = false, onMount } = {}) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal${wide ? " modal--wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal__head">
          <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>
          <button class="icon-btn modal__close" type="button" data-close aria-label="关闭">${icon("close")}</button>
        </div>
        <div class="modal__body">${body}</div>
        ${footer ? `<div class="modal__foot">${footer}</div>` : ""}
      </div>
    </div>`;

  const backdrop = root.firstElementChild;
  const dialog = backdrop.querySelector(".modal");
  const close = () => {
    root.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      const focusable = [...dialog.querySelectorAll("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  backdrop.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", onKey);
  if (onMount) onMount(dialog, close);
  setTimeout(() => {
    const target = dialog.querySelector("input, select, textarea, button:not(.modal__close)");
    if (target) target.focus();
  }, 30);
  return { el: dialog, close };
}

export function confirmDialog({ title = "确认操作", message = "", confirmText = "确认", tone = "danger" } = {}) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title,
      body: `<p style="color:var(--muted);font-size:13px">${esc(message)}</p>`,
      footer: `<button class="btn btn--ghost btn--sm" type="button" data-cancel>取消</button>
        <button class="btn ${tone === "danger" ? "btn--coral" : ""} btn--sm" type="button" data-ok>${esc(confirmText)}</button>`,
      onMount(dialog) {
        dialog.querySelector("[data-cancel]").addEventListener("click", () => { close(); resolve(false); });
        dialog.querySelector("[data-ok]").addEventListener("click", () => { close(); resolve(true); });
      },
    });
  });
}

export function field({ label, name, value = "", type = "text", placeholder = "", hint = "", min, max, step, iconName } = {}) {
  return `<div class="field">
    <label for="f-${esc(name)}">${iconName ? icon(iconName, { size: 13 }) : ""}${esc(label)}</label>
    <input class="input" id="f-${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${esc(value ?? "")}"
      placeholder="${esc(placeholder)}"${min !== undefined ? ` min="${min}"` : ""}${max !== undefined ? ` max="${max}"` : ""}${step !== undefined ? ` step="${step}"` : ""}>
    ${hint ? `<div class="field__hint">${esc(hint)}</div>` : ""}
  </div>`;
}

export function selectField({ label, name, value, options, hint, iconName } = {}) {
  return `<div class="field">
    <label for="f-${esc(name)}">${iconName ? icon(iconName, { size: 13 }) : ""}${esc(label)}</label>
    <select class="select" id="f-${esc(name)}" name="${esc(name)}" style="width:100%">
      ${options.map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? " selected" : ""}>${esc(o.label)}</option>`).join("")}
    </select>
    ${hint ? `<div class="field__hint">${esc(hint)}</div>` : ""}
  </div>`;
}

export function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function bindForm(form, onSubmit) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(readForm(form), form);
  });
}

export function pager(total, page, pageSize, id = "pager") {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return `<div class="pager" id="${id}">
    <span>共 ${total} 条 · 第 ${Math.min(page, pages)} / ${pages} 页</span>
    <span class="pager__spacer"></span>
    <button class="btn btn--ghost btn--sm" type="button" data-page="${page - 1}"${page <= 1 ? " disabled" : ""}>${icon("chevronLeft", { size: 13 })}上一页</button>
    <button class="btn btn--ghost btn--sm" type="button" data-page="${page + 1}"${page >= pages ? " disabled" : ""}>下一页${icon("chevronRight", { size: 13 })}</button>
  </div>`;
}

export const initials = (name) => String(name || "?").trim().slice(0, 1).toUpperCase();
