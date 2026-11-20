# Web 前端 React 重构实施计划

> **执行方式**：本计划按任务顺序执行，每个任务以「验证通过 + 一次提交」为出口。不要跨任务批量改动。
>
> **上游文档**：`docs/superpowers/specs/2026-11-19-web-react-refactor-design.md`（已批准）。本计划是它的逐任务展开；两者冲突时，以设计文档为准并先停下来问。

**Goal:** 把 `web/` 从零依赖、手写 DOM 的静态站点，原地改造成 Vite + React + TypeScript 多入口工程，视觉、文案、交互、演示数据、无障碍行为逐屏保持不变。

**Architecture:** Vite root 为 `web/`，两个 HTML 入口（`/` 营销页、`/admin/` 后台）各挂一棵 React 树。后台沿用 hash 路由；营销页构建时预渲染再 hydrate。后台状态由一个 `AdminDataProvider` 持有，纯 selector 计算派生指标。图表按现有 SVG 几何手写成 React 组件，不引库。

**Tech Stack:** React 18.3、React DOM 18.3、TypeScript strict、Vite（安装时稳定版）、`react-router-dom` 6、原生 CSS、Vitest、Playwright + `@axe-core/playwright`。

**Scope source:** `web/`（当前工作区内容，含已暂存的 `#fafafa` 等改动）。

---

## Global Constraints

1. **基线是工作区，不是 HEAD。** 第一步就把当前 `web/` 整树复制到 `web/legacy/`，之后所有「和原来一致」的对照都对着 `web/legacy/`。不要 `git checkout` 任何 `web/` 文件。
2. **不删旧文件直到最后一步。** 迁移期间 `web/legacy/` 必须可独立运行（`python3 -m http.server 4178`，从 `web/legacy/` 起服务）。
3. **文案逐字保留。** 中文标点、空格、`<br>`、`·`、`—`、全角括号都要一致。禁止新增任何数字、用户数、评价、增长表述。禁止 emoji。
4. **两套配色不合并。** 营销页 `#fafafa / #1c4a36 / #e94b52`；后台 `#f3f8f2 / #2c7a56 / #d95f82`。两份 CSS 的 `:root` 原样保留。
5. **CSS 不模块化现有样式。** `site.css` 与 `admin.css` 是整体搬迁；只有全新共享组件允许用 `*.module.css`。**不新建 `shared/styles/base.css`**：两份文件各自已有 reset，另起一层会改变层叠顺序；共享组件的样式就近用 module。
6. **演示数值是契约。** 销售额 `¥2,333.70`、订单 `21`、客单价 `¥111.13`、新用户 `8`、设备 `6`（在线 `4`、离线 `2`）、默认区间 `14` 天。任何一项变化都视为失败。
7. **已知怪异行为保留。** 带 token 直接刷新后台时，顶栏显示「实时接口」但数据仍是演示值，直到点刷新；演示模式写操作会先弹 store 的「演示模式：…」再弹视图的成功提示。不要顺手修。
8. **抽屉的 `inert` 范围是 `.main` 整块**（含顶栏与菜单按钮），不是 `<main id="view">`。
9. **筛选状态跨路由保留。** 概览的 7/14/30、统计的起止日期与 `groupBy`、列表页的搜索词与页码，离开再回来仍是原值（现有实现放在模块作用域）。用模块级 `let` 或 Provider 外的轻量 store，不要改成「每次进入重置」。
10. **资源路径统一为根绝对路径**（`/assets/pothos.jpg`），因为图片进 `public/`。
11. **Node 不在默认 PATH。** 所有 npm/node 命令用 `PATH=/opt/homebrew/bin:$PATH`，或在 `web/README.md` 里写明。
12. **构建产物必须能静态托管。** `/` 与 `/admin/` 在 `python3 -m http.server` 下都返回真实 HTML；后台刷新不 404（hash 路由保证）。
13. **每个任务结束提交一次。** 提交前 `npm run typecheck` 必须通过。

---

## Review Focus（这些地方错了，整套就白做）

| # | 风险点 | 对应任务 | 证明方式 |
| --- | --- | --- | --- |
| 1 | 演示数据口径漂移 | Task 4、5 | Vitest 快照断言 4 个 KPI + 6 设备 + 14 天序列 |
| 2 | 实时模式启动语义被「修好」 | Task 7、18 | 手动验收：带 token 刷新 → 顶栏实时 + 数据仍演示 |
| 3 | 抽屉 `inert` 收窄到 `<main>` | Task 8 | `qa/drawer.mjs` 断言菜单按钮不可聚焦 |
| 4 | hash 路由深链与兜底 | Task 8 | `qa/smoke.mjs` 直开 `#/devices/FG-ESP32-001` |
| 5 | 营销页首屏依赖 JS | Task 21 | 禁用 JS 后文案与图片可见 |
| 6 | 图表几何/动画与原来不一致 | Task 9、10 | 并排目检 + 1440/390 截图 |
| 7 | 演示写操作少一条 toast | Task 15–17 | 手动点一次删除，确认两条提示都有 |
| 8 | 筛选状态被重置 | Task 11、12、15–17 | 手动：概览切 30 天 → 进详情 → 返回仍是 30 天 |
| 9 | 图片 404 | Task 1、19 | `qa/smoke.mjs` 收集 `response.status >= 400` |
| 10 | axe 回归 | Task 22 | 10 路由 × 2 宽度 0 violations |

---

## 任务索引

| # | 任务 | 主要产出 |
| --- | --- | --- |
| 1 | 基线副本 + Vite 脚手架 | `web/legacy/`、`package.json`、两个入口壳 |
| 2 | 图标层 | `shared/icons`、`admin/icons.tsx`、`site/icons.tsx` |
| 3 | 共享组件 | Toast、Modal、Field、Pager、CountUp、focus trap |
| 4 | 后台数据模型 | `types.ts`、`util.ts`、`demo.ts` + 快照测试 |
| 5 | 派生 selector | `selectors.ts` + 测试 |
| 6 | API 客户端 | `api.ts` + 测试 |
| 7 | 数据 Provider | `store.tsx`、`useAdminData` |
| 8 | 后台壳与路由 | 侧栏、顶栏、抽屉、hash 路由、标题/面包屑 |
| 9 | 图表 A | 折线、柱、迷你线 |
| 10 | 图表 B | 环、横向排行、环形仪表、热力图 |
| 11 | 概览视图 | KPI + 趋势 + 状态 + 设备注意 |
| 12 | 统计视图 | 区间、分组、排行、热力图 |
| 13 | 设备 + 设备详情 | 卡片、读数、阈值、标定 |
| 14 | 告警视图 | 列表、确认 |
| 15 | 商品视图 | 表格、搜索、分页、增删改、CSV |
| 16 | 订单视图 | 表格、状态流转、详情 |
| 17 | 用户 + 植物库 | 两张表 + 植物 CRUD |
| 18 | 登录页 | 账号密码、演示入口、API Base |
| 19 | 营销页静态区 | Nav/Hero/Intro/How/Features/Spec/Faq/Cta/Footer |
| 20 | 营销页交互 | tabs、finder、复制、reveal、导航开合 |
| 21 | 预渲染 + hydrate | `entry-server.tsx`、`scripts/prerender.mjs` |
| 22 | QA 套件 | `qa/` 六个脚本 + `npm run qa` |
| 23 | 清尾 + 全量回归 | 删旧文件、README、`.gitignore` |

---

## Task 1: 基线副本 + Vite 脚手架

**Files:**
- Create: `web/legacy/`（整树复制，gitignore）
- Create: `web/package.json`、`web/tsconfig.json`、`web/tsconfig.node.json`、`web/vite.config.ts`、`web/.npmrc`
- Modify: `web/index.html`、`web/admin/index.html`
- Create: `web/public/assets/`（从 `web/assets/` 迁图片与 favicon）
- Create: `web/src/admin/styles/admin.css`、`web/src/site/styles/site.css`（从 `web/legacy/` 复制并只改资源 URL）
- Create: `web/src/admin/main.tsx`、`web/src/site/main.tsx`（占位根）
- Modify: `.gitignore`

**Interfaces:**
- `web/index.html` 只保留 `<div id="root"></div>` + `<script type="module" src="/src/site/main.tsx">`
- `web/admin/index.html` 只保留 `<div id="root"></div>` + `<script type="module" src="/src/admin/main.tsx">`

**Steps:**

1. 复制基线（**用户已明确要求：不新建分支、不建 worktree，直接在当前工作区执行**）：
   ```bash
   cd /Users/ember/Flower_Guardian
   rsync -a --exclude node_modules web/ web/legacy/
   ```
   不要 `git switch -c`，不要 `git worktree add`。之后每个任务的提交都落在当前分支。
2. 追加 `.gitignore`（只追加，不动已有行）：
   ```
   web/node_modules/
   web/legacy/
   web/dist/
   ```
3. 写 `web/package.json`：
   ```json
   {
     "name": "flower-guardian-web",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "vite --port 4177",
       "build": "tsc --noEmit && vite build",
       "preview": "vite preview --port 4177",
       "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
       "test": "vitest run",
       "qa": "node qa/run.mjs"
     },
     "dependencies": {
       "react": "^18.3.1",
       "react-dom": "^18.3.1",
       "react-router-dom": "^6.30.0"
     },
     "devDependencies": {
       "@types/react": "^18.3.12",
       "@types/react-dom": "^18.3.1",
       "@types/node": "^22.10.2",
       "@vitejs/plugin-react": "^4.3.4",
       "typescript": "^5.7.2",
       "vite": "^6.0.5",
       "vitest": "^2.1.8"
     }
   }
   ```
   安装时以 npm 实际解析到的稳定版为准，不手改 lockfile。
4. 写 `web/tsconfig.json`：
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "lib": ["ES2022", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "jsx": "react-jsx",
       "strict": true,
       "noFallthroughCasesInSwitch": true,
       "skipLibCheck": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "noEmit": true,
       "types": ["vite/client"]
     },
     "include": ["src"]
   }
   ```
5. 写 `web/tsconfig.node.json`（给配置文件用，单独 typecheck）：
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "strict": true,
       "noEmit": true,
       "types": ["node"]
     },
     "include": ["vite.config.ts", "vitest.config.ts"]
   }
   ```
