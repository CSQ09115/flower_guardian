# Web 前端 React 重构设计

- 日期：2026-11-19（2026-11-20 批准）
- 范围：`web/`（运营后台 `/admin/` + 产品介绍页 `/`）
- 状态：已批准
- 取代：`docs/plans/2026-11-15-admin-console-functional-analysis.md` 中与前端技术栈、目录、路由、配色相关的章节（该文档写作时 `web/` 尚不存在，且其 `/settings` 路由、RBAC、旧配色方案与当前实现不符）

## 1. 一句话

把现在这套零依赖、手写 DOM 的静态站点，原地改造成 Vite + React + TypeScript 的多入口工程：视觉、文案、交互、演示数据和无障碍行为全部保持现状，只替换实现方式。

## 2. 背景与现状

`web/` 目前是可直接静态托管的成品，不是半成品：

| 部分 | 现状 | 规模 |
| --- | --- | --- |
| 后台 | 原生 ES Module，hash 路由，9 个业务视图 + 登录 | JS 4,174 行 / CSS 1,796 行 |
| 营销页 | 单页 HTML + 原生脚本 | HTML 581 行 / JS 551 行 / CSS 1,963 行 |
| 图标 | 两套内联 SVG（`reicon` 字符串注入） | 66 + 58 行 |
| 图表 | 手写 SVG：折线、柱、环、横向排行、环表、热力图、迷你线 | 437 行 |
| 数据 | 演示数据默认开启；登录后切实时 FastAPI | `demo.js` 404 行 |

后台已完成的定稿：薄荷白／叶绿／玫瑰粉配色、apple-design 材质层、`prefers-reduced-motion/transparency/contrast` 退化路径、1440/390 两种宽度 axe 0 violations。这些是本次重构的**验收基线**，不是可以顺手改掉的历史包袱。

仓库里没有 Next.js 代码，只有根 `README.md` 过时地写着 Next.js 14 + Tailwind。本次不引入 Next.js，并把文档改到与实现一致。

## 3. 目标

1. 用 React + TypeScript 承担两套界面的渲染与状态，源码可维护、可类型检查、可测试。
2. 保持现有 URL 形态：`/`、`/admin/`、`/admin/#/devices/esp32-01`。
3. 保持现有视觉与交互逐屏一致：布局、配色、字号、间距、动画节奏、文案、演示数值都不变。
4. 保持并守住无障碍水平：axe AA 0 violations、键盘可达、抽屉焦点管理、减弱动效／透明度／高对比偏好。
5. 保持双数据源：默认演示数据，登录后实时接口；写操作、错误提示、CSV 导出行为不变。
6. 部署仍是纯静态文件，任何静态服务器（含 `python3 -m http.server`）都能直接托管。

## 4. 非目标

- 不改后端、固件、API 契约。
- 不加新功能、新路由、新图表、新文案；不补 `/settings`（当前不存在）。
- 不做视觉改版、配色调整、字体替换。
- 不引入 SSR 框架、Next.js、Tailwind、UI 组件库、图表库、状态管理库。
- 不做 i18n、主题切换、权限系统。
- 不重写 CSS 架构（见 §9）。
- 不迁移 `APP/`、`weixin/`。

## 5. 反目标（即使技术上都跑通也算失败）

- 任何一屏出现肉眼可见的视觉漂移。
- 营销页首屏依赖 JS 才出现内容，或失去现有静态可抓取性。
- 部署需要服务器 rewrite / fallback 配置才能刷新。
- 用 `dangerouslySetInnerHTML` 大面积承载页面结构（图表个别几何片段除外，见 §10）。
- 为了「更 React」而改变用户可见行为（筛选记忆、抽屉关闭时机、提示文案、演示数值）。
- 覆盖用户已暂存的 `web/index.html`、`web/assets/style.css`、`web/admin/index.html` 中的改动而不迁移其内容。

## 6. 约束

