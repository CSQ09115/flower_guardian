# 护花使者 · 官网与运营后台

`web/` 是 Vite + React 18 + TypeScript 的静态站点，两个独立入口共用一个仓库：

- `/` —— 产品介绍页，构建时把首屏预渲染进 `dist/index.html`，加载后 hydrate；
- `/admin/` —— 运营后台（hash 路由单页应用），默认使用内置演示数据。

没有 Next.js、没有 Tailwind、没有图表库：样式是原生 CSS，图表是手写 SVG，路由用 `react-router-dom` 6。

## 本地运行

要求 Node 20+。如果 `node` / `npm` 不在 PATH（macOS Homebrew 默认在 `/opt/homebrew/bin`），先执行：

```bash
export PATH=/opt/homebrew/bin:$PATH
```

```bash
cd web
npm install

npm run dev        # 开发服务器，http://127.0.0.1:4177/
npm run build      # tsc + vite build + 预渲染 dist/index.html
npm run preview    # 预览构建产物，http://127.0.0.1:4177/
npm run typecheck  # 两个 tsconfig 都检查
npm test           # Vitest 单元测试
npm run qa         # Playwright + axe 回归（会先 build，再占用 4177）
```

首次跑 QA 前安装浏览器：`npx playwright install chromium`。`npm run qa` 会探测 4177；如果开发服务器或旧的 preview 还占着端口，先停掉再跑，避免测到旧构建。

## 页面与渲染方式

| 入口 | 文件 | 渲染 |
| --- | --- | --- |
| 官网 | `index.html` → `src/site/main.tsx` | `scripts/prerender.mjs` 在构建末尾调用 `src/site/entry-server.tsx`，把 `renderToString(<SiteApp />)` 写进 `dist/index.html`；浏览器端检测 `#root` 已有内容就 `hydrateRoot`，否则 `createRoot`（开发服务器走后者） |
| 后台 | `admin/index.html` → `src/admin/main.tsx` | 纯客户端渲染，hash 路由，不预渲染 |

- 官网在 `<html>` 上保留 `no-js` 类与一段内联脚本：无 JS 时预渲染内容直接可读；有 JS 时加 `js` 类启用滚动入场；带 `?snap` 时跳过隐藏，便于截图和对照。
- 样式只在各自的 `main.tsx` 里 import，服务端入口不引 CSS。
- 后台的 `dist/admin/index.html` 始终是空 `#root`。

## 目录结构

```
web/
├── index.html                官网入口（含预渲染占位与 no-js 脚本）
├── admin/index.html          后台入口
├── public/assets/            图片、favicon、触摸图标等静态资源
├── scripts/prerender.mjs     把官网首屏写进 dist/index.html
├── src/
│   ├── site/                 官网
│   │   ├── App.tsx           11 个 section 的装配
│   │   ├── sections/         Nav / Hero / Intro / CareCard / Finder / How …
│   │   ├── hooks/            导航、养护卡、finder、复制、滚动入场
│   │   ├── data/             养护卡、finder 评分、FAQ、能力、规格
│   │   ├── icons.tsx         Reicon 内联 SVG
│   │   └── styles/site.css
│   └── admin/                运营后台
│       ├── layout/           外壳、侧栏、顶栏、登录壳
│       ├── views/            10 条路由的页面
│       ├── ui/               共享表单、KPI、空状态等
│       ├── charts/           手写 SVG 折线、柱状、圆环、排行、热力图
│       ├── data/             类型、演示数据、selector、接口客户端、Provider
│       └── styles/admin.css
├── qa/                       Playwright + axe 回归脚本
├── vite.config.ts            双入口、端口 4177、base "/"
└── README.md
```

## 静态部署

`npm run build` 产出 `dist/`，交给任意静态服务器即可，不需要 Node 运行时：

```bash
cd web
npm run build
cd dist
python3 -m http.server 4177 --bind 127.0.0.1
```

- 官网：<http://127.0.0.1:4177/>
- 后台：<http://127.0.0.1:4177/admin/>
- 后台用 hash 路由，刷新 `#/devices/FG-ESP32-001` 不会 404，不需要额外 rewrite。
- `dist/` 里包含预渲染后的 `index.html`，禁用 JavaScript 也能读到官网正文。

## 后台的两种数据源

后台默认进入**演示数据**模式：

| 模式 | 进入方式 | 说明 |
| --- | --- | --- |
| 演示数据 | 直接打开 `/admin/` | 内置一套标注为「演示数据」的样例，不请求网络，可完整走通所有页面与交互 |
| 实时接口 | `/admin/#/login` 登录，或点侧栏底部「连接后端」 | 用 `role=admin` 账号读取真实 FastAPI 接口 |