6. 写 `web/vite.config.ts`：
   ```ts
   import { fileURLToPath } from "node:url";
   import { defineConfig } from "vite";
   import react from "@vitejs/plugin-react";

   const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

   export default defineConfig({
     plugins: [react()],
     base: "/",
     publicDir: r("./public"),
     build: {
       outDir: r("./dist"),
       emptyOutDir: true,
       rollupOptions: {
         input: { site: r("./index.html"), admin: r("./admin/index.html") },
       },
     },
     server: { port: 4177 },
     preview: { port: 4177 },
   });
   ```
7. 迁图片：`mkdir -p web/public/assets && mv web/assets/*.jpg web/assets/*.png web/public/assets/`。`credits.json` 保留到 `web/public/assets/credits.json`。
8. 迁样式（**本任务最容易被低估的一步**）：
   ```bash
   mkdir -p web/src/admin/styles web/src/site/styles web/src/shared/styles
   cp web/legacy/admin/assets/admin.css web/src/admin/styles/admin.css
   cp web/legacy/assets/style.css web/src/site/styles/site.css
   ```
   然后只做两类改动，其余逐字节保留：
   - 资源 URL：`../assets/` → `/assets/`，`assets/` → `/assets/`（用 `grep -n "assets/"` 逐条核对，包括 `url(...)` 与注释里的路径）。
   - 删除已失效的手工版本号注释（若有 `?v=` 只出现在 HTML，不应出现在 CSS；出现则一并去掉）。
   迁移后用 `diff` 确认差异只落在允许的行：
   ```bash
   diff <(sed 's#/assets/#../assets/#g' web/src/site/styles/site.css) web/legacy/assets/style.css
   ```
   两份 CSS 的 `:root`、断点、`@supports`、`@media (prefers-*)` 块必须完整保留；**不要**合并 token、不要重排选择器。
9. 两个入口壳。营销页 `<head>` 原样保留 title/description/theme-color/OG/favicon，路径改 `/assets/...`；**必须保留** `<html lang="zh-CN" class="no-js">` 与那行内联脚本 `document.documentElement.classList.remove('no-js'); if (location.search.indexOf('snap') < 0) document.documentElement.classList.add('js');`——它是「无 JS 时内容可见、有 JS 时才做 reveal、`?snap` 时跳过隐藏」这套退化的开关。删除 `link stylesheet` 与 `script app.js`，body 只留 `<div id="root"></div>` 和 `<noscript>` 文案（用现有 `<noscript>` 内容，若无则写「本站需要启用 JavaScript；核心内容在无脚本时仍可阅读。」）；末尾加 `<script type="module" src="/src/site/main.tsx"></script>`。后台同理（后台无 `no-js` 机制），保留 `<a class="sr-only" href="#view">跳到内容</a>`。
10. 占位入口（后面替换），并在这里就把全局样式接上：
    ```tsx
    // web/src/site/main.tsx
    import { createRoot } from "react-dom/client";
    import "./styles/site.css";

    createRoot(document.getElementById("root")!).render(<h1>site</h1>);
    ```
    后台 `main.tsx` 同样 `import "./styles/admin.css"`，渲染 `<h1>admin</h1>`。
11. 用旧 HTML 的静态标记手工验证样式：把 `legacy/index.html` 的 `<body>` 内容临时粘进占位页（或用 `dangerouslySetInnerHTML` 一次性渲染），确认配色、字体、断点与基线一致后移除。目的：在写 React 组件之前先证明 CSS 迁移没坏。
12. 安装依赖并验证：
    ```bash
    cd /Users/ember/Flower_Guardian/web
    PATH=/opt/homebrew/bin:$PATH npm install
    PATH=/opt/homebrew/bin:$PATH npm run dev
    ```
    打开 `http://127.0.0.1:4177/` 与 `/admin/`，看到占位标题；`npm run build` 产出 `dist/index.html` 与 `dist/admin/index.html`。
13. 起基线副本对照：`cd web/legacy && python3 -m http.server 4178 --bind 127.0.0.1`，确认旧站仍可交互。

**Verify:** `npm run typecheck` 通过；`npm run build` 通过；`dist/admin/index.html` 引用带哈希的资源；`dist/assets/` 含全部图片；两份 CSS 的 `diff` 只剩允许的 URL 差异。

**Commit:** `chore(web): scaffold vite multi-entry build with legacy baseline`

---

## Task 2: 图标层

**Files:**
- Create: `web/src/shared/icons/Icon.tsx`
- Create: `web/src/admin/icons.tsx`
- Create: `web/src/site/icons.tsx`
- Reference: `web/legacy/admin/assets/js/icons.js`、`web/legacy/assets/icons.js`

**Interfaces:**
```ts
// shared/icons/Icon.tsx
export type IconProps = { name: string; size?: number; className?: string; stroke?: number };
export function Icon(props: IconProps): JSX.Element;

// admin/icons.tsx
export const ADMIN_ICONS: Record<string, string>;   // 66 行原表，键名不变
export function AdminIcon({ name, size, cls }: { name: string; size?: number; cls?: string }): JSX.Element;

// site/icons.tsx
export const REICON: Record<string, string>;        // 58 行原表
export function SiteIcon({ name, size }: { name: string; size?: number }): JSX.Element;
```

**Steps:**

1. 把 `legacy/admin/assets/js/icons.js` 的 `P` 对象逐条复制进 `ADMIN_ICONS`（不要改键名大小写：`arrowLeft`、`wifiOff` 等）。
2. `AdminIcon` 复刻现有 `icon()` 输出：`class="icon${cls ? ' '+cls : ''}"`、`width/height=size`、`viewBox="0 0 24 24"`、`fill="none"`、`stroke="currentColor"`、`stroke-width={stroke ?? 1.7}`、`stroke-linecap/linejoin="round"`、`aria-hidden="true"`、`focusable="false"`，内容用 `dangerouslySetInnerHTML={{ __html: ADMIN_ICONS[name] ?? ADMIN_ICONS.sprout }}`。
3. 把 `legacy/assets/icons.js` 的 `ICONS` 逐条复制进 `REICON`。`SiteIcon` 复刻 `reicon()`：`class="reicon"`、`width/height=size`、`viewBox="0 0 24 24"`、`fill="none"`、`aria-hidden="true"`、`focusable="false"`；保留 `scoped()` 的替换逻辑（`id="x"` → `id="x<suffix>"`、`url(#x)` → `url(#x<suffix>)`），但后缀改由 `useId()` 派生（去掉非字母数字字符后加 `-r` 前缀），不要用模块级计数器：计数器依赖渲染顺序，Task 21 预渲染 + hydrate 时会服务端/客户端 id 不一致。
4. 未知图标名：后台回退 `sprout`，营销页回退空字符串（与现状一致）。
5. 建一个临时页验证：在占位 `main.tsx` 里渲染 `AdminIcon name="cpu"` 与 `SiteIcon name="Sun"`，目检尺寸与描边。

**Verify:** `npm run typecheck`；临时页两张图标与基线截图一致（同尺寸、同描边、无填充）。

**Commit:** `feat(web): port admin and site icon sets to React components`

---

## Task 3: 共享组件

**Files:**
- Create: `web/src/shared/components/Toast.tsx`、`Toast.module.css`
- Create: `web/src/shared/components/Modal.tsx`、`Modal.module.css`
- Create: `web/src/shared/components/Field.tsx`、`Pager.tsx`、`CountUp.tsx`
- Create: `web/src/shared/hooks/useFocusTrap.ts`、`usePrefersReducedMotion.ts`、`useCopy.ts`
- Reference: `web/legacy/admin/assets/js/ui.js`

**Interfaces:**
```ts
// Toast
export type ToastTone = "ok" | "error";
export type ToastItem = { id: number; message: string; tone: ToastTone };
export function ToastViewport({ items }: { items: ToastItem[] }): JSX.Element;

// Modal
export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  labelledBy?: string;
  subtitle?: string;   // Task 3 amendment: legacy `.modal__head p`
  wide?: boolean;      // Task 3 amendment: legacy `.modal--wide` (4 of 5 form modals use it)
};
export function Modal(props: ModalProps): JSX.Element | null;

// Field
export function Field(props: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: "text" | "number" | "search" | "email" | "password";
  placeholder?: string; required?: boolean; hint?: string; disabled?: boolean;
  min?: number; max?: number; step?: number;   // Task 3 amendment: legacy `field()` numeric constraints
  icon?: React.ReactNode;                      // Task 3 amendment: legacy `iconName`, callers pass <AdminIcon size={13}/>
}): JSX.Element;

// Pager
export function Pager(props: { total: number; page: number; size: number; onPage: (p: number) => void }): JSX.Element | null;

// CountUp
export function CountUp(props: {
  value: number; format?: "int" | "money" | "float" | "compact"; prefix?: string; suffix?: string;
  className?: string; durationMs?: number;
}): JSX.Element;
```

**Steps:**

1. `ToastViewport` 对应 `.toasts` 容器：`role="status" aria-live="polite"`，最多保留 4 条（新来先移除最旧），每条 3800ms 后由 Provider 删除。图标用 `check` / `alert`，`className={tone === "error" ? "toast is-error" : "toast"}`。
2. `Modal` 用 `createPortal(..., document.body)` 挂到 `#modal-root`（不存在则 `document.body`）。打开时：记录 `document.activeElement`，焦点移到第一个可聚焦元素或对话框本身；`Tab` 循环；`Esc` 关闭；关闭后焦点归还。根节点 `role="dialog" aria-modal="true"`，`aria-labelledby` 指向标题 id。**不要**用 `<dialog>` 的 `showModal()`（样式与基线不同）。
3. `useFocusTrap(ref, active)` 提供上述键盘循环与焦点归还，供 Modal 与登录页复用。
4. `Field` 渲染 `.field` 结构（`label` + `input` + 可选 `small`），`id` 由 `name` 派生。数值输入沿用现有 `type="number"`.
5. `Pager` 复刻现有 `pager()` 的按钮数量、`aria-current="page"`、上一页/下一页文案与禁用态。先读 `legacy/admin/assets/js/ui.js` 的 `pager()` 再写。
6. `CountUp` 复刻 `animateNumbers`：`requestAnimationFrame` 逐帧插值，`prefers-reduced-motion: reduce` 或 API 缺失时直接显示终值；格式规则与 `data-count-format` 一致（`int` / `money` / `float` / `compact`；`compact` 按 legacy `compactMoney`：≥1e6 用 M 两位小数、≥1e4 用「万」一位小数、否则 `money`）。首帧必须直接渲染终值（Task 21 会预渲染），动画只在 mount 后启动。
7. `useCopy` 复刻营销页 `copyText`：优先 `navigator.clipboard.writeText`，否则 `textarea + execCommand`，返回 `Promise<void>`。