- 仓库根为 `/Users/ember/Flower_Guardian`；`web/` 是静态站点根，当前由 `python3 -m http.server 4177` 托管。
- Node 24 已安装；`node`/`npm` 在 `/opt/homebrew/bin`，默认 PATH 可能没有，脚本与文档需写明。
- 全部中文文案逐字保留；不用 emoji；只用内联 SVG 图标。
- 演示数值口径固定：销售额 ¥2,333.70、21 单、客单价 ¥111.13、8 位新用户；设备 6 台（4 在线、2 离线）；默认 14 天。
- 用户已暂存三个文件的改动（营销页 `#fafafa` 系底色等）。迁移以**当前工作区内容**为准，不以 `HEAD` 为准。
- 现有 CSS 是调过的成品：1,963 + 1,796 行，含材质层、断点、偏好退化。迁移时保留声明，不重构选择器体系。

## 7. 方案与取舍

| | A. Vite 多入口（选中） | B. 单 SPA + path 路由 | C. 无构建 React |
| --- | --- | --- | --- |
| 入口 | `/` 与 `/admin/` 各自一个 React 根 | 一个应用，`/` 与 `/admin/*` 两棵路由树 | 两个 HTML + CDN/ESM |
| 路由 | 后台沿用 hash；营销页锚点 | React Router path 路由 | 同 A（手写） |
| 部署 | 纯静态，零配置 | 必须 rewrite，否则刷新 404 | 纯静态，零配置 |
| 营销页首屏 | 构建时预渲染，保持直出 | 客户端渲染，首屏与 SEO 退化 | 客户端渲染 |
| 类型/工程化 | TS strict、模块化、可测试 | 同 A | 无 TS、无 JSX 编译、无 CSS Modules |
| 后台体积 | 不与营销页共享 | 需手动 code split 才不互相拖累 | 共享 CDN 运行时 |
| 风险 | 低，可逐屏对照 | 中高，部署形态变化 | 高，4k 行 DOM 代码用模板字符串维护 |

选择 **A**：它同时满足「真用 React」「静态部署不变」「营销页不退化」三个硬条件。B 的唯一优势是单应用形态，但代价是部署契约和营销页首屏；C 在当前代码量下会显著降低可维护性。

## 8. 架构与目录

Vite root = `web/`，源码进 `src/`，产物进 `web/dist/`。

```
web/
├── index.html                  # 营销页入口壳：meta、title、#root、noscript
├── admin/index.html            # 后台入口壳：meta、#root、noscript
├── package.json                # scripts: dev / build / preview / typecheck / test / qa
├── tsconfig.json               # strict
├── tsconfig.node.json
├── vite.config.ts              # 多入口 + publicDir + preview 端口
├── public/
│   └── assets/                 # 图片、favicon、apple-touch-icon（由 web/assets/ 迁入）
├── src/
│   ├── shared/
│   │   ├── icons/              # Icon 包装器（svg 属性归一）
│   │   ├── components/         # Toast、Modal、ConfirmDialog、Field、Pager、CountUp、Reveal
│   │   ├── hooks/              # useFocusTrap、usePrefersReducedMotion、useCopy
│   │   └── styles/base.css     # reset 中两侧真正共用的部分（见 §9）
│   ├── admin/
│   │   ├── main.tsx
│   │   ├── App.tsx             # Toast/Data Provider + Router
│   │   ├── router.tsx          # createHashRouter，10 条路由
│   │   ├── layout/             # AppShell、Sidebar、Topbar、Drawer、LoginLayout
│   │   ├── views/              # 10 个视图组件
│   │   ├── charts/             # 7 个图表组件
│   │   ├── data/               # types / demo / selectors / api / store(context)
│   │   ├── ui/                 # 后台专用组合件（kpi、badge、empty、表单行）
│   │   ├── icons.tsx
│   │   └── styles/admin.css
│   └── site/
│       ├── main.tsx            # 有预渲染内容时 hydrate，否则 createRoot
│       ├── App.tsx
│       ├── sections/           # Nav、Hero、Intro、CareCard、Finder、How、Features、Spec、Faq、Cta、Footer
│       ├── data/               # plants、finder、faq、features、spec、copy
│       ├── hooks/              # useReveal、useNavScroll、useFinder、useApplicationCopy
│       ├── icons.tsx
│       └── styles/site.css
├── scripts/prerender.mjs       # 构建后把营销页 React 树渲染成 HTML
├── qa/                         # Playwright + axe 回归脚本
└── dist/                       # 构建产物（忽略）
```