- 接口地址默认 `http://localhost:8000`，可用 `?api=` 覆盖，例如 `http://127.0.0.1:4177/admin/?api=http://192.168.1.10:8000#/login`；
- 地址与令牌分别存在 `localStorage` 的 `fg_api_base` 和 `fg_admin_token`；
- 演示模式下所有写操作只改内存 + 本地样例，不会发出请求；右上角数据源标签始终显示当前是「演示数据」还是「实时接口」；
- 实时模式登录失败（后端未启动、账号密码不对）会给出错误提示，不会静默退回演示数据；
- 带 token 刷新页面时仍显示「实时接口」，并在挂载后自动拉取一次接口数据；token 失效后刷新会回到演示模式并清除本地 token；
- 列表接口的 `limit` 上限是 100，后台按 100 请求；超过会 422 并退回演示数据。

### 演示数据口径

演示数据是**样例**，不是真实经营数据，任何对外材料都不要引用（下表是前端内置演示模式的口径；接入本地后端后以种子脚本的数据为准，见下一节）：

- 6 台设备 `FG-ESP32-001` … `FG-ESP32-006`，4 台在线、2 台离线；
- 概览销售额 ¥2,333.70 / 21 单 / 客单价 ¥111.13 / 新增用户 8；
- 订单页有效销售额 ¥2,031.70（扣掉已取消订单）；
- 7 条告警，其中 5 条待处理；
- 商品 12 条、植物 10 条、用户 8 位。

土壤温度按固件说明取模拟值，光照允许为空（未接 BH1750 时无读数），页面用「无读数」占位而不是 0。

### 本地后端联调（从零起一套）

需要 Docker（用于 Postgres）和 `backend/venv`。整套数据都是演示数据，可随时重建：

```bash
# 1. Postgres（独立容器，不动其他项目的库）
docker run -d --name flower_guardian_db \
  -e POSTGRES_USER=flower -e POSTGRES_PASSWORD=flower \
  -e POSTGRES_DB=flower_guardian \
  -p 5432:5432 -v flower_guardian_pgdata:/var/lib/postgresql/data postgres:16

# 2. 建表并灌入演示数据（可重复执行，会重置演示数据）
cd backend
./venv/bin/python -m app.db.seed_demo

# 3. 启动接口
./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

数据库连接串等配置放在 `backend/.env`（参考 `.env.example` 自行填写），不要提交。种子脚本写入的账号：

| 用途 | 账号 | 密码 |
| --- | --- | --- |
| 后台管理员（`role=admin`） | `admin` | `FlowerAdmin#2026` |
| 演示用户 `demo01`–`demo08` | `demo01` … `demo08` | `FlowerDemo#2026` |

种子数据规模：47 种植物、12 个商品、9 位用户（1 管理员 + 8 演示用户）、21 笔订单、6 台设备（4 在线 / 2 离线）。所有记录都可识别为演示用途：用户名 `demo01`…、订单号 `DEMO` 前缀、设备名带「（演示）」后缀、备注写明 `[演示数据]`。删掉这些记录即可清空演示数据。

设备在线判定窗口是 90 秒。没有真实固件在跑时，种子写入的「在线」设备 90 秒后会变离线；点击「刷新」前执行一次：

```bash
cd backend && ./venv/bin/python -m app.db.seed_demo --touch
```

后台登录后打开 <http://127.0.0.1:4177/admin/?api=http://127.0.0.1:8000#/login> 即可连接本机接口。

## 固件接入

设备侧无需登录，直接上报即可；首次上报会自动建档：

```
POST /api/devices/{code}/readings
```

设备编码即 `firmware` 里的 `DEVICE_CODE`，上报间隔为 10 秒（见 `firmware/README.md` 第 9 节）。

### 后台接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/devices` | 设备列表 |
| GET | `/api/admin/devices/overview` | 在线数 / 告警数汇总 |
| POST | `/api/admin/devices` | 手动新增设备 |
| GET/PUT/DELETE | `/api/admin/devices/{code}` | 详情（含阈值、校准值）/ 修改 / 删除 |
| GET | `/api/admin/devices/{code}/readings?hours=24` | 历史读数，用于详情页曲线 |
| GET | `/api/admin/device-alerts` | 告警列表 |
| PUT | `/api/admin/device-alerts/{id}/ack` | 确认告警 |

`/api/admin/*` 需要 `role=admin` 的登录令牌；`POST /api/devices/{code}/readings` 不需要。

### 阈值与告警口径

前后端是同一套判定逻辑，改一端要同步另一端（`src/admin/data/` 与 `backend/app/api/endpoints/devices.py`）：

- 湿度、土壤温度：越过下限或上限即告警；
- 光照：只在 06:00–20:00 判定，夜间（20:00–06:00）低于下限不告警，页面上显示「夜间不判定」，避免关灯后误报；
- 离线：超过 90 秒没有上报即判离线并生成告警，恢复上报后自动确认；
- 同一设备同一指标同时只保留一条未确认告警，重复越界只刷新读数与时间，回到正常范围自动确认。

### 校准

详情页的校准只做**记录**，不会下发到设备；实际写入需要按 `firmware/README.md` 第 7–8 节用串口命令完成。换算公式：