**Verify:** `npm run typecheck`；写一个临时页同时打开 Modal/Toast/Pager/CountUp，和基线并排目检；键盘 Tab 在 Modal 内循环，Esc 关闭后焦点回到触发按钮。

**Commit:** `feat(web): add shared toast, modal, field, pager and count-up primitives`

---

## Task 4: 后台数据模型（types / util / demo）

**Files:**
- Create: `web/src/admin/data/types.ts`
- Create: `web/src/admin/data/util.ts`
- Create: `web/src/admin/data/demo.ts`
- Create: `web/src/admin/data/util.test.ts`、`web/src/admin/data/demo.test.ts`
- Create: `web/vitest.config.ts`
- Reference: `web/legacy/admin/assets/js/util.js`、`web/legacy/admin/assets/js/demo.js`

**Interfaces:**
```ts
// types.ts
export type OrderStatus = "pending" | "confirmed" | "shipped" | "completed" | "cancelled";
export type OrderItem = { id: number; product_id: number; product_name: string; quantity: number; unit_price: number; subtotal: number };
export type Product = {
  id: number; name: string; description: string; price: number; stock: number;
  image_url: string | null; plant_id: number | null;
  status: "active" | "inactive"; created_at: string; updated_at: string;
};
export type Plant = {
  id: number; name: string; scientific_name: string; category: string; image_url: string | null;
  yolo_class_id: number; care_level: number; beginner_friendly: number; description: string;
  light_requirement: string; water_requirement: string; watering_tip: string;
  temperature_range: string; humidity_range: string; is_toxic: boolean; features: string[];
  survival_rate: number; tips: string; common_mistakes: string; created_at: string;
};
export type User = {
  id: number; username: string; email: string; avatar_url: string | null; bio: string | null;
  is_email_verified: boolean; role: string; created_at: string;
};
export type Order = {
  id: number; order_no: string; user_id: number; user: User; total_amount: number;
  status: OrderStatus; delivery_type: "express" | "pickup"; delivery_address: string;
  contact_name: string; contact_phone: string; remark: string | null;
  items: OrderItem[]; created_at: string; updated_at: string;
};
export type Reading = {
  id?: number; device_code: string; soil_moisture: number; soil_temp: number;
  light_lux: number | null; firmware?: string; ip_address?: string | null; created_at: string;
};
export type Thresholds = {
  moistureMin: number; moistureMax: number; tempMin: number; tempMax: number;
  luxMin: number; luxMax: number; alarm: boolean;
};
export type Calibration = { airRaw: number; waterRaw: number; source: string };
export type Device = {
  id: number; code: string; name: string; location: string; firmware: string;
  ip_address: string | null; report_interval: number; enabled: boolean;
  last_seen: string | null; created_at: string;
  thresholds: Thresholds; calibration: Calibration; readings: Reading[];
};
export type Alert = {
  id: number; device_code: string; metric: string; label: string;
  value: number | null; threshold: number; direction: "below" | "above" | "near" | "missing" | "offline";
  level: "warn" | "danger"; at: string; acknowledged: boolean; hint: string;
};
export type AdminUser = { id: number; username: string; email?: string; role: string; avatar_url: string | null };
export type AdminData = { products: Product[]; plants: Plant[]; users: User[]; orders: Order[]; devices: Device[]; alerts: Alert[] };
export type ProductInput = Pick<Product, "name" | "description" | "price" | "stock" | "plant_id" | "status" | "image_url">;  // Task 15 amendment: 旧表单会提交图片地址
export type PlantInput = { name: string; /* 其余可写字段接受 string | null */ };  // Task 17 amendment: 旧表单用 null 表示空值
export type OrderPatch = { status: OrderStatus };

// util.ts
export const esc: (v: unknown) => string;       // 仅供 chart title/aria 与极少数需要转义的字符串
export const clamp: (v: number, min: number, max: number) => number;
export const sum: <T>(list: T[], pick?: (x: T) => number) => number;
export const money: (v: number) => string;
export const compactMoney: (v: number) => string;
export const num: (v: number, digits?: number) => string;
export const pct: (v: number, digits?: number) => string;
export const dateTime: (iso: string | number | Date) => string;
export const dayKey: (d: Date) => string;
export const startOfDay: (d: Date) => Date;
export const addDays: (d: Date, n: number) => Date;
export const relative: (iso: string | number | Date) => string;
export const pad: (n: number) => string;
export const seeded: (seed: number) => () => number;
export const STATUS_LABEL: Record<OrderStatus, string>;
export const DEVICE_STATE: Record<string, { label: string; tone: string }>;
// Task 4 amendment: legacy util.js 还有 7 个导出，后台视图直接依赖，一并逐字迁移
export const timeOnly: (value: string | number | Date) => string;
export const clockOnly: (value: string | number | Date) => string;
export const debounce: <Args extends unknown[]>(fn: (...args: Args) => void, wait?: number) => (...args: Args) => void;
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }>;
export const DELIVERY_TYPE: Record<string, string>;
export const PRODUCT_STATUS: Record<string, { label: string; tone: string }>;
export const CARE_LEVEL: Record<number, { label: string; tone: string }>;
export function toCsv(rows: (string | number | null)[][]): string;
export function downloadCsv(filename: string, csv: string): void;

// demo.ts
export const DEMO_NOW: number;
export const demoProducts: Product[];
export const demoPlants: Plant[];
export const demoUsers: User[];
export const demoOrders: Order[];
export const demoDevices: Device[];
export const demoAlerts: Alert[];
export const DEMO_ADMIN: AdminUser;
export function createDemoState(): AdminData;
export function demoStats(days?: number): {
  total_sales: number; order_count: number; avg_order_value: number; user_count: number;
};
export function demoProductRanking(days?: number): {
  product_id: number; product_name: string; sales_count: number; sales_amount: number;
}[];
export function demoTrend(days?: number): { labels: string[]; sales: number[]; orders: number[] };
```

**Steps:**

1. 逐字迁移 `util.js` 的 11 个导出；`esc` 保留但缩小用途（React 已自动转义；图表 label 仍可能需要）。`dateTime` / `relative` 的中文输出（「刚刚」「3 分钟前」「昨天 14:20」等）逐字复刻。
2. 逐字迁移 `demo.js`：`PRODUCT_SEED`、`PLANT_SEED`、`USER_SEED`、订单生成、`DEVICE_SEED`、`buildReadings`、`demoAlerts`。`structuredClone` 保持。`image_url` 从 `../assets/x.jpg` 改为 `/assets/x.jpg`。
3. 写 `demo.test.ts`：
   ```ts
   import { describe, it, expect } from "vitest";
   import { createDemoState, demoStats } from "./demo";

   describe("demo dataset", () => {
     it("locks the 14-day KPI contract", () => {
       const s = demoStats(14);
       expect(s.total_sales).toBeCloseTo(2333.7, 2);
       expect(s.order_count).toBe(21);
       expect(s.avg_order_value).toBeCloseTo(111.13, 2);
       expect(s.user_count).toBe(8);
     });
     it("ships six devices, four online", () => {
       const { devices } = createDemoState();
       expect(devices).toHaveLength(6);
       expect(devices.filter((d) => d.code !== "FG-ESP32-004" && d.code !== "FG-ESP32-006")).toHaveLength(4);
       expect(devices[0].readings).toHaveLength(145);
     });
     it("keeps the order total arithmetic consistent", () => {
       for (const o of createDemoState().orders) {
         const sum = o.items.reduce((s, i) => s + i.subtotal, 0);
         expect(o.total_amount).toBeCloseTo(sum, 2);
       }
     });
   });
   ```
   若 `readings` 长度不是 145（24h × 6/h + 1），以实际基线为准并在此写明原因，不得改生成逻辑去迎合测试。
4. 写 `util.test.ts`：`money(2333.7) === "¥2,333.70"`、`compactMoney(2333.7) === "¥2,333.70"`、`compactMoney(12345) === "¥1.2万"`、`num(2333.7) === "2,334"`、`dayKey` 补零、`seeded` 前三个数与基线一致（从旧实现跑一次取值）。
5. 写 `vitest.config.ts`：
   ```ts
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     test: { environment: "node", include: ["src/**/*.test.ts"] },
   });
   ```

**Verify:** `npm test` 全绿；4 个 KPI 与基线页面显示一致。

**Commit:** `feat(web): port admin data model, demo seed and formatting utils`

---

## Task 5: 派生 selector

**Files:**
- Create: `web/src/admin/data/selectors.ts`
- Create: `web/src/admin/data/selectors.test.ts`
- Reference: `web/legacy/admin/assets/js/store.js` 第 124–298 行