`web/assets/` 先把图片迁到 `web/public/assets/`，再删除旧目录；`app.js`、`style.css`、`icons.js` 的内容迁入 `src/site/` 后删除。后台 `assets/js/`、`assets/admin.css` 同理迁入 `src/admin/`。删除旧文件发生在逐屏对照通过之后，git 历史保留原实现。

## 9. 构建、部署与资源

- **技术栈**：React 18.3、TypeScript（strict）、Vite（安装时当前稳定版）、`react-router-dom` 6（只用于后台）、原生 CSS。不用 Next.js。
- **入口**：`build.rollupOptions.input = { site: index.html, admin: admin/index.html }`；`base: '/'`；`build.outDir: 'dist'`；`publicDir: 'public'`。
- **营销页预渲染**：`npm run build` = `vite build && node scripts/prerender.mjs`。脚本读 `dist/index.html`、`renderToString(<SiteApp />)`、替换 `#root` 内容。营销页所有副作用（滚动监听、IntersectionObserver、剪贴板）在 `useEffect`/事件里，初始状态确定，保证可预渲染。`main.tsx` 用 `root.hasChildNodes() ? hydrateRoot : createRoot`，开发态与构建态都能跑。
- **后台不预渲染**：登录态应用，无 SEO 需求；`index.html` 保留 noscript 提示。
- **静态托管**：`dist/` 放到任意静态服务器根目录即可，`/` 与 `/admin/` 都返回真实 `index.html`。后台 hash 路由不触发服务器请求，刷新安全。
- **开发**：`vite dev` 端口 4177（与现有约定一致），代理不配，实时接口仍走 `http://localhost:8000` 的绝对地址与 `?api=` 覆盖。
- **预览**：`vite preview --port 4177`，QA 脚本默认打这个地址。
- **缓存**：Vite 产物带内容哈希，删除现有 `?v=2026-11-18n` 手工版本号。
- **.gitignore**：追加 `web/node_modules/`；`dist/` 已被根规则覆盖。不改动用户已暂存的其他行。

## 10. 路由

后台继续用 hash 路由，链接形态与现有 `href="#/overview"` 完全一致。

| hash | 视图 | 备注 |
| --- | --- | --- |
| `#/overview` | 概览 | 默认与兜底 |
| `#/stats` | 数据统计 | |
| `#/devices` | 花盆设备 | |
| `#/devices/:code` | 设备详情 | code 需 `decodeURIComponent` |
| `#/alerts` | 告警记录 | |
| `#/products` | 商品管理 | |
| `#/orders` | 订单管理 | |
| `#/users` | 用户管理 | |
| `#/plants` | 植物库 | |
| `#/login` | 登录 | 不套后台壳 |

- 未知路径回落到 overview，不新增 404 页。
- 路由变化更新 `<title>`（`概览 · 护花使者运营后台`）与面包屑；登录页标题为 `登录 · 护花使者运营后台`。
- 登录页与后台壳是两条布局分支：`#/login` 不渲染侧栏/顶栏，`body.is-login` 的样式语义保留（用布局根类名承载）。
- 营销页只有页内锚点（`#why`、`#card`…），不接 React Router。

## 11. 样式

两套配色是**有意不同**的，不合并 token：