```
湿度% = (airRaw - raw) × 100 / (airRaw - waterRaw)
```

默认空气值 3200、水中值 1300。

## 图表与动效

图表全部是手写 SVG React 组件（`src/admin/charts/`），没有图表库。数据由 `AdminDataProvider` + `useAdminData` 提供，图表只负责画。

| 组件 | 用在哪 |
| --- | --- |
| 折线图 | 概览/统计的销售趋势（渐变面积 + 7 日均线虚线与悬停提示）、设备详情的 24 小时读数 |
| 迷你折线 | KPI 卡片、设备卡片的 24 小时湿度曲线 |
| 柱状图 | 统计页的下单时段分布、每日订单数 |
| 圆环图 | 订单状态构成（中心写总数，图例带数值与占比） |
| 排行条 | 商品销量排行（带金额与合计行） |
| 仪表环 | 概览的设备在线率 |
| 热力图 | 花盆设备的土壤湿度分布（每设备 24 小时、2 小时一桶） |

图表用「薄荷白 + 叶绿 + 玫瑰粉」的一组色：深叶绿 `#2c7a56`、玫瑰 `#d95f82`、中绿 `#3fa274`、浅粉 `#ef8fa8`、薄荷 `#bfe3cd`、灰绿 `#93a89c`，对应 CSS 变量 `--viz-1..6`。状态色由 `STATUS_COLOR` 统一映射，徽标与图例使用同一套语义。

后台沿用参考稿的薄荷白：底色 `#f3f8f2`、卡片纯白 `#ffffff`，侧栏白底加 `#e2ece1` 细描边，导航激活项是薄荷 pill。界面按「材质」分层：`--elev-1/2/3` 三档高度、卡片 `--hairline` 描边、顶栏半透明 `blur` 材质；`prefers-reduced-transparency` 下退回实色，`prefers-contrast: more` 下描边与次要文字加深。

动效只播一次、不循环、不跟滚动绑定：视图入场上浮、KPI 数字滚动、折线描入、柱形/圆环/热力图错峰出现。`prefers-reduced-motion: reduce` 下动画时长归零，DOM 里直接是最终数值。

## 无障碍

- 10 条后台路由 × 1440/390 跑 axe WCAG 2.0/2.1 A+AA，0 violations（`npm run qa`）；
- 官网提供「跳到正文」，后台提供「跳到内容」；焦点样式统一为深叶绿；
- 手机抽屉打开时 `.main` 设为 `inert`，焦点移入当前导航项；Esc 关闭、关闭后焦点回到菜单按钮，跨过 981px 断点自动关闭；
- 图表都带 `role="img"` 与中文 `aria-label`，数值同时以文本出现在图例、脚注或表格里；
- 表格支持键盘横向滚动，排序/筛选控件都有可见标签；
- 支持 `prefers-reduced-motion`、`prefers-reduced-transparency`、`prefers-contrast: more`。

浏览器基线：`inert` 可用的版本，即 Chrome / Edge 102+、Safari 15.5+、Firefox 112+。自动化回归以 Chromium 1440/390 为门槛；WebKit 390 的抽屉与官网导航/reveal 冒烟是发布前的附加检查项。

## QA 套件

`web/qa/` 会在构建产物上跑五组检查：

| 脚本 | 覆盖 |
| --- | --- |
| `smoke.mjs` | 10 条后台路由 × 1440/390：标题、h1、无 console error、无横向溢出、图片可加载 |
| `a11y.mjs` | 同 20 组跑 axe WCAG 2.0/2.1 A+AA，要求 0 violations |
| `drawer.mjs` | 390 抽屉：`inert` 焦点隔离、Esc 关闭、焦点归还、断点自动关闭 |
| `motion.mjs` | `prefers-reduced-motion: reduce` 下无运行动画；默认上下文仍有动画（防止空断言） |
| `site.mjs` | 官网无 JS 首屏、导航三种关闭方式、6 张养护卡、finder、FAQ、剪贴板成功/失败、滚动 reveal |

`run.mjs` 负责 build、起 `vite preview`、按脚本汇总失败并在结束时清理进程。

## 约定

- 全站中文，产品名统一「护花使者 / FLOWER GUARDIAN」；
- 不使用 emoji，图标一律内联 SVG；
- 不编造用户数、评价、评分、增长数据；演示数据的标签必须保留；
- 改文案时保持既有措辞，不顺手润色；
- 新增共享组件优先复用现有全局类名，CSS Modules 只放增量规则。

## 官网内测申请

内测区不接后端：填完植物名、位置、系统后，点「复制申请内容」把这段文字复制到剪贴板，再由申请人自己粘到邮件或聊天窗口发给我们。没有收件邮箱、没有提交接口，也不保存任何表单数据。浏览器拒绝剪贴板权限时会退回一个已选中、已聚焦的文本框，让申请人手动复制。