**Interfaces:**
```ts
export type DeviceIssue = { metric: "online" | "moisture" | "temp" | "lux"; level: "warn" | "danger"; text: string };

export function latestReading(device: Device): Reading | null;
export function isOnline(device: Device, now?: number): boolean;
export function deviceIssues(device: Device, now?: number): DeviceIssue[];
export function deviceState(device: Device, now?: number): "online" | "alarm" | "offline";
export function deviceByCode(data: AdminData, code: string): Device | null;
export function sensorSummary(data: AdminData, now?: number): {
  total: number; online: number; offline: number; alarm: number; avgMoisture: number;
};
export function pendingAlerts(data: AdminData): Alert[];
export function rangeStart(days: number, now?: number): Date;
export function ordersInRange(data: AdminData, days: number, now?: number): Order[];
export function computeOverview(data: AdminData, days?: number, now?: number): {
  total_sales: number; order_count: number; avg_order_value: number; user_count: number;
};
export function computeTrend(
  data: AdminData, days?: number, groupBy?: "day" | "week" | "month", now?: number,
): { labels: string[]; sales: number[]; orders: number[] };
export function computeUserTrend(data: AdminData, days?: number, now?: number): number[];   // 每日新增用户数
export function movingAverage(values: number[], window?: number): number[];
export function computeAovTrend(data: AdminData, days?: number, now?: number): number[];   // 滚动客单价
export function computeStatusBreakdown(data: AdminData, days?: number, now?: number): Record<OrderStatus, number>;
export function computeRanking(data: AdminData, days?: number, limit?: number, now?: number): {
  product_id: number; product_name: string; sales_count: number; sales_amount: number;
}[];
export function moistureHeatmap(data: AdminData, now?: number): { label: string; cells: (number | null)[] }[];
export function hourHistogram(data: AdminData, days?: number, now?: number): number[];
```

**Steps:**

1. 逐条迁移旧逻辑，**保留旧返回字段名**（`total_sales` / `order_count` / `avg_order_value` / `user_count`），不要改成 camelCase：视图与测试都按旧名读。
2. 旧实现直接读模块级 `store.data`；新实现把 `data` 作为第一个参数显式传入，并给所有依赖「现在几点」的函数加 `now` 参数：
   - `isOnline(device, now = Date.now())`
   - `deviceIssues(device, now = Date.now())`（旧实现用 `new Date().getHours()` 判断白天，改成从 `now` 取小时，默认值不变）
   - `deviceState(device, now)`、`sensorSummary(data, now)`、`moistureHeatmap(data, now)`、`hourHistogram(data, days, now)`
   - 这样测试可以注入固定时间，不随运行时刻漂移。
3. 公式不要改：客单价 = 销售额 / 订单数（不 `round2`，显示层再格式化）；排行只统计 `completed` + `shipped`；`deviceState` 优先级 `offline → alarm → online`；`deviceIssues` 的文案逐字保留（`设备离线`、`湿度低于下限`、`光照传感器无读数` 等）。
4. `computeTrend` 支持 `"day" | "week" | "month"` 三种分桶，周键算法 `2026-W34` 逐字复刻。
5. 写测试：以 `createDemoState()` 为输入，断言：
   - `computeOverview(data, 14)` → `{ total_sales: 2333.7, order_count: 21, avg_order_value: 2333.7 / 21, user_count: 8 }`
   - `computeTrend(data, 14).sales` 长度 14，总和 ≈ 2333.7；`.labels` 是 `YYYY-MM-DD`
   - `sensorSummary(data)` → `total: 6, online: 4, offline: 2`（`alarm` 与 `avgMoisture` 用受控 fixture 断言：把某台设备 `last_seen` 设为 10 秒前（在线判定窗口是 90 秒，不是分钟级）、读数设到下限以下，再传固定 `now`）
   - `computeStatusBreakdown(data, 14)` 五项之和 = 21
   - `computeRanking(data, 14)` 第一条与基线一致
   - `movingAverage([1,2,3], 2)` → `[1, 1.5, 2.5]`

**Verify:** `npm test` 全绿，且连续跑三次结果一致（没有时间漂移）。

**Commit:** `feat(web): port admin selectors with typed inputs and snapshot tests`

---

## Task 6: API 客户端

**Files:**
- Create: `web/src/admin/data/api.ts`
- Create: `web/src/admin/data/api.test.ts`
- Reference: `web/legacy/admin/assets/js/api.js`（112 行，逐行对照）

**Interfaces:**
```ts
export const DEFAULT_API_BASE = "http://localhost:8000";
export function apiBase(): string;
export function setApiBase(value: string): void;
export function getToken(): string;
export function setToken(token: string): void;
export class ApiError extends Error { status: number; }
export function login(username: string, password: string): Promise<{ access_token: string }>;
export const api: {
  me(): Promise<AdminUser>;
  products(limit?: number): Promise<{ items: Product[] }>;
  createProduct(body: ProductInput): Promise<Product>;
  updateProduct(id: number, body: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: number): Promise<null>;
  orders(limit?: number): Promise<{ items: Order[] }>;
  updateOrder(id: number, body: OrderPatch): Promise<Order>;
  users(limit?: number): Promise<{ items: User[] }>;
  plants(limit?: number): Promise<{ items: Plant[] }>;
  createPlant(body: PlantInput): Promise<Plant>;
  updatePlant(id: number, body: Partial<PlantInput>): Promise<Plant>;
  deletePlant(id: number): Promise<null>;
  statsOverview(): Promise<unknown>;
  statsTrend(groupBy?: "day" | "week"): Promise<unknown>;
  statsProducts(limit?: number): Promise<unknown>;
  devices(): Promise<{ items: Device[] }>;
  createDevice(body: { code: string; name: string; location: string }): Promise<Device>;
  device(code: string): Promise<Device>;
  updateDevice(code: string, body: Partial<Device>): Promise<Device>;
  deviceReadings(code: string, hours?: number): Promise<{ items: Reading[] }>;
  deviceAlerts(): Promise<{ items: Alert[] }>;
  acknowledgeAlert(id: number): Promise<Alert>;
  sensorsOverview(): Promise<unknown>;
};
```

**Steps:**

1. 复刻 `request()`：`Authorization: Bearer <token>`（`auth !== false` 时）、`AbortController` + 12s 超时、`FormData` 用 `URLSearchParams` 且 `Content-Type: application/x-www-form-urlencoded`、JSON 用 `application/json`、非 2xx 时把 `detail`（数组则 `msg` 用 `；` 连接）塞进 `ApiError`、`AbortError` → 「请求超时，请检查后端是否启动」。
2. `apiBase()` 优先级：`?api=` > `localStorage["fg_api_base"]` > `http://localhost:8000`，末尾斜杠去掉。
3. 写测试（注入 `globalThis.fetch` 与内存 `localStorage` 桩）：
   - `apiBase()` 三个优先级
   - 非 2xx 且 `detail` 为数组 → `ApiError.message === "a；b"`
   - 超时 → 指定文案（用 `AbortController` 桩或 `vi.useFakeTimers()`）
   - `login` 成功后 `localStorage["fg_admin_token"]` 被写入

**Verify:** `npm test` 全绿；不依赖真实后端。

**Commit:** `feat(web): port typed FastAPI client with token and base-url handling`

---

## Task 7: 数据 Provider

**Files:**
- Create: `web/src/admin/data/store.tsx`
- Create: `web/src/admin/data/store.test.tsx`（可选，至少覆盖 demo 写操作）
- Reference: `web/legacy/admin/assets/js/store.js` 第 1–100、300–429 行

**Interfaces:**
```tsx
export type AdminDataValue = {
  source: "demo" | "live";
  isDemo: boolean;
  admin: AdminUser;
  data: AdminData;
  lastSync: number;
  syncing: boolean;
  toasts: ToastItem[];
  toast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  refresh: () => Promise<void>;
  logout: () => void;
  resetDemo: () => void;
  saveProduct: (payload: ProductInput, id?: number) => Promise<void>;
  removeProduct: (id: number) => Promise<void>;
  saveOrder: (id: number, payload: OrderPatch) => Promise<void>;
  savePlant: (payload: PlantInput, id?: number) => Promise<void>;
  removePlant: (id: number) => Promise<void>;
  saveDevice: (code: string, payload: Partial<Device>) => Promise<void>;
  createDevice: (payload: { code: string; name: string; location: string }) => Promise<void>;
  acknowledgeAlert: (id: number) => Promise<void>;
};
export function AdminDataProvider({ children }: { children: React.ReactNode }): JSX.Element;
export function useAdminData(): AdminDataValue;
```

**Steps:**

1. 初始状态严格复刻：
   ```tsx
   const [source, setSource] = useState<"demo" | "live">(() => (getToken() ? "live" : "demo"));
   const [data, setData] = useState<AdminData>(() => createDemoState());
   const [admin, setAdmin] = useState<AdminUser>(DEMO_ADMIN);
   const [lastSync, setLastSync] = useState(0);
   const [syncing, setSyncing] = useState(false);
   ```
   **不要**在 mount 时自动 `loadLive()`。这一条是 Review Focus #2。
2. `loadLive()` 逐行复刻旧实现（注意不是「8 个请求一把抓」）：
   ```ts
   const [me, products, orders, users, plants, devices] = await Promise.all([
     api.me(),
     api.products(200),
     api.orders(200),
     api.users(200),
     api.plants(200),
     api.devices().catch(() => null),
   ]);
   // 写入 admin / products / orders / users / plants
   if (devices) {
     const rows = Array.isArray(devices) ? devices : devices.items ?? [];
     // normalizeDevice 逐条
     const alerts = await api.deviceAlerts().catch(() => null);
     if (alerts) {
       const list = Array.isArray(alerts) ? alerts : alerts.items ?? [];
       // normalizeAlert 逐条
     }
   } else {
     // devices = []; alerts = [];
   }
   setSource("live");
   setLastSync(Date.now());
   ```
   `devices` 失败**不**让整次同步失败（它有自己的 `catch`）；`alerts` 在 `devices` 成功后才请求，且失败也忽略。`finally` 里 `setSyncing(false)`。401/403 → 清 token、`setSource("demo")`、`resetDemo()`，然后把错误继续抛给调用方。
3. `refresh()`：demo → `resetDemo()`；live → `loadLive()`。**不要**在 `refresh()` 内统一弹 toast（旧实现由调用方弹，文案不同）。
4. 写操作逐条复刻旧 `store.js`：demo 分支「改内存 + 弹演示提示」；live 分支「调 API + `loadLive()` + 弹成功提示」。demo 分支的提示文案逐字一致（`演示模式：商品修改仅保存在当前会话` 等），并且**不要**把 store 提示与视图提示合并成一条。
5. `toast()` 生成自增 id，push 进队列，超过 4 条从头部裁掉；每条 3800ms 后 `dismissToast`。`ToastViewport` 由 `App` 渲染。
6. `logout()`：`setToken("")`、`setSource("demo")`、`setAdmin(DEMO_ADMIN)`、`resetDemo()`；路由跳转 `#/overview` 由调用方负责。
7. 写测试（React Testing Library 可选；若不想加依赖，用 `renderToString` + 行为函数抽离的方式，至少覆盖：demo 写操作后数据变化且两条 toast 都在）。