- 营销页：白纸 `#fafafa`、深绿 `#1c4a36`、珊瑚红 `#e94b52`（`--coral-cta #cf3f46` 承担白字 CTA）。
- 后台：薄荷白 `#f3f8f2`、叶绿 `#2c7a56 / #3fa274`、玫瑰粉 `#d95f82 / #ef8fa8`、正文 `#566d60`。

做法：

1. 两份样式分别迁为 `src/site/styles/site.css`、`src/admin/styles/admin.css`，由各自入口 `import`，保持原有层叠顺序与 `:root` 块。
2. 原 `web/assets/style.css` 与 `admin/assets/admin.css` 的声明逐行保留；只允许改资源 URL（见下）和删除已失效的 `?v=` 注释，不做「顺手优化」。
3. 共享组件需要局部样式时用 `*.module.css`；**不**把现有全局样式拆成 CSS Modules。理由：这些规则依赖后代选择器、断点和偏好查询，整体搬迁风险远大于收益。
4. `src/shared/styles/base.css` 只放两侧确实重复且不冲突的 reset 项（`box-sizing`、`img { display:block }`、`h1..p` 归零等）。若发现某条规则带配色或排版差异，留在各自文件里。
5. 资源引用从相对路径（`assets/pothos.jpg`、`../assets/logo.png`）统一改为根绝对路径（`/assets/pothos.jpg`），因为图片进 `public/` 后不再相对 HTML 层级解析。后台与营销页都要改，改完逐图目检。
6. 打印/导出等运行时注入的内联样式（登录页少量 `style=`）可以原样保留为 JSX `style`，不强行抽类。

## 12. 图标与图表

**图标**：保留两套图标数据（后台 66 行、营销 58 行），各自转成 `Record<IconName, string>`，由 `<Icon name size />` 统一渲染，内部用 `dangerouslySetInnerHTML` 承载已受控的静态 SVG path（数据源在仓库内，非用户输入）。营销页的 `data-icon` 占位全部换成组件。

**图表**：437 行 SVG 生成逻辑按图种拆成 React 组件，几何计算函数复用：

| 组件 | 现有函数 | 用途 |
| --- | --- | --- |
| `<TrendChart>` | `chart()` 折线分支 | 销售趋势、用户趋势、客单价趋势 |
| `<BarChart>` | `barChart()` | 订单量、分组柱 |
| `<DonutChart>` | `donutChart()` | 订单状态构成 |
| `<HBarChart>` | `hbarChart()` | 商品排行 |
| `<RingGauge>` | `ringGauge()` | 在线率、阈值余量 |
| `<Heatmap>` | `heatmapChart()` | 设备 × 时段湿度 |
| `<Sparkline>` | `sparkline()` | KPI 卡片背景线 |

要求：同一份 viewBox、同样的刻度算法（`niceTicks`、`smoothPath`）、同样的入场动画类名（`barGrow`/`arcIn`/`hbarIn`/`ringIn`/`cellIn`），`aria-label`/`role="img"` 与文本替代保持等价。若某个图在 JSX 化后出现亚像素漂移，允许把该图的 `<g>` 内容回退为受控 SVG 字符串注入，并在代码注释说明原因；不允许换图表库。

## 13. 数据层与状态