**Verify:** `npm test`；在临时页渲染 `<AdminDataProvider>` + 一个按钮调用 `saveProduct`，确认两次提示与内存更新。

**Commit:** `feat(web): add admin data provider with demo and live sources`

---

## Task 8: 后台壳与路由

**Files:**
- Create: `web/src/admin/App.tsx`
- Create: `web/src/admin/router.tsx`
- Create: `web/src/admin/layout/AppShell.tsx`、`Sidebar.tsx`、`Topbar.tsx`、`LoginShell.tsx`
- Create: `web/src/admin/views/Overview.tsx`、`Stats.tsx`、`Devices.tsx`、`DeviceDetail.tsx`、`Alerts.tsx`、`Products.tsx`、`Orders.tsx`、`Users.tsx`、`Plants.tsx`、`LoginPage.tsx`（本任务只建占位组件，后续任务逐个替换）
- Create: `web/src/admin/hooks/useDrawer.ts`、`useDocumentTitle.ts`、`useFocusableTables.ts`
- Modify: `web/src/admin/main.tsx`
- Reference: `web/legacy/admin/assets/js/app.js`（265 行）

**Interfaces:**
```tsx
// router.tsx
export const router: ReturnType<typeof createHashRouter>;

// AppShell.tsx
export function AppShell(): JSX.Element;   // 含 <Sidebar/> <div className="main"> <Topbar/> <main id="view" tabIndex={-1}> <Outlet/> </main> </div>

// hooks/useDrawer.ts
export function useDrawer(): {
  open: boolean;
  toggle: () => void;
  close: () => void;
  sidebarRef: React.RefObject<HTMLElement>;
  triggerRef: React.RefObject<HTMLButtonElement>;
};
```

**Steps:**

1. `router.tsx`：
   ```tsx
   export const router = createHashRouter([
     { path: "/login", element: <LoginPage /> },
     {
       path: "/",
       element: <AppShell />,
       children: [
         { index: true, element: <Navigate to="/overview" replace /> },
         { path: "overview", element: <Overview /> },
         { path: "stats", element: <Stats /> },
         { path: "devices", element: <Devices /> },
         { path: "devices/:code", element: <DeviceDetail /> },
         { path: "alerts", element: <Alerts /> },
         { path: "products", element: <Products /> },
         { path: "orders", element: <Orders /> },
         { path: "users", element: <Users /> },
         { path: "plants", element: <Plants /> },
         { path: "*", element: <Navigate to="/overview" replace /> },
       ],
     },
   ]);
   ```
2. `main.tsx`：`createRoot(...).render(<StrictMode><AdminDataProvider><RouterProvider router={router}/></AdminDataProvider></StrictMode>)`。注意 `StrictMode` 在开发态会双跑 effect；确保 `loadLive` 不在 mount effect 里。
3. 侧栏：分组 `工作台` / `传感器` / `经营` / `内容` 与图标名逐条复刻 `ROUTES`。`NavLink` 加 `aria-current="page"`；设备详情高亮 `devices`。底部 `sidebar__foot` 复刻数据源行、用户行、两个图标按钮、一个链接（demo → `#/login`，live → `../index.html`）。
4. 顶栏：菜单按钮、面包屑、数据源 pill、刷新按钮。面包屑 `运营后台 / <当前标题>`；登录页不渲染壳。
5. 顶栏刷新按钮（`#refresh`）复刻现状：demo 模式只重渲染当前视图、**不弹提示**；live 模式 `loadLive()` 后弹 `已同步实时接口数据`，失败弹 `同步失败：<message>`。
6. 抽屉 `useDrawer`：
   - `AppShell` 内渲染 `<button type="button" className="scrim" aria-label="关闭导航" hidden={!open} onClick={close} />` 作为 `.app` 的最后一个子节点（对应旧实现的动态 `drawerScrim`）；
   - `toggle()` → `open=true`，`sidebar.classList.add("is-open")`、`menuToggle aria-expanded="true"`、scrim `hidden=false`、焦点移到 `.nav-item.is-active` 或第一个 `.nav-item`；
   - `close()` → 移除类、`aria-expanded="false"`、scrim `hidden=true`、焦点回到 `triggerRef`（仅在原本打开时归还）；
   - Esc 关闭；点 scrim 关闭；
   - `useEffect`：`open` 时给 `.main` 元素设置 `inert`（`el.inert = true`，同时 `setAttribute("inert","")` 兜底），关闭时 `el.inert = false` 并移除属性。**作用对象是 `.main`，不是 `#view`**；
   - `matchMedia("(min-width: 981px)")` 的 change 监听：跨过 981px 自动关闭。
7. 标题与滚动：`useDocumentTitle` 监听 `useLocation()`，`ROUTES` 有标题则 `${title} · 护花使者运营后台`，登录页 `登录 · 护花使者运营后台`；路由切换（`location.pathname` 变化）滚到顶部，首屏不滚。
8. 宽表：`useFocusableTables(ref)` 在 layout 后遍历 `.table-wrap`，`scrollWidth > clientWidth + 1` 时设 `tabIndex=0`、`role="region"`、`aria-label="${h2/h3 文本}，可横向滚动查看"`，用 `ResizeObserver` 重新测量。
9. 视图切换动画：`#view` 在每次路由变化后先移除 `is-enter`，`requestAnimationFrame` 后加回（复刻 `void offsetWidth` 强制回流）。
10. 错误边界：在 `<Outlet/>` 外包一层 `ViewErrorBoundary`，渲染 `<div class="empty">alert 图标 + <b>页面载入失败</b> + <p>{message}</p> + 重试按钮</div>`，重试 = `navigate(0)`。
11. 视图文件先放占位组件（`<div className="empty">…`），保证 10 条路由都能进。
12. 跳转链接 `href="#view"` 保持原样，不要改成按钮或 `scrollIntoView`。它在 hash 路由下会被兜底路由带回 `#/overview`，这是现状行为；如果改了，属于行为变更，另开任务。

**Verify:** `npm run dev`；10 条 hash 直达；390 宽开抽屉后 Tab 不能到顶栏刷新按钮；Esc 关闭焦点回菜单按钮；跨到桌面宽度抽屉自动关；`document.title` 随路由变化；点「跳到内容」不报错。

**Commit:** `feat(web): build admin shell with hash router, drawer and page chrome`

---

## Task 9: 图表 A（折线 / 柱 / 迷你线）

**Files:**
- Create: `web/src/admin/charts/geometry.ts`
- Create: `web/src/admin/charts/TrendChart.tsx`、`BarChart.tsx`、`Sparkline.tsx`
- Create: `web/src/admin/charts/charts.module.css`
- Reference: `web/legacy/admin/assets/js/charts.js` 第 1–200 行

**Interfaces:**
```ts
// geometry.ts
export const VIZ: { leaf: string; coral: string; green: string; pink: string; mist: string; stone: string };
export const STATUS_COLOR: Record<OrderStatus, string>;
export function niceTicks(min: number, max: number, count?: number): number[];
export function smoothPath(points: [number, number][]): string;
export function isCompact(): boolean;   // 宽度 < 520

// TrendChart.tsx
export type TrendSeries = { key: string; values: number[]; color: string; label: string; dashed?: boolean };
export function TrendChart(props: {
  labels: string[]; series: TrendSeries[]; format: "money" | "int";
  ariaLabel: string; height?: number;
}): JSX.Element;

// BarChart.tsx
export function BarChart(props: {
  labels: string[]; values: number[]; color?: string; format?: "money" | "int";
  ariaLabel: string; height?: number;
}): JSX.Element;

// Sparkline.tsx
export function Sparkline(props: { values: number[]; color?: string }): JSX.Element;
```

**Steps:**

1. 建 `uid` 计数器，生成 `gradient` id（旧实现用 `viz${++uid}`）。不要用 `useId()` 除非确认 SSR/预渲染不参与后台。
2. 逐条迁移 `chart()` 的折线分支：viewBox、padding、Y 轴 4 条网格、`niceTicks`、平滑路径、hover 竖线与 tooltip（`<g>` + `aria-hidden`，外层 `role="img" aria-label`）。hover 用 React state 记录最近点索引，替代旧的手写 `mousemove`。
3. 柱状图迁移 `barChart()`：`barGrow` 动画类名与 `transform-box: fill-box` 相关样式保留。
4. `Sparkline` 迁移 `sparkline()`：无坐标轴、无 hover、`aria-hidden`。
5. 样式进 `charts.module.css`（只放图表内部新增类；`barGrow` / `arcIn` 等 keyframes 已存在于 `admin.css`，不要重复定义）。若必须新增，先确认 `admin.css` 里没有同名动画。
6. 临时页用固定数组渲染三张图，和 `web/legacy` 同数据并排截图（1440 与 390）。

**Verify:** 目检两条曲线拐点、柱高、网格线位置与基线一致；390 宽 Y 轴标签不重叠；`prefers-reduced-motion` 下无入场动画。

**Commit:** `feat(web): add line, bar and sparkline chart components`

---

## Task 10: 图表 B（环 / 横向排行 / 环形仪表 / 热力图）

**Files:**
- Create: `web/src/admin/charts/DonutChart.tsx`、`HBarChart.tsx`、`RingGauge.tsx`、`Heatmap.tsx`
- Modify: `web/src/admin/charts/geometry.ts`（如需共享弧线计算）
- Reference: `web/legacy/admin/assets/js/charts.js` 第 200–437 行

**Interfaces:**
```tsx
export function DonutChart(props: {
  items: { label: string; value: number; color: string }[];
  total: number; centerLabel?: string; centerValue?: string; ariaLabel: string;
}): JSX.Element;

export function HBarChart(props: {
  items: { label: string; value: number; sub?: string }[];
  format?: "money" | "int"; ariaLabel: string; max?: number;
}): JSX.Element;

export function RingGauge(props: {
  value: number; max: number; label: string; ariaLabel: string;
  color?: string; size?: number;
}): JSX.Element;

export function Heatmap(props: {
  rows: { label: string; cells: (number | null)[] }[];
  cols: string[]; min: number; max: number; unit: string; ariaLabel: string;
}): JSX.Element;
```

**Steps:**

1. 环图：`arcIn` 动画、扇区间隙、中心文案、`aria-label` 逐项列表（旧实现在 `<title>` 或相邻文本；保持一致）。
2. 横向排行：`hbarIn` 动画、名次、条形宽度按最大值归一、右侧金额用 `compactMoney`。
3. 环形仪表：`ringIn` 动画、轨道色 `--viz-grid`、进度色可传；中心百分比用 `num(value)`。
4. 热力图：`cellIn` 动画、`null` 单元格样式（斜纹或空格，按基线）、行列标签、颜色插值用 `min/max` 线性映射到 `--viz-5 → --viz-1`。
5. 每张图在临时页用真实演示数据渲染，与基线并排截图。

**Verify:** 圆环起止角、排行条长度、热力图颜色梯度与基线一致；键盘不进入图表内部（`role="img"` 不聚焦）；aria-label 文案逐字一致。

**Commit:** `feat(web): add donut, hbar, ring gauge and heatmap components`

---

## Task 11: 概览视图

**Files:**
- Create: `web/src/admin/views/Overview.tsx`
- Create: `web/src/admin/ui/Kpi.tsx`、`Badge.tsx`、`EmptyState.tsx`
- Reference: `web/legacy/admin/assets/js/views/overview.js`（245 行）

**Interfaces:**
```tsx
export function Kpi(props: {
  label: string; value: string; meta: React.ReactNode; icon: string;
  count?: number; format?: "int" | "money"; spark?: number[]; sparkColor?: string; tone?: string;
}): JSX.Element;
export function Badge(props: { children: React.ReactNode; tone?: string; plain?: boolean }): JSX.Element;
export function EmptyState(props: { icon: string; title: string; children?: React.ReactNode }): JSX.Element;
```

**Steps:**

1. 模块级 `let range = 14;`（Review Focus #8），`useState(range)` 仅用于触发重渲染，切换时同时写模块变量。
2. 页面结构逐字搬：`page-head`（`h1 概览` + 说明文案 + `刷新` 按钮）、4 张 KPI、销售趋势卡、订单状态环卡、履约率卡、设备注意列表、最近订单表。
3. `#ov-refresh` 刷新按钮只做「重渲染 + `toast("已刷新概览")`」，**不重置演示数据、不重新拉接口**（与旧实现一致）。
4. 4 个 KPI 数值按旧字段名读：`money(overview.total_sales)`、`num(overview.order_count)`、`money(overview.avg_order_value)`、`num(overview.user_count)`；meta 文案逐字（如「较上一周期」若存在则保留原逻辑）。`avg_order_value` 显示前用 `money()` 格式化，`2333.7 / 21 = 111.128…` → `¥111.13`。
5. 表格用 `.table-wrap`，`useFocusableTables` 已在壳里统一处理；不要在视图里重复设 `tabIndex`。
6. 空态：无订单时 `<EmptyState icon="receipt" title="还没有订单"/>`。
7. 与基线并排目检 1440 与 390。

**Verify:** KPI 显示 `¥2,333.70 / 21 / ¥111.13 / 8`；切 7/14/30 数字变化；`#ov-refresh` 后出现「已刷新概览」；离开再回来仍是上次区间。

**Commit:** `feat(web): port admin overview view with KPI cards and charts`

---

## Task 12: 统计视图

**Files:**
- Create: `web/src/admin/views/Stats.tsx`
- Reference: `web/legacy/admin/assets/js/views/stats.js`（356 行）

**Interfaces:** 无新导出；`compute(start, end, groupBy)` / `rank(start, end)` / `weekNumber` 在本文件内复刻，输入改为 selector + `data`。

**Steps:**

1. 模块级状态：`start`（默认 `dayKey(addDays(today, -13))`）、`end`（默认今天）、`groupBy = "day"`。**用字符串日期，不要存 `Date` 对象**，避免时区抖动。
2. 日期区间校验：起 > 止 时自动交换或提示（按基线行为）；无效日期回到默认区间。
3. 逐字迁移页面：区间选择、`按日/按周` 切换、趋势图、订单量柱、状态构成环、商品排行、时段热力图/柱、KPI 摘要。每个卡片标题与说明文案保持一致。
4. `groupBy === "week"` 时移动平均窗口 3，`day` 时 7（旧逻辑），不要统一。
5. 排行与状态过滤规则同 `computeRanking` / `computeStatusBreakdown`，但统计页用自己的 `start/end` 而不是「最近 N 天」，必须保留这个区别。
6. 与基线并排目检：默认 14 天、切 30 天、切按周、选一个 3 天区间。

**Verify:** 所有数字与基线一致；`aria-label` 与图例文案一致；390 宽图表可读。

**Commit:** `feat(web): port stats view with range picker and grouped charts`

---

## Task 13: 设备 + 设备详情

**Files:**
- Create: `web/src/admin/views/Devices.tsx`、`DeviceDetail.tsx`
- Create: `web/src/admin/ui/DeviceCard.tsx`
- Reference: `web/legacy/admin/assets/js/views/devices.js`（249 行）、`device-detail.js`（409 行）

**Interfaces:**
```tsx
// Devices
export function Devices(): JSX.Element;   // 模块级 query / filter
// DeviceDetail
export function DeviceDetail(): JSX.Element;  // useParams().code，decodeURIComponent
```

**Steps:**

1. `Devices`：模块级 `query = ""`、`filter = "all"`；筛选按钮（全部/在线/告警/离线）与搜索框行为逐字复刻；演示模式顶部 `note` 保留。
2. 卡片：设备名、编号、位置、固件、在线徽标、最近上报（`relative`）、湿度/土温/光照三个读数、阈值越界标记、`查看详情` 链接到 `#/devices/${encodeURIComponent(code)}`。
3. `接入设备` 弹窗：编号/名称/位置三个字段；重复编号弹 `设备编号已存在`；成功后 `设备档案已创建`；关闭弹窗。
4. `刷新读数`：只重新渲染列表 + `toast("设备读数已刷新")`，**不重新拉接口**（与旧实现一致）。
5. `DeviceDetail`：
   - 找不到 code → 页面级空态 + 返回链接（按基线）；
   - 页面头：设备名、编号、在线徽标、`返回设备列表`；
   - 读数区：24h 曲线（湿度/土温/光照三选一或三张，按基线）、无读数空态「近 24 小时没有读数」、无光照传感器空态「光照传感器无读数」+ 现有说明文案；
   - 阈值表单：6 个数字 + 告警开关；保存前校验 `下限 < 上限`，否则 `toast("下限必须小于上限", "error")`；成功 `阈值已保存`；
   - 标定表单：`airRaw > waterRaw` 校验，错误文案 `airRaw 应大于 waterRaw（干燥时 ADC 读数更高）`；成功 `标定记录已保存`；
   - 导出 CSV：无读数 `还没有可导出的读数`；成功 `读数已导出为 CSV`；文件名与列顺序按基线。
6. `normalizeDevice` 的字段兜底（`thresholds`、`calibration`、`readings`、`last_seen`）放进 Provider 的 live 组装里，视图只读。

**Verify:** 6 台设备卡片与基线一致；`FG-ESP32-005` 光照显示「无读数」而不是 0；阈值上下限颠倒时弹错误；CSV 内容与基线表头一致。

**Commit:** `feat(web): port devices list and device detail with thresholds`

---

## Task 14: 告警视图

**Files:**
- Create: `web/src/admin/views/Alerts.tsx`
- Reference: `web/legacy/admin/assets/js/views/alerts.js`（109 行）

**Steps:**

1. 模块级筛选状态（全部/待确认/已确认，若基线有）复刻。
2. 表格列：时间、设备、指标、读数、阈值、方向、级别、状态、操作；`min-width:820px` 与 `.table-wrap` 保留。
3. 行内 `确认` 按钮调用 `acknowledgeAlert(id)`，成功后 demo 模式会有两条提示（Provider 的「演示模式：告警已确认」+ 视图的「告警已确认」），**两条都保留**。
4. 已确认行样式（`is-ack` 或基线类名）保留。

**Verify:** 7 条演示告警；确认一条后状态变化且弹出两条提示；刷新后（demo 重置）回到未确认。

**Commit:** `feat(web): port alerts view with acknowledge flow`

---

## Task 15: 商品视图

**Files:**
- Create: `web/src/admin/views/Products.tsx`
- Create: `web/src/admin/ui/ProductForm.tsx`
- Reference: `web/legacy/admin/assets/js/views/products.js`（186 行）

**Steps:**

1. 模块级 `query = ""`、`page = 1`、`PAGE_SIZE`（从基线取实际值）。
2. 表格列：商品、价格、库存、关联植物、状态、更新时间、操作。搜索匹配「名称或描述」，大小写不敏感。
3. 新建/编辑弹窗字段：名称、描述、价格、库存、关联植物（下拉，选项来自 `data.plants`，含「不关联」）、状态。校验文案按基线；数字空值按 0 处理。
4. 删除：`Modal` 确认，确认后 `removeProduct(id)`，demo 模式两条提示（`演示模式：商品已从当前会话移除` + `商品已删除`）。
5. CSV：按钮位置、文件名、列顺序、BOM/换行按基线；无数据时按钮禁用或提示按基线。
6. 分页：`Pager` 与基线页码行为一致（搜索后回到第 1 页）。

**Verify:** 12 条商品；搜索「绿萝」剩 1 条；新建后出现在第 1 行且提示两条；删除后总数减 1；CSV 用 Numbers/Excel 打开中文不乱码。

**Commit:** `feat(web): port products view with CRUD, search and CSV export`

---

## Task 16: 订单视图

**Files:**
- Create: `web/src/admin/views/Orders.tsx`
- Create: `web/src/admin/ui/OrderDetail.tsx`
- Reference: `web/legacy/admin/assets/js/views/orders.js`（171 行）

**Steps:**