- `src/admin/data/types.ts`：`Product / Order / OrderItem / User / Plant / Device / Reading / Alert / AdminUser / ApiEnvelope` 等。
- `demo.ts`：直接迁移种子与生成逻辑，`DEMO_NOW` 仍是模块加载时的时间基准；演示数值不得变化（用快照测试锁住）。
- `selectors.ts`：`computeOverview / computeTrend / computeUserTrend / computeAovTrend / computeStatusBreakdown / computeRanking / movingAverage / sensorSummary / pendingAlerts / latestReading / deviceIssues / deviceState` 原样迁移并加类型。
- `api.ts`：保留 `TOKEN_KEY`、`BASE_KEY`、`DEFAULT_API_BASE`、`?api=` 优先级、12s 超时、`ApiError` 文案。
- `store.tsx`：一个 `AdminDataProvider`，持有 `{ source, admin, data, lastSync, syncing }`，暴露 `useAdminData()` 与动作 `loadLive / resetDemo / saveProduct / removeProduct / saveOrder / savePlant / removePlant / saveDevice / createDevice / acknowledgeAlert`。不引入 Zustand/Redux。
- 语义保持（按现状逐条复刻，不修「看起来像 bug」的行为）：
  - 启动时 `source = getToken() ? "live" : "demo"`，但 `data` **始终**先由 `createDemoState()` 生成；带 token 直接刷新页面也不会自动拉接口。
  - `loadLive()` 只在三处触发：登录成功、用户点刷新（live 模式）、任一写操作成功之后。写操作完成后整批重拉六类数据，不做内存局部 patch。
  - demo 模式点刷新 = 重建演示数据；live 模式点刷新 = `loadLive()`，失败 toast 错误。
  - `loadLive` 遇到 401/403：清 token、回 demo、重建数据。
  - 退出登录（live）：清 token、回 demo、回概览。
  - 已知怪异点：带 token 刷新后，顶栏显示「实时接口」而数据仍是演示值，直到用户点刷新。这是当前实现的真实行为，本次保留，不顺手修；若要改，另开任务，并同步改验收口径。
- 视图级筛选状态（概览 7/14/30 天、统计分组等）现在保存在模块作用域，离开再回来仍保留。重构后同样要保留：放进视图的 UI store 或提升到 Provider，不要顺手改成「每次进入重置」。
- 事件总线（`fg:toast`、`fg:refresh`）删除，改为 Provider 内的 toast 队列与显式动作；对外行为（提示位置、自动消失时间、语气）不变。
- 异步视图（设备详情读数、登录）用 effect + 加载态；错误边界落在视图层，错误文案与「重试」按钮保持现有样子。

## 14. 页面映射

### 后台（`src/admin/views/`）

| 视图 | 主要内容 | 数据/依赖 |
| --- | --- | --- |
| `Overview` | 4 张 KPI（含 sparkline、数字滚动）、销售趋势、订单状态环、履约率、设备注意列表、最近订单 | selectors + charts |
| `Stats` | 区间切换、趋势/分组、排行、热力图 | selectors + charts |
| `Devices` | 设备卡片、在线/告警徽标、新增设备 | demo/live devices |
| `DeviceDetail` | 传感器读数、阈值环形、标定/配置、告警 | `deviceReadings`、`deviceAlerts` |
| `Alerts` | 告警列表、确认 | `acknowledgeAlert` |
| `Products` | 表格、搜索/分页、增删改弹窗、CSV | `saveProduct`、`removeProduct` |
| `Orders` | 表格、状态流转、详情弹窗 | `saveOrder` |
| `Users` | 表格、搜索/分页 | demo/live users |
| `Plants` | 植物库表格、增删改 | `savePlant`、`removePlant` |
| `Login` | 账号密码、演示入口、API Base 设置 | `login`、`loadLive` |

### 营销页（`src/site/sections/`）

Nav、Hero、Intro（为什么）、CareCard（6 种植物的 tab，含 roving tabindex 与方向键）、Finder（3 步问答、进度、结果 + 两个备选、重开）、How（三步）、Features（bento）、Spec（参数表）、Faq（原生 `<details>`）、Cta（昵称/位置/系统 → 复制申请文本，含剪贴板失败时的手动复制框与 `aria-live` 状态）、Footer。

数据抽到 `src/site/data/`：6 张养护卡、3 步问题与 6 株植物的评分参数、6 条 FAQ、features/spec 文案。全部文案与当前 HTML 一字不差。

## 15. 无障碍与动效

保持项：