1. 模块级 `page`、`statusFilter`（若基线有）。
2. 表格列：订单号、用户、金额、状态、下单时间、操作；`min-width:900px`。
3. 详情弹窗：收件人、电话、地址、配送方式、备注、商品明细（名称 × 数量、单价、小计）、合计。
4. 状态流转：`<select>` 或按钮组按基线；保存调用 `saveOrder(id, { status })`；demo 两条提示（`演示模式：订单状态仅保存在当前会话` + `订单已更新`）。
5. 顶部 `数据统计` 链接指向 `#/stats`。

**Verify:** 21 条订单；改状态后表格即时更新；详情合计等于 `total_amount`；分页正确。

**Commit:** `feat(web): port orders view with status transitions and detail modal`

---

## Task 17: 用户 + 植物库

**Files:**
- Create: `web/src/admin/views/Users.tsx`、`Plants.tsx`
- Create: `web/src/admin/ui/PlantForm.tsx`
- Reference: `web/legacy/admin/assets/js/views/users.js`（133 行）、`plants.js`（197 行）

**Steps:**

1. `Users`：模块级 `page`、`query`；列：用户、邮箱、注册时间、验证状态、角色、简介；`min-width:820px`；只读，无写操作。
2. `Plants`：模块级 `page`、`query`；列：中文名/学名、类别、难度、光照、浇水、温度、湿度、毒性、更新时间、操作；`min-width:940px`。
3. `PlantForm` 字段与校验：中文名必填（`请填写中文名`），其余按基线。保存/删除走 `savePlant` / `removePlant`，demo 两条提示。
4. 图片缩略图（若基线有）用 `/assets/...`；缺图占位按基线。

**Verify:** 8 位用户；10 条植物；新建一条后总数 11；中文名留空弹 `请填写中文名`；搜索与分页正常。

**Commit:** `feat(web): port users and plants library views`

---

## Task 18: 登录页

**Files:**
- Create: `web/src/admin/views/LoginPage.tsx`
- Create: `web/src/admin/layout/LoginShell.tsx`
- Reference: `web/legacy/admin/assets/js/views/login.js`（108 行）

**Steps:**

1. 布局：左侧品牌区（logo、标题、说明、三条 facts、底部小字）、右侧表单。`body.is-login` 类在 mount 时加、unmount 时移除，保证 `admin.css` 的登录样式生效。
2. 表单：用户名、密码、`API Base` 输入（默认值 `apiBase()`）、`登录` 按钮、`以演示模式进入` 链接/按钮。
3. 登录流程：`login(username, password)` → `setApiBase(value)`（若非空）→ `loadLive()` → `navigate("/overview")`；失败 `toast(error.message, "error")`。
4. 演示入口：清除 token、确保 demo、`navigate("/overview")`。
5. 记住 API Base：输入变化即 `setApiBase` 或提交时写，按基线。
6. 密码框 `autoComplete="current-password"`；表单 `onSubmit` 阻止默认。

**Verify:** 错误密码弹后端 `detail`；正确密码进概览且 pill 显示「实时接口」；`?api=http://...` 覆盖生效；直接访问 `#/login` 不渲染侧栏。

**Commit:** `feat(web): port admin login with live connection and demo entry`

---

## Task 19: 营销页静态区

**Files:**
- Create: `web/src/site/App.tsx`、`web/src/site/sections/*.tsx`、`web/src/site/data/*.ts`
- Modify: `web/src/site/main.tsx`
- Reference: `web/legacy/index.html`（581 行）

**Interfaces:**
```ts
// data/plants.ts
export const CARE: Record<"pothos"|"monstera"|"snake"|"peace"|"aloe"|"ivy", CarePlant>;
export const FINDER: Record<PlantKey, FinderPlant>;

// data/faq.ts
export const FAQ: { q: string; a: string }[];

// data/features.ts
export const FEATURES: { icon: string; title: string; body: string; span?: string }[];

// data/spec.ts
export const SPEC: { label: string; value: string }[];
```

**Steps:**

1. 先跑基线并截图：`python3 -m http.server 4178`，截 1440×900 与 390×844 的 11 个区块。存到会话临时目录。
2. 逐段搬 HTML 到组件：`Nav`、`Hero`、`Intro`、`CareCard`、`Finder`、`How`、`Features`、`Spec`、`Faq`、`Cta`、`Footer`。`class` → `className`；`for` → `htmlFor`；自闭合标签补 `/`。**不要**改写文案或嵌套层级。
3. `<i data-icon="X" data-size="N">` 保留原来的包裹元素（通常是 `<i>`），内部换成 `<SiteIcon name="X" size={N} />`。**不要**把 `<i>` 直接改成 `<svg>`：CSS 里可能按标签或父级选择器定位，改标签会带来无声的布局漂移。
4. `img` 的 `src` 改 `/assets/...`；保留 `width/height/alt/loading/decoding`。
5. 6 张养护卡数据、6 个 finder 植物参数、6 条 FAQ、features/spec 文案抽到 `data/`。数字与标签逐字保留（`18–28℃` 用 en dash，不是 `-`）。
6. `CareCard` 初始渲染绿萝（`tab-pothos` 选中），与基线首屏一致；交互在 Task 20 接。
7. `index.html` 的 `<noscript>` 保留；若有 `<link rel="preload">` 等资源提示，路径同步改。

**Verify:** 1440 与 390 下逐段与基线截图并排，无位移、无字号差异、无图片变形；禁用 JS 时（Task 21 之后）文案仍在。

**Commit:** `feat(web): port marketing page static sections to React`

---

## Task 20: 营销页交互

**Files:**
- Create: `web/src/site/hooks/useNavScroll.ts`、`useCareTabs.ts`、`useFinder.ts`、`useApplicationCopy.ts`、`useReveal.ts`
- Modify: `web/src/site/sections/Nav.tsx`、`CareCard.tsx`、`Finder.tsx`、`Cta.tsx`
- Reference: `web/legacy/assets/app.js`（551 行）

**Interfaces:**
```ts
export function useCareTabs(): {
  active: PlantKey; select: (key: PlantKey, focus?: boolean) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  tabRefs: React.MutableRefObject<Record<PlantKey, HTMLButtonElement | null>>;
};
export function useFinder(): {
  step: number; answers: Partial<Record<"light"|"time"|"pets", string>>;
  busy: boolean; done: boolean; result: FinderResult | null;
  pick: (value: string) => void; restart: () => void;
};
export function useApplicationCopy(): {
  nickname: string; setNickname: (v: string) => void;
  place: string; setPlace: (v: string) => void;
  os: string; setOs: (v: string) => void;
  copied: boolean; note: string; manualText: string | null; status: string;
  submit: () => Promise<void>;
};
```

**Steps:**

1. `useNavScroll`：`is-scrolled = scrollY > 8`，`passive` 监听；菜单开合、点链接关闭、Esc 关闭、点外部关闭；`aria-expanded` 与 `aria-label` 同步。初始 `false`（SSR 安全）。
2. `useCareTabs`：点击切换；方向键循环、`Home`/`End`；`tabIndex` roving（选中 0，其余 -1）；切换后 `panel` 重新触发 `is-switch` 动画（移除类 → `void offsetWidth` → 加回）；可选聚焦到新 tab。
3. `useFinder`：三步，选项点击后 `busy` 170ms 再前进；第三步算分：`light`/`time` 匹配 + `pets` 过滤有毒植物；排序按 `order`，取第一名 + 两个备选；结果区 `aria-live="polite"`；`重新选一次` 清空并回第 1 步。评分函数抽成纯函数 `rankPlants(answers)` 并写单测（`src/site/data/finder.test.ts`），断言基线三种答案组合的结果。
4. `useApplicationCopy`：申请文本格式逐字复刻：
   ```
   护花使者内测申请
   植物：<昵称或"我的第一盆植物">
   摆放位置：<place>
   想装的系统：<os>
   ```
   复制成功：按钮 `is-copied`、「已复制」2.6s、note 文案、`aria-live` 文案；失败：note 换文案、插入 readonly `textarea#beta-manual` 并选中、`aria-live` 提示手动复制。4s 后 note 复位。
5. `useReveal`：`IntersectionObserver`（`rootMargin: "0px 0px -6% 0px"`, `threshold: 0.08`），`transitionDelay = min(index * 55, 260)ms`，进入后加 `in` 并 unobserve；无 IO 时直接加 `in`；`prefers-reduced-motion` 由 CSS 处理，hook 不改逻辑。
6. 所有 hook 的初始状态必须确定（不读 `window`），保证预渲染可用。

**Verify:** 键盘在 6 个 tab 间移动；finder 三种组合结果与基线一致；剪贴板拒绝时出现手动框（用 Playwright 覆盖）；reveal 在滚动时逐个出现；390 宽菜单开合与外部点击关闭。

**Commit:** `feat(web): port marketing interactions with hooks and tests`

---

## Task 21: 预渲染 + hydrate

**Files:**
- Create: `web/src/site/entry-server.tsx`
- Create: `web/scripts/prerender.mjs`
- Modify: `web/src/site/main.tsx`
- Modify: `web/package.json`（`build` 追加 `&& node scripts/prerender.mjs`）

**Interfaces:**
```tsx
// entry-server.tsx
export function renderSite(): string;
```

**Steps:**

1. `main.tsx`：
   ```tsx
   import { hydrateRoot, createRoot } from "react-dom/client";
   import { SiteApp } from "./App";
   import "./styles/site.css";

   const el = document.getElementById("root")!;
   const app = <SiteApp />;
   if (el.hasChildNodes()) hydrateRoot(el, app);
   else createRoot(el).render(app);
   ```
2. `entry-server.tsx`：
   ```tsx
   import { renderToString } from "react-dom/server";
   import { SiteApp } from "./App";
   export function renderSite(): string {
     return renderToString(<SiteApp />);
   }
   ```
3. `scripts/prerender.mjs`：
   ```js
   import { readFile, writeFile } from "node:fs/promises";
   import { createServer } from "vite";

   const file = new URL("../dist/index.html", import.meta.url);
   const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
   try {
     const { renderSite } = await vite.ssrLoadModule("/src/site/entry-server.tsx");
     const html = renderSite();
     const source = await readFile(file, "utf8");
     if (!source.includes('<div id="root"></div>')) {
       throw new Error("prerender: #root placeholder not found in dist/index.html");
     }
     await writeFile(file, source.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
   } finally {
     await vite.close();
   }
   ```