- 跳转链接、`<main tabindex="-1">`、语义化标题层级、`aria-current="page"`、`aria-expanded`、`aria-live` 提示区。
- 移动端抽屉：开时焦点进侧栏、`.main` **整块**（含顶栏与菜单按钮，不只是 `<main id="view">`）设为 `inert`、scrim 可点关闭、Esc 关闭、关闭后焦点回到触发按钮、跨过 981px 断点时自动关闭。与现状一致，不要收窄 `inert` 范围。
- 宽表格横向滚动容器：溢出时补 `tabindex=0`、`role=region` 与带页面标题的 `aria-label`（用 hook 在布局后测量）。
- 数字滚动：`prefers-reduced-motion: reduce` 时直接落终值。
- 图表一律带文本等价信息，颜色不作为唯一编码（状态徽标保留文字）。
- 营销页 reveal：`IntersectionObserver` 不可用时直接显示；`reduce` 时无过渡。
- `prefers-contrast: more`、`prefers-reduced-transparency: reduce` 两条后台退化规则原样保留。

新增约束：路由切换后不抢焦点（维持现状），但 `document.title` 必须同步；任何 portal（弹窗/Toast）都要有正确的 `role` 与焦点落点。

## 16. 测试与回归

分三层，全部进仓库：

1. **类型与构建**：`npm run typecheck`（`tsc --noEmit`）、`npm run build` 必须干净。
2. **逻辑单测（Vitest）**：演示数据快照（4 个 KPI、6 台设备、14 天序列）、`compute*` 系列、金额/日期格式化、状态映射、finder 排名函数。目的：锁住数字口径，防止重构改变业务含义。
3. **端到端 QA（Playwright + axe-core，`web/qa/`）**：
   - `smoke.mjs`：10 条路由逐条渲染，断言标题、关键标题/表格存在、无 console error、1440 与 390 无横向溢出。
   - `a11y.mjs`：10 条路由 × 2 个宽度跑 axe（WCAG 2.x AA），0 violations。
   - `drawer.mjs`：390 宽开抽屉 → 焦点进入、`inert` 生效、Esc 关闭、焦点归还。
   - `motion.mjs`：模拟 reduced-motion，断言动画数为 0。
   - 营销页：导航开合、6 个 tab 的键盘操作、finder 完整一轮、复制失败回退、FAQ 展开。
   - `npm run qa` 负责构建、起 preview（4177）、跑脚本、关进程。
   - 引擎矩阵：Chromium（1440 与 390）是所有断言的门槛；WebKit 390 追加一组冒烟（抽屉 `inert`/Esc/焦点归还、营销页导航与 reveal），作为附加检查；Firefox 不做。`build.target` 用 Vite 默认的现代浏览器目标，不为旧浏览器加 polyfill；最低支持基线定为 `inert` 可用的版本（Chrome/Edge 102+、Safari 15.5+、Firefox 112+），写进 `web/README`。

迁移前先做可运行的基线副本：把当前**工作区**（含已暂存的 `#fafafa` 等改动，不是 `HEAD`）的 `web/` 整树复制到 `web/legacy/`，加进 `.gitignore`，用 `python3 -m http.server 4178` 从那里起服务，逐屏并排对照；迁移完成后删除该目录。截图（10 条后台路由 + 营销页 9 个区块，1440×900 与 390×844）存会话临时目录作为辅助，不作为唯一依据。像素级自动 diff 不做：字体渲染与动画会让它长期误报。

## 17. 迁移顺序

每一步都以「该步的对照与脚本通过」为出口，不做大爆炸切换。