4. 处理 SSR 不兼容点：入口若 `import "./styles/site.css"` 在服务端会报错，把 CSS import 只放在 `main.tsx`，`entry-server.tsx` 不引样式；任何 `window`/`document`/`localStorage` 只在 effect 内访问。
5. 构建并检查 `dist/index.html`：`#root` 内有完整首屏 HTML；`<script type="module" crossorigin src="/assets/site-*.js">` 仍在。
6. 用 `python3 -m http.server 4177` 从 `dist/` 起服务，禁用 JS（DevTools 或 Playwright `javaScriptEnabled: false`），确认 hero 标题、文案、图片可见。
7. hydrate 后无 console warning（尤其 `<details open>`、`<img>` 属性、空白文本节点、`SiteIcon` 的 `<defs>` id）。`SiteIcon` 的 id 后缀来自 `useId`，只在单个 React root 内唯一；本页只有一个 root 才能保持服务端/客户端一致，不要在同一页面挂第二个 root。

**Verify:** 无 JS 首屏可见；有 JS 时交互正常且无 hydration mismatch；`?snap` 下首屏直接可见（`.js` 未加，`.reveal` 不隐藏）；`dist/admin/index.html` 仍为空 `#root`（后台不预渲染）。

**Commit:** `feat(web): prerender marketing page and hydrate on load`

---

## Task 22: QA 套件

**Files:**
- Create: `web/qa/lib.mjs`、`web/qa/run.mjs`、`web/qa/smoke.mjs`、`web/qa/a11y.mjs`、`web/qa/drawer.mjs`、`web/qa/motion.mjs`、`web/qa/site.mjs`
- Modify: `web/package.json`（devDependencies 加 `playwright`、`@axe-core/playwright`）

**Interfaces:**
```js
// lib.mjs
export const BASE = "http://127.0.0.1:4177";
// [hash 路由, <title> 片段, <h1> 文本片段]
export const ROUTES = [
  ["overview", "概览", "概览"],
  ["stats", "数据统计", "数据统计"],
  ["devices", "花盆设备", "花盆设备"],
  ["devices/FG-ESP32-001", "客厅 · 绿萝", "客厅 · 绿萝"],
  ["alerts", "告警记录", "告警记录"],
  ["products", "商品管理", "商品管理"],
  ["orders", "订单管理", "订单管理"],
  ["users", "用户管理", "用户管理"],
  ["plants", "植物库", "植物库"],
  ["login", "登录", "让每一只花盆"],
];
export async function withPage(browser, fn, viewport = { width: 1440, height: 900 });
export async function gotoAdmin(page, route);
export async function settle(page);
```

**Steps:**

1. `run.mjs`：先 `execSync("npx vite build")`（或 `npm run build`，含预渲染），再 `spawn("npx", ["vite", "preview", "--port", "4177", "--strictPort"])`，轮询 `fetch(BASE)` 直到 200（最多 30s），依次 `import` 各脚本并 `await`，最后 `kill`。退出码非 0 时打印失败脚本名，并确保 `finally` 里关进程。
2. `smoke.mjs`：每个路由在 1440 与 390 打开；断言 `document.title` 含预期标题片段、`h1` 文本、无 `console.error`、无 `pageerror`、`document.documentElement.scrollWidth <= innerWidth + 1`、所有 `img` 的 `naturalWidth > 0`。
3. `a11y.mjs`：每路由 × 2 宽度，`new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze()`，断言 `violations.length === 0`；失败时打印 `id/node/html`。
4. `drawer.mjs`（390）：点菜单 → 断言侧栏可见、`.main` 有 `inert`、焦点在侧栏内；按 Tab 多次，断言焦点不落在 `#refresh`；Esc → 侧栏关闭、`.main` 无 `inert`、焦点回 `#menu-toggle`；`setViewportSize(1200, 900)` → 自动关闭。
5. `motion.mjs`：`emulateMedia({ reducedMotion: "reduce" })`，进概览，断言 `getAnimations()` 计数为 0（或忽略 `transition: none` 的静态节点，按实际调整）；再 `reducedMotion: "no-preference"` 确认至少有 1 个动画，防止断言空转。
6. `site.mjs`：`/` 在 1440 与 390（截图/断言前加 `?snap` 关掉 reveal 隐藏）：导航开合、6 个 tab（点击 + 方向键）、finder 完整一轮并断言结果名、`重新选一次`、FAQ 展开、复制成功路径（用 `context.grantPermissions(["clipboard-read","clipboard-write"])`）与失败路径（`page.addInitScript` 删除 `navigator.clipboard` 并让 `execCommand` 返回 false）、无横向溢出。另开一次不带 `?snap` 的页面，断言滚动后 `.reveal.in` 数量增加。
7. `package.json` 加 `"qa": "node qa/run.mjs"`；文档写明首次需 `PATH=/opt/homebrew/bin:$PATH npx playwright install chromium webkit`。

**Verify:** `npm run build && npm run qa` 全绿；故意把某页 `h1` 改错能失败（验证脚本不是空转）。

**Commit:** `test(web): add playwright and axe regression suite`

---

## Task 23: 清尾 + 全量回归

**Files:**
- Delete: `web/assets/`（迁完后仅剩 `app.js`、`style.css`、`icons.js`）、`web/admin/assets/`
- Delete: `web/legacy/`
- Modify: `web/README.md`、根 `README.md`（只改过时的 Next.js 描述）、`.gitignore`
- Modify: `docs/plans/2026-11-15-admin-console-functional-analysis.md`（顶部加过期提示）

**Steps:**

1. 逐屏最后一遍并排对照（1440 与 390），确认无遗漏后删除旧目录：
   ```bash
   cd /Users/ember/Flower_Guardian
   git rm -r web/assets web/admin/assets
   rm -rf web/legacy
   ```
2. `web/README.md` 重写为当前事实：目录结构、`PATH=/opt/homebrew/bin:$PATH`、`dev/build/preview/test/qa`、静态部署（`dist/` 丢到任意静态服务器）、浏览器基线（Chrome/Edge 102+、Safari 15.5+、Firefox 112+）、实时接口配置（`?api=`、`fg_api_base`、`fg_admin_token`）、演示数据说明。
3. 根 `README.md` 找到「Next.js 14 / Tailwind / /admin」的过时段落，改为「`web/` 为 Vite + React + TypeScript 静态站点，`/` 营销页、`/admin/` 运营后台」，不重写其他章节。
4. 在旧计划文档顶部加一行：`> 注：本文档写作时 web/ 尚不存在；前端技术栈与目录以 docs/superpowers/specs/2026-11-19-web-react-refactor-design.md 与 web/README.md 为准。`
5. 全量回归：
   ```bash
   cd web
   PATH=/opt/homebrew/bin:$PATH npm run typecheck
   PATH=/opt/homebrew/bin:$PATH npm test
   PATH=/opt/homebrew/bin:$PATH npm run build
   PATH=/opt/homebrew/bin:$PATH npm run qa
   ```
6. 静态托管验证：
   ```bash
   cd dist && python3 -m http.server 4177 --bind 127.0.0.1
   ```
   `/`、`/admin/`、`/admin/#/devices/FG-ESP32-001` 均正常；刷新不 404。
7. 包体积与偏好退化：
   ```bash
   cd /Users/ember/Flower_Guardian/web
   for f in dist/assets/admin-*.js; do echo -n "$f "; gzip -c "$f" | wc -c; done
   for f in dist/assets/site-*.js dist/assets/index-*.js; do echo -n "$f "; gzip -c "$f" | wc -c; done
   ```
   后台首屏 ≤ 250 kB、营销页 ≤ 200 kB（软目标；超出要在交付说明里写原因，不能默默放过）。再手动切 `prefers-reduced-transparency: reduce` 与 `prefers-contrast: more`，确认后台材质层与对比度退化路径仍生效。
8. 手动实时验收（前置：本地 FastAPI + `role=admin` 账号，记录后端分支/提交与账号来源）：
   - 登录 → 概览 → pill「实时接口」；
   - 写一次商品/订单/告警 → 数据刷新、提示正确；
   - 带 token 刷新页面 → pill 仍实时、数据为演示值、点刷新后拉取（这是**预期**行为）；
   - 把 token 改坏后点刷新 → 401/403 回演示、pill 回演示；
   - 退出登录 → 回演示、回概览。
9. 记录交付说明：哪些验收跑了、哪些没跑、为什么；不把「未验证」写成「通过」。

**Verify:** 上面 4 条 npm 命令全绿；包体积在软目标内或有说明；实时验收结果如实记录；`git status` 里没有 `dist/`、`node_modules/`、`legacy/`。

**Commit:** `chore(web): remove legacy assets, document build and finish regression`

---

## 附：执行时的常见坑

- **不要用 `head`/`tail` 读 JSX 后就改写。** 所有中文文案以 `web/legacy/` 文件为唯一来源，复制粘贴而不是默写。
- **`inert` 在 React 里不是标准 prop。** 用 `useEffect` 设 `el.inert = true` / `removeAttribute("inert")`，类型上可能需要 `(el as HTMLElement & { inert: boolean }).inert`。
- **`structuredClone` 在 Vitest node 环境可用**（Node 24），不需要 polyfill。
- **`DEMO_NOW` 是模块加载时的 `Date.now()`**，所以快照测试要在同一进程内先 import 再断言；不要跨进程比较时间序列的绝对日期，只比较长度与总和。
- **`toLocaleString("zh-CN")`** 在 Node 与浏览器都受 ICU 影响；断言 `money()` 用字符串，不改 locale。
- **图表 hover** 在 React 里用 `onPointerMove` + `onPointerLeave`，不要给每个点绑 `mouseenter`（会拖慢 145 点 × 3 条线）。
- **Playwright 的 `page.goto(BASE + "/admin/#/overview")`** 只触发一次 hash 变化；在 SPA 内跳路由后要 `settle()` 等 `#view` 更新，不要用 `waitForTimeout(1000)` 代替断言。
- **`npm run dev` 与 `npm run preview` 都占 4177**，QA 跑之前先关 dev server。
- **提交前 `git diff --check`**，避免行尾空格混入。