1. **工程骨架**：`package.json`、tsconfig、Vite 多入口、两个空壳 React 根、样式迁入、图片迁 `public/`、`web/README` 更新。出口：`/` 与 `/admin/` 在 dev 与 build 下都能打开，旧页面内容暂由 git 保留（此步先不删旧文件）。
2. **共享层**：Icon、Toast、Modal/ConfirmDialog、Field/Pager/CountUp、focus trap；后台图标表。
3. **后台数据层**：types、demo、selectors、api、Provider；用单测锁住演示数值。
4. **后台壳与路由**：Sidebar/Topbar/Drawer、hash 路由、标题/面包屑、登录布局、刷新与数据源切换。
5. **后台视图**：先概览（图表最多）→ 统计 → 设备/详情 → 告警 → 商品/订单/用户/植物。每屏接上回归脚本。
6. **营销页**：section 拆分 → 交互 hooks → 预渲染脚本 → 对比首屏与交互。
7. **收尾**：删旧 `web/assets/{app.js,style.css,icons.js}`、`web/admin/assets/`，补 `.gitignore`、README、`docs/plans` 过期提示；跑全量 QA 与 axe。

## 18. 验收标准

功能（实时接口一组为手动验收；前置条件已确认：本地 FastAPI 可启动，且能提供 `role=admin` 账号。验收时记录后端分支/提交与账号来源，不用模拟接口替代）：

- [ ] 10 条后台路由（含 `#/devices/:code`）都能直达、刷新、前进后退。
- [ ] 演示数据口径与现状一致：¥2,333.70 / 21 单 / ¥111.13 / 8 新用户 / 6 台设备（4 在线、2 离线）/ 14 天。
- [ ] 登录 → 切实时接口 → 侧栏与顶栏状态同步；401/403 回演示；退出登录回演示并回概览。
- [ ] 带 token 直接刷新页面时，表现与现状一致（顶栏实时接口、数据仍为演示，点刷新后拉取），不擅自“修好”。
- [ ] 商品、订单、植物、设备的新增/编辑/删除、告警确认、CSV 导出行为与提示文案一致。
- [ ] 营销页：导航、6 个养护 tab（鼠标 + 方向键）、3 步 finder、重开、复制成功与失败回退、FAQ、reveal 全部正常。
- [ ] 所有中文文案、图片、链接目标与现状一致；无新增数字、用户数或评价。

质量：

- [ ] `npm run typecheck` 与 `npm run build` 零错误；构建产物在 `python3 -m http.server` 下 `/`、`/admin/` 均 200。
- [ ] 10 条路由 × 1440/390：axe AA 0 violations；无 console error；无横向溢出。
- [ ] 390 宽抽屉焦点进入/`inert`/Esc/焦点归还全部通过；跨断点自动关闭。
- [ ] reduced-motion 下动画数为 0；reduced-transparency 与 contrast:more 视觉退化正常。
- [ ] 营销页预渲染后，禁用 JS 时首屏文案与图片仍可见。
- [ ] 后台首屏 JS（gzip）≤ 250 kB，营销页 ≤ 200 kB（软目标，超出要说明原因）。

## 19. 由我决定的实现取舍（请复核）

1. 后台保留 hash 路由，不改为 path 路由：静态托管零配置、现有链接不变。
2. 营销页构建时预渲染并 hydrate：用 ~30 行脚本换回首屏直出与可抓取性，不引入 SSR 框架。
3. 不整体 CSS Modules 化：保留两份全局样式，只有新共享组件用局部模块。
4. 不引入状态库：Provider + 纯 selector 足够，减少依赖面。
5. 图表不引库，按现有几何手写 React 组件；允许个别图块回退为受控 SVG 字符串。
6. QA 脚本进仓库并带 `playwright` + `axe-core` 开发依赖，保证回归可重复；不做像素 diff。
7. 旧实现不保留并行入口：逐屏通过后删除，历史交给 git。
8. 技术栈固定 React 18.3 + Router 6；不使用 React 19 新特性。

## 20. 留给实施者

- 组件文件的具体命名与拆分粒度（按 §14 的边界即可）。
- 图表组件的内部辅助函数组织方式。
- Vitest/Playwright 的具体断言写法与超时。
- `tsconfig` 的额外严格选项（在不拖慢迁移的前提下）。
- 预渲染脚本的 HTML 注入实现细节。
- 是否需要 `eslint`（当前不作为验收门槛；如需，另开任务，不阻塞本次）。
