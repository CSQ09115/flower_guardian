# 护花使者 管理后台 功能分析文档

> 注：本文档写作时 web/ 尚不存在；前端技术栈与目录以 docs/superpowers/specs/2026-11-19-web-react-refactor-design.md 与 web/README.md 为准。

| 项 | 内容 |
| --- | --- |
| 版本 | v1.0 |
| 日期 | 2026-11-15 |
| 状态 | 待评审 |
| 适用后端 | `backend/`（FastAPI + PostgreSQL，22 个已注册路由） |
| 适用固件 | `firmware/`（ESP32-S3，FIRMWARE_VERSION 0.4.0） |
| 前端技术栈 | React 18 + TypeScript + Vite（新建，不复用已删除的 `web/`） |
| 界面规范 | design-taste-frontend（tasteskill v2，app screen / smb-admin 方向） |

---

## 0. 文档目的

本文件回答三个问题：

1. 后台要做哪些功能，优先级如何，明确不做什么。
2. 每个功能的数据从哪里来：哪些来自现有后端接口，哪些必须新建（重点是固件设备接入）。
3. 界面如何实现：React 工程结构、路由、数据层，以及逐屏的视觉规格。

**非目标**：消费者端（`weixin/`、`APP/`）的功能设计；支付渠道对接细节；YOLO 模型的训练与调参；固件的语音与显示功能（INMP441、MAX98357、OLED）。

**数据说明**：第 7 章与配套界面稿中的所有数字均为固定样例，用于检查排版与信息密度，不代表真实运营数据。本文件不引用任何未经验证的成活率、识别准确率或营收基准。

---

## 1. 现状与差距

### 1.1 仓库现状

| 目录 | 实际内容 | 与既有文档的差异 | 对本项目的影响 |
| --- | --- | --- | --- |
| `weixin/` | Taro 微信小程序（活跃） | 无 | 不涉及 |
| `APP/` | React Native（遗留） | 无 | 不涉及 |
| `backend/` | FastAPI + PostgreSQL + APScheduler | 无 | 唯一的接口来源 |
| `web/` | **不存在** | `CLAUDE.md` 与 README 仍描述 "Next.js 14 管理后台、`/admin` 路由、Tailwind" | 后台必须从零新建；旧文档中的 `web/src/app/admin/*` 路径全部失效 |

结论：后台不是"改造"而是"新建一个前端工程"，但后端已有相当一部分管理接口可以直接使用，不需要重写。

### 1.2 现有管理接口（可直接依赖的基线）

鉴权方式统一为 `Authorization: Bearer <jwt>`，接口内部用 `get_current_admin_user` 校验 `User.role == "admin"`，否则返回 403。`role` 目前只能通过手工改库设置（`UPDATE users SET role='admin' WHERE ...`）。

| 方法 | 路径 | 现有能力 | 缺口 |
| --- | --- | --- | --- |
| GET | `/api/admin/stats/overview` | total_sales、order_count、avg_order_value、user_count，支持 start_date/end_date | 无设备、无用户增长细分、无失败率 |
| GET | `/api/admin/stats/trend` | 按 day/week/month 返回 labels、sales、orders | 只有销售额与单量两条线；group_by 由正则校验 |
| GET | `/api/admin/stats/products` | 按 OrderItem 聚合销量与销售额，limit 1-50 | 无库存周转、无滞销 |
| GET | `/api/admin/users` | search + skip/limit（limit 上限 100），返回 {total, items} | 无状态字段、无角色变更、无导出、无批量操作 |
| GET | `/api/admin/users/{user_id}` | 用户详情 + orders | 无最后登录、无设备绑定 |
| GET | `/api/admin/users/{user_id}/orders` | 该用户订单分页 | 无时间过滤 |
| GET/POST/PUT/DELETE | `/api/admin/plants`、`/api/admin/plants/{id}` | 植物库完整 CRUD | 写入 schema 缺 image_url、yolo_class_id、beginner_friendly、is_toxic、features、survival_rate |
| GET | `/api/admin/orders`、`/{id}` | 订单列表与详情 | 无按状态/时间/金额筛选参数说明，无导出 |
| PUT | `/api/admin/orders/{id}` | 改状态等字段 | 无状态机校验，可任意跳转 |
| GET/POST/PUT/DELETE | `/api/products`、`/{id}` | 商品 CRUD（管理员） | 无库存调整流水、无上下架批量 |
| GET | `/api/products`（public） | 前台商品列表 | 不供后台使用 |
| — | `/api/devices/**` | **零命中** | 设备域完全缺失，见第 5 章 |

### 1.3 现有数据模型（后台字段级依据）

| 模型 | 文件 | 关键字段 |
| --- | --- | --- |
| User | `backend/app/models/user.py` | id、username(50, unique)、email(100, unique)、password_hash、avatar_url、bio、is_email_verified、role(默认 "user")、expo_push_token、created_at |
| Plant | `backend/app/models/plant.py` | id、name(100)、scientific_name(150)、category(50)、image_url、yolo_class_id(0-46, unique)、care_level(1-5)、beginner_friendly(1-5)、is_toxic、features(JSON)、survival_rate(默认 90)、light/water_requirement 等养护字段 |
| UserPlant | 同上 | id、user_id、plant_id、plant_name、nickname、location(50)、acquired_from(recommendation/garden/manual)、notes |
| Reminder | `backend/app/models/reminder.py` | type、interval_days(默认 7)、base_interval、weather_factor(1.0)、season_factor(1.0)、calculated_interval、notify_time("09:00")、enabled、last_done、next_due |
| Product | `backend/app/models/product.py` | name(100)、price(Numeric 10,2)、stock、image_url(500)、plant_id、status("active"/"inactive") |
| Order / OrderItem | `backend/app/models/order.py` | order_no(unique)、total_amount、status(pending/confirmed/shipped/completed/cancelled)、delivery_type(express/pickup)、contact_*、OrderItem 的 quantity/unit_price/subtotal |
| DiagnosisRecord | `backend/app/models/diagnosis.py` | disease_name、confidence、detections(JSON bbox)、recommended_products、is_favorite |
| Device / DeviceReading | **不存在** | 第 5 章新增 |

### 1.4 固件与后端的断点

固件当前的上报调用：

- 路径：`POST http://{SERVER_HOST}:{SERVER_PORT}/api/devices/{DEVICE_CODE}/readings`（`firmware/src/main.cpp:591` `postReading`）。
- 报文：手工拼装的 320 字节 JSON，只有 `soil_moisture`、`soil_temp`、`light_lux`、`firmware`、`ip_address` 五个字段。
- 周期：`REPORT_INTERVAL 10000`（`firmware/include/wifi_config.h`），10 秒一次，无重试、无序号、无设备时间戳。

后端侧：`backend/app/api/router.py` 注册的 22 个路由中没有任何设备路由，`grep "devices"` 在 `backend/app` 零命中。因此当前固件的每一次上报都会得到 404，且固件把 `code > 0` 一律当作成功（`firmware/src/main.cpp:623`），控制台看不到失败。

固件 README 第 12 章已记录的缺陷，本文件全部继承并要求在 M2 内解决：

| 编号 | 缺陷 | 位置 | 影响 | 处理里程碑 |
| --- | --- | --- | --- | --- |
| 12.1 | SHT30 从未初始化，`sht30Init()`/`sht30AutoRetry()` 无处调用 | `main.cpp:337, 349` | 空气温湿度永远读不到 | M2 |
| 12.2 | `readSensors` 形参小写、函数体用驼峰，源码**无法编译** | `main.cpp:527, 577-581` | 阻塞一切固件改动 | M2（第一件事） |
| 12.3 | `readSensors()` 声明 5 参，`loop()` 只传 3 个；`postReading()` 只 3 参 | `main.cpp:591, 929-930` | 空气温湿度进不了报文，-100 哨兵未转 null | M2 |
| 12.4 | 后端无设备接口 | `backend/app` | 上报必然 404 | M2 |
| 12.5 | 成功判定 `code > 0` 与 `code != 200 && != 201` 两套口径 | `main.cpp:623` | 失败被记为成功 | M2 |
| 12.6 | 文件头注释 v0.2.1 与宏 `FIRMWARE_VERSION "0.4.0"` 不一致 | `main.cpp:2, 31` | 版本无法追溯 | M2 |
| 12.7 | 源码晚于最后一次成功编译的 `firmware.bin` | `.pio/build/.../firmware.bin` | 现场设备跑的不是仓库源码 | M2 |
| 12.8 | DS18B20 土壤温度、OLED 未实现 | `board_pins.h` PIN_SOIL_TEMP 8 | 土温是模拟值 | M3（土温）、不做（OLED） |

### 1.5 三条结论

1. **读能力大部分已有，写能力参差**：商品、订单、植物、用户的查询接口可用；用户状态、角色、审计、导出、批量操作全部缺失。
2. **设备域是绿地**：表、路由、固件报文要一起改，不能只做前端。
3. **鉴权只有一个角色位**：`role == "admin"` 是全部权限，没有 RBAC、没有操作审计、没有会话管理。后台若多人使用，必须先补审计与角色。

---

## 2. 角色与场景

### 2.1 角色矩阵

| 角色 | 现实身份 | 能做什么 | 不能做什么 |
| --- | --- | --- | --- |
| 超级管理员 `superadmin` | 项目负责人 | 全部；改角色；清空设备数据；看审计日志 | — |
| 运营 `operator` | 内容/商品运营 | 植物库、商品、订单、提醒模板、总览 | 设备命令下发；用户角色变更；系统设置 |
| 客服 `support` | 售后 | 订单查询与状态修正、用户详情（只读）、诊断记录查询 | 改商品价格；改用户角色；设备写操作 |
| 硬件工程师 `hardware` | 设备维护 | 设备列表与详情（读写）、下发校准、查看原始读数、导出 | 订单、商品、用户 |
| 观察者 `viewer` | 实习/外部 | 只读总览与列表 | 一切写操作 |

> 现状只有一个布尔判断。M1 不引入完整 RBAC，先用"角色字符串 + 前端路由守卫 + 后端逐接口校验"过渡；M5 再补 `admin_audit_log` 与细粒度权限。

### 2.2 典型场景

- S1 早班巡检：打开总览，30 秒内判断"今天有没有设备掉线、有没有订单积压、有没有异常读数"。
- S2 设备排障：客服收到"我的花盆连不上"，按设备码或用户找到设备，看最后上报时间、IP、信号、传感器状态，判断是网段漂移还是硬件问题。
- S3 校准闭环：新设备首次接入，土壤湿度显示"模拟"，工程师下发 `cal air` / `cal water`，看到校准完成事件与数值变化。
- S4 内容运营：新增一个植物，补图片、养护字段、识别类 ID，检查前台是否可见。
- S5 订单处理：把 pending 改为 confirmed，填写物流信息，改为 shipped。
- S6 周报：导出最近 30 天的设备在线率与订单趋势。

---

## 3. 功能地图

```
管理后台
├── F-1 认证与账号       登录、会话、角色、改密
├── F-2 总览             经营 + 设备 + 待办三块
├── F-3 设备与遥测       设备列表、详情、实时读数、历史、事件、校准、命令、导出
├── F-4 提醒与调度       提醒规则查看、调度任务状态、手动触发
├── F-5 植物知识库       植物 CRUD、识别类映射、图片、上架
├── F-6 商品             商品 CRUD、库存、上下架
├── F-7 订单             列表、筛选、详情、状态流转、导出
├── F-8 用户             列表、详情、订单、角色、导出
├── F-9 AI 识别与诊断    调用量、失败样本、诊断记录、推荐商品
├── F-10 系统设置        通知、数据保留、危险操作、审计日志
└── F-11 界面与设计系统  token、组件、图表、空态（第 7 章）
```

| 功能 | 优先级 | 里程碑 | 依赖 |
| --- | --- | --- | --- |
| F-1 认证 | P0 | M1 | 现有 `/api/users/login`（表单编码） |
| F-2 总览（经营部分） | P0 | M1 | `/api/admin/stats/*` |
| F-3 设备与遥测 | P0 | M2 | **新建后端 + 改固件** |
| F-7 订单 | P0 | M1 | `/api/admin/orders` |
| F-5 植物 | P1 | M3 | `/api/admin/plants` + schema 扩展 |
| F-8 用户 | P1 | M3 | `/api/admin/users` + 状态字段 |
| F-6 商品 | P1 | M3 | `/api/products` + 库存流水 |
| F-2 总览（设备部分） | P1 | M3 | F-3 |
| F-9 识别与诊断 | P2 | M4 | `/api/diagnoses`、识别日志（需新增统计） |
| F-4 提醒与调度 | P2 | M4 | APScheduler 状态（需新增只读接口） |
| F-10 设置与审计 | P2 | M5 | 新建 `admin_audit_log` |

---

## 4. 功能需求明细

编号规则 `F-<域>.<序号>`。每条含：目的、界面、数据来源、验收标准、异常。

### F-1 认证与账号

**F-1.1 登录**
- 目的：只有 admin 角色能进入控制台。
- 界面：单列 384px 居中卡片，标题"护花使者 管理后台"，用户名/邮箱 + 密码 + 登录按钮；错误信息在按钮上方，不用 toast 替代。
- 数据：`POST /api/users/login`，**Content-Type 为 `application/x-www-form-urlencoded`**（后端用 `OAuth2PasswordRequestForm`），字段 `username`、`password`。返回 `access_token`、`token_type`。
- 登录后必须再请求 `GET /api/users/me` 确认 `role === "admin"`，否则提示"该账号无管理权限"并清除 token。
- 验收：非 admin 账号登录被拒且不写入 token；token 过期（`ACCESS_TOKEN_EXPIRE_MINUTES`）后任意请求 401 自动跳登录；刷新页面保持会话。
- 异常：401 显示"账号或密码错误"，403 显示"无管理权限"，网络失败显示"无法连接后端"并给出 baseURL。

**F-1.2 会话**
- token 存 memory + `localStorage`（单机后台可接受）；401 统一拦截；登出清空并跳转。
- 不实现 refresh token：后端虽有 `/api/users/refresh-token`，但管理员会话按小时级使用，过期重登更简单可靠。

**F-1.3 角色与账号管理（M5）**
- `GET /api/admin/users` 增加 `role`、`is_active` 过滤；`PATCH /api/admin/users/{id}` 改 `role`、`is_active`。
- 只有 `superadmin` 可见；不能修改自己的角色；每次变更写审计。

### F-2 总览

- 目的：30 秒内回答"今天正常吗"。
- 唯一 finding（页面标题下的一行）：由数据决定，例如"12 台设备中 2 台离线超过 10 分钟，18 单待发货"。
- 区块：
  1. KPI 条：在线设备、今日上报、待发货订单、新增用户（一个容器，1px 分隔，4 列）。
  2. 主图：全设备土壤湿度 24 小时中位线（单序列，无图例）。
  3. 异常列表：最近 5 条设备事件（离线、掉线、校准、固件变更）。
  4. 右栏：设备状态 4 行 + 待办 4 行。
- 数据：`/api/admin/stats/overview`、`/api/admin/stats/trend`、`/api/devices/summary`（新增）、`/api/devices/events?limit=5`（新增）。
- 验收：首屏 1440×900 内看到 KPI 全部数值、主图 24 小时曲线、异常列表前 3 行、右栏两块的表头与前几行；无设备数据时 KPI 显示灰色短横而不是 0。
- 异常：后端不可达时保留骨架、顶部一条 32px 提示条，不整屏白屏。

### F-3 设备与遥测（核心，见第 5 章）

**F-3.1 设备列表**
- 列：设备（名称 + 设备码，单色等宽）、位置、状态（在线/离线/从未上报/已停用，单个胶囊）、最后上报（相对时间，副行绝对时间）、固件、信号、24 小时上报数、操作（kebab）。
- 筛选：状态 tab、搜索（设备码/名称）、固件版本下拉。
- 排序：最后上报（默认倒序）、24 小时上报数。
- 验收：总数写在表格上方（"共 12 台，显示 1-12"）；表头吸顶；离线行不整行变红，靠状态胶囊表达；空结果给一句"没有匹配的设备"和清除筛选的按钮。

**F-3.2 设备详情**
- 头部：面包屑"设备 / FG-ESP32-001"，右侧动作"下发校准""重启设备"（写操作，需二次确认）。
- 一级 tab：实时、历史、事件、配置。
- 规格：4 个 KPI（土壤湿度、光照、空气温度、上报间隔）；空气温度在 SHT30 未接入时显示灰色短横，副行写"传感器未接入"。
- 实时 tab：土壤湿度 24 小时线图 + 上报到达间隔柱图（同一 x 轴）；最近读数表 10 行。
- 历史 tab：时间范围 + 聚合粒度（原始/小时），表格分页。
- 事件 tab：在线、离线、校准、错误、固件变更，倒序。
- 配置 tab：上报间隔、设备名、位置、校准值（air/water 原始 ADC）、备注。保存需确认，写操作记审计。
- 验收：离线设备在详情页顶部有一条 32px 的警示条说明"最后上报 12 分钟前，判定离线"；轮询只在实时 tab 开启（10 秒），切走即停。

**F-3.3 校准闭环**
- 流程：下发 `cal_air` → 设备进入 30 秒采样窗口 → 回传 `calibration_air` → 后台写入 `devices.calibration_air` → 事件表记一条 `calibration`。
- 界面：配置 tab 里"校准"小区块，两个按钮（校准干燥值、校准湿润值），当前值旁标注"上次校准 2026-11-12 14:03"。
- 验收：命令在 60 秒内未 ack 显示"未响应"而不是一直转圈；重复下发同一命令被去重。

**F-3.4 命令队列**
- 固件在下一次上报的响应里取命令，或在 `GET /api/devices/{code}/commands` 拉取。
- 命令类型：`cal_air`、`cal_water`、`reboot`、`set_interval`、`set_host`（下发新的服务器地址，解决硬编码 IP 问题）。
- 状态：pending → sent → acked / expired（300 秒）。

### F-4 提醒与调度

- 只读为主：展示 4 个定时任务（`check_reminders` 每小时、`daily_reminders` 09:00、`refresh_weather` 每 6 小时、`overdue_reminders` 每 3 小时）的最近运行时间与结果。
- 需要新增 `GET /api/admin/jobs`（读 APScheduler `scheduler.get_jobs()` + 最近一次运行结果）。
- 手动触发单次任务属于写操作，仅 superadmin 可见，二次确认。
- 提醒规则模板（默认间隔、天气/季节系数）编辑属于 P2。

### F-5 植物知识库

- 列表：缩略图（32px）+ 名称 + 学名（双行行高 72）、分类、养护难度、识别类 ID、存活率、状态。
- 编辑：分三组——基本信息（名称、学名、分类、描述）、养护参数（光照/浇水/温度/湿度/施肥/换盆、常见错误、技巧）、识别与展示（图片、yolo_class_id、beginner_friendly、is_toxic、features、survival_rate）。
- 需要先扩展 `PlantCreate`/`PlantUpdate` schema，否则这六个字段无法保存（现状只能靠直接改库）。
- 验收：`yolo_class_id` 唯一性冲突时给出字段级错误；图片上传后立即回显；删除前说明"删掉后用户已添加的该植物记录不受影响，但将无法再识别"。

### F-6 商品

- 列表：名称、关联植物、价格、库存、状态、更新时间。
- 写操作：新建/编辑、上下架、库存调整（调整量 + 原因，落一条库存流水，M3 新增表）。
- 验收：库存为 0 时状态列显示"缺货"胶囊但不自动下架；价格使用 `Numeric(10,2)`，前端只允许两位小数。

### F-7 订单

- 列表列：订单号（等宽，截断 8 位 + 复制）、客户、商品件数、金额（右对齐）、状态、下单时间、操作。
- 状态机：`pending → confirmed → shipped → completed`，任意非终态可 `cancelled`。后端目前 `PUT /api/admin/orders/{id}` 无校验，前端必须限制可选目标状态，后端补校验。
- 详情：商品行、收货信息、备注、时间线（创建/确认/发货/完成）。
- 验收：每次状态变更写一条 `order_status_log`（M3 新增）；已取消订单不能改为已发货。

### F-8 用户

- 列表：头像 24px、用户名、邮箱、角色、注册时间、订单数、累计消费。
- 详情：基本信息 + 订单历史（`/api/admin/users/{id}/orders`）+ 绑定设备（新增）。
- 写操作（M5）：`is_active` 停用、`role` 变更、重置密码邮件。
- 验收：停用用户后其登录被拒（后端需在 `login` 校验）。

### F-9 AI 识别与诊断

- 指标：今日识别调用数、失败率、平均耗时、Top 误识别类别、诊断记录数。
- 需要新增 `recognition_log` 表（当前没有调用日志，只有 `DiagnosisRecord`）。
- 展示：诊断记录列表（图片缩略图、疾病名、置信度、时间），可标记"样本待复盘"。
- 不做模型训练入口。

### F-10 系统设置与审计

- 分区：组织与账号、通知与推送、数据保留、设备接入默认值、危险操作、审计日志。
- 危险操作单独放最后：清空 7 天前原始读数、清空测试设备。必须输入设备码/短语确认，写审计。
- 审计表 `admin_audit_log`：id、actor_id、action、target_type、target_id、payload(JSON)、ip、created_at。M5 实现。

---

## 5. 硬件接入设计

### 5.1 端到端链路

```
SHT30 / BH1750 / 土壤电容 ADC / DS18B20
        │ I2C(41,42) / ADC(GPIO2) / 1-Wire(GPIO8)
        ▼
   ESP32-S3 固件 (firmware/src/main.cpp)
        │ 每 10s，HTTP POST，JSON
        ▼
   FastAPI  /api/devices/{device_code}/readings
        │ 校验 device token、去重、写库、判在线
        ▼
   PostgreSQL  devices / device_readings / device_events / device_commands
        │
        ▼
   React 后台  设备列表 → 详情 → 图表 / 事件 / 校准
```

### 5.2 新增数据模型

```sql
CREATE TABLE devices (
  id                 SERIAL PRIMARY KEY,
  device_code        VARCHAR(64)  NOT NULL UNIQUE,      -- FG-ESP32-001
  display_name       VARCHAR(100) NOT NULL DEFAULT '',
  model              VARCHAR(50)  NOT NULL DEFAULT 'ESP32-S3',
  location           VARCHAR(100),
  owner_user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'never_seen',
                     -- never_seen | online | stale | offline | disabled
  firmware_version   VARCHAR(32),
  ip_address         VARCHAR(45),
  rssi               INTEGER,
  report_interval_s  INTEGER NOT NULL DEFAULT 10,
  calibration_air    INTEGER,          -- 干燥空气中的 ADC 原始值
  calibration_water  INTEGER,          -- 水中的 ADC 原始值
  calibration_at     TIMESTAMPTZ,
  token_hash         VARCHAR(128),     -- 设备上报凭证的哈希
  last_seen_at       TIMESTAMPTZ,
  first_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE device_readings (
  id             BIGSERIAL PRIMARY KEY,
  device_id      INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  seq            BIGINT,                 -- 设备自增序号，用于去重与乱序检测
  device_time    TIMESTAMPTZ,            -- 设备时间（NTP 或开机毫秒推算），可为空
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  soil_moisture  NUMERIC(5,2),           -- 0-100，已按校准换算
  soil_raw       INTEGER,                -- 原始 ADC，便于排查校准
  soil_temp      NUMERIC(5,2),
  light_lux      INTEGER,                -- null 表示光照不可用
  air_temp       NUMERIC(5,2),
  air_hum        NUMERIC(5,2),
  sensor_status  JSONB,                  -- {"bh1750":"ok","sht30":"absent","soil":"simulated"}
  payload        JSONB,                  -- 原始报文，排障用
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_reading_seq ON device_readings(device_id, seq) WHERE seq IS NOT NULL;
CREATE INDEX ix_reading_time ON device_readings(device_id, received_at DESC);

CREATE TABLE device_events (
  id          BIGSERIAL PRIMARY KEY,
  device_id   INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  kind        VARCHAR(32) NOT NULL,   -- online | offline | calibration | error | firmware | command
  severity    VARCHAR(16) NOT NULL DEFAULT 'info',  -- info | warning | error
  message     TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_event_time ON device_events(device_id, created_at DESC);

CREATE TABLE device_commands (
  id           BIGSERIAL PRIMARY KEY,
  device_id    INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  kind         VARCHAR(32) NOT NULL,  -- cal_air | cal_water | reboot | set_interval | set_host
  payload      JSONB,
  status       VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending | sent | acked | expired
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ,
  acked_at     TIMESTAMPTZ
);
```

聚合表 `device_readings_hourly`（device_id, hour, avg/min/max 各指标, count）由定时任务每 15 分钟增量写入。

### 5.3 接口契约

**上报（设备侧，无需管理员 JWT）**

```http
POST /api/devices/FG-ESP32-001/readings
X-Device-Token: <device token>
Content-Type: application/json

{
  "seq": 10231,
  "device_time": "2026-11-15T05:21:03Z",
  "firmware": "0.4.0",
  "ip_address": "192.168.43.51",
  "rssi": -63,
  "soil_moisture": 38.2,
  "soil_raw": 1840,
  "soil_temp": 21.4,
  "light_lux": 12400,
  "air_temp": null,
  "air_hum": null,
  "sensors": { "bh1750": "ok", "sht30": "absent", "soil": "real" }
}
```

```json
201 Created
{
  "accepted": true,
  "duplicate": false,
  "server_time": "2026-11-15T05:21:03.482Z",
  "next_report_ms": 10000,
  "commands": [ { "id": 41, "kind": "cal_air" } ]
}
```

- 未知 `device_code`：首次上报自动建档（`status = online`，`first_seen_at = now`），返回 201，响应体带 `created_device: true`，后台事件记 `online`。避免"新设备必须先在后台手工建档"。
- 重复 `seq`：返回 200 且 `duplicate: true`，不写库。
- 报文缺 `device_code` 对应 token：401。允许配置 `DEVICE_AUTH_DISABLED=true` 用于内网调试。
- 频率限制：每设备 1 次/秒，突发 5 次，超出 429 且 `Retry-After`。

**后台侧（均需 admin JWT）**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/devices` | status/search/firmware/skip/limit，返回 {total, items} |
| GET | `/api/admin/devices/{id}` | 详情 + 最近读数 10 条 + 最近事件 10 条 |
| PATCH | `/api/admin/devices/{id}` | 名称、位置、owner、report_interval_s、notes、status(disabled) |
| GET | `/api/admin/devices/{id}/readings` | from/to/granularity=raw|hour、skip/limit |
| GET | `/api/admin/devices/{id}/events` | kind、from/to、skip/limit |
| POST | `/api/admin/devices/{id}/commands` | 下发命令，返回 command id |
| GET | `/api/admin/devices/summary` | 总数、在线、离线、今日上报、在线率 |
| GET | `/api/admin/devices/export` | CSV，最多 7 天原始数据 |

### 5.4 上报协议 v2 字段表

| 字段 | 类型 | 必填 | 说明 | 兼容策略 |
| --- | --- | --- | --- | --- |
| seq | int | 是（v2） | 开机从 0 递增，存 NVS 保证重启不清零 | 缺省时按 received_at 去重（5 秒窗口） |
| device_time | ISO8601 | 否 | 设备时间 | 缺失时用 received_at |
| firmware | string | 是 | `FIRMWARE_VERSION` | 变化时写 `firmware` 事件 |
| ip_address | string | 否 | 当前 IP | — |
| rssi | int | 否 | WiFi.RSSI() | — |
| soil_moisture | float | 是 | 已校准百分比 | 超范围（<0 或 >100）拒绝并记 `error` |
| soil_raw | int | 否 | 原始 ADC | — |
| soil_temp | float | 否 | 摄氏度 | 缺失为 null |
| light_lux | int/null | 否 | null = 不可用 | 不要用 -1 或 0 表示不可用 |
| air_temp | float/null | 否 | **v2 新增** | 缺失为 null，禁用 -100 哨兵 |
| air_hum | float/null | 否 | v2 新增 | 同上 |
| sensors | object | 否 | 各传感器状态 | 后台映射成胶囊与异常列表 |

固件侧 `-100.0f` 现在是"没读到"的内部约定（`main.cpp` readSensors 与 SHT30 失败分支），**不得直接进 JSON**：序列化前统一转 `null`。

### 5.5 幂等、乱序、时钟

- 幂等键：`(device_id, seq)` 唯一索引；重复请求返回 200 + `duplicate: true`。
- 乱序：`seq` 比库中最大值小 5 以上记 `warning` 事件"读数乱序"，仍写库（保留证据）。
- 时钟：设备无 RTC 时不信任 `device_time`，一律以 `received_at` 为查询依据；`device_time` 与 `received_at` 相差超过 24 小时记一次 `error`"设备时钟漂移"。
- 网络抖动：固件保留最近 30 条未确认读数（环形缓冲），恢复后按序补传；后台按 `seq` 去重。

### 5.6 在线判定

| 状态 | 判定 | 后台呈现 |
| --- | --- | --- |
| never_seen | 从未收到上报 | 灰胶囊"从未上报" |
| online | `now - last_seen_at ≤ 30s`（3 个周期） | 绿胶囊"在线" |
| stale | `30s < now - last_seen_at ≤ 120s` | 黄胶囊"延迟"，副行"最后上报 1 分钟前" |
| offline | `> 120s` | 红胶囊"离线"，副行给相对时间 |
| disabled | 人工停用 | 中性胶囊"已停用" |

状态由上报路径与每 60 秒的巡检任务共同刷新；状态跨越时写 `online`/`offline` 事件。因为 10 秒周期，30 秒即三次未到，足以判延迟。

### 5.7 校准闭环

1. 后台 `POST /commands {kind:"cal_air"}`，命令入库 `pending`。
2. 设备下次上报的响应中带回命令，后台置 `sent`。
3. 设备采样 30 秒（干燥空气），把平均值写入 `soil_raw` 与 `calibration_air`，回传确认。
4. 后台更新 `devices.calibration_air`、`calibration_at`，写 `calibration` 事件，命令置 `acked`。
5. 300 秒未 ack 置 `expired`，界面显示"未响应"，可重发。

计算：`moisture = (air - raw) / (air - water) * 100`，并夹取到 0-100。校准值缺失时后台显示"未校准"，图表用原始 ADC 并明确标注单位。

### 5.8 固件改造清单

| 序号 | 改动 | 文件/位置 | 说明 |
| --- | --- | --- | --- |
| 1 | 修 `readSensors` 形参与函数体命名不一致 | `firmware/src/main.cpp:527, 577-581` | 先让源码可编译，否则后续全部无法验证 |
| 2 | `readSensors()` 返回值或引用参数补 `airTemp/airHum`，`loop()` 传满 5 参 | `main.cpp:591, 929-930` | 现有 5 参声明实际只传 3 个 |
| 3 | `setup()` 调 `sht30Init()`，`loop()` 调 `sht30AutoRetry()` | `main.cpp:337, 349, 923` | 接入后补 `sensors.sht30 = "ok"` |
| 4 | `postReading()` 增加 `seq`、`rssi`、`device_time`、`air_temp`、`air_hum`、`sensors` | `main.cpp:591` | 报文扩到 8-12 字段；缓冲区从 320 提到 512 |
| 5 | `-100.0f` 统一转 `null` | `main.cpp` readSensors 与 postReading 之间 | 写一个小函数 `fmtFloatOrNull()` |
| 6 | 成功判定统一为 `200 ≤ code < 300` | `main.cpp:623` 与 loop 闪灯逻辑 | 两处共用一个 `bool reportOk` |
| 7 | 失败重试：指数退避 3 次（1s/2s/4s）+ 30 条环形缓冲 | 新增 | 热点抖动时不再丢数据 |
| 8 | `FIRMWARE_VERSION` 与文件头注释同步 | `main.cpp:2, 31` | 建议发布时改 `0.4.1` |
| 9 | `SERVER_HOST` 支持串口命令 `server <ip>` 写 NVS | `wifi_config.h` | 解决热点网段漂移必须重新烧录的运维痛点 |
| 10 | `wifi_config.h.example` 的 `SERVER_PORT` 从 8001 改回 8000 | `firmware/include/wifi_config.h.example` | 照抄模板会连到历史微服务端口 |
| 11 | DS18B20 土温（GPIO8 + 4.7kΩ 上拉） | `board_pins.h` PIN_SOIL_TEMP | M3；在此之前界面必须标注"模拟值" |
| 12 | OLED SSD1306 状态显示 | I2C 0x3C | 本期不做 |

### 5.9 部署与网络

- 现状：`SERVER_HOST` 硬编码 `192.168.43.103`，手机热点重启后网段在 43.x 与 50.x 之间漂移，必须改代码重烧。这是现场最常见的"设备失联"原因。
- 过渡方案（M2）：串口 `server 192.168.50.12` 写 NVS，重启生效；后台提供"复制服务器地址"按钮，显示后端当前局域网 IP。
- 目标方案（M4）：mDNS 广播（`_flguardian._tcp`），固件解析不到再回退 NVS；或在设备详情页下发 `set_host` 命令。
- 后端监听 `0.0.0.0:8000`，系统防火墙放行 8000；上报走明网 HTTP，仅限内网，公网部署必须套 TLS 并启用设备 token。
- 数据库默认端口 5555（`docker-compose` 映射），与管理后台无关，不要写进前端配置。

### 5.10 数据保留

| 数据 | 保留 | 说明 |
| --- | --- | --- |
| device_readings 原始 | 7 天 | 定时任务每日 03:30 清理 |
| device_readings_hourly | 90 天 | 每 15 分钟增量聚合 |
| device_events | 180 天 | 或按数量上限 10 万条 |
| device_commands | 30 天 | 过期命令先置 expired 再清 |

10 秒周期 × 12 台 ≈ 10.4 万行/天，7 天约 73 万行，单表可控；超过 50 台设备时必须上分区（按 received_at 月分区）。

### 5.11 安全

- 设备凭证：`token_hash = sha256(device_code + SECRET_KEY)` 前缀校验；固件烧录时写入。禁止复用用户 JWT。
- 后台写操作（命令下发、停用设备、清空数据）必须记审计，带操作人、IP、目标。
- `/api/devices/**` 不纳入 CORS 白名单暴露（`allow_origins=["*"]` 目前对全部路径开放，建议按路径收窄）。
- 上报报文大小上限 2KB，超限 413。

### 5.12 验收（硬件回环）

1. 固件编译通过（PlatformIO `pio run`），版本号与注释一致。
2. 断开后端，设备重试 3 次后进入缓冲；恢复后端后 30 条读数按 `seq` 补齐且无重复。
3. 拔掉 BH1750，`light_lux` 为 null，后台显示"光照不可用"而非 0；插回后 10 秒内恢复。
4. 土壤 ADC 悬空，`sensors.soil = "simulated"`，后台该设备卡片带"未校准"标记。
5. 执行 `cal air` 与 `cal water`，`devices.calibration_* ` 更新，湿度从模拟值切换为真实百分比。
6. 拔电重启，10 秒内恢复上报，`online` 事件一条，不重复建档。
7. 修改热点网段，验证 `server <ip>` 生效，无需重烧。

---

## 6. React 前端架构

### 6.1 技术选型

| 关注点 | 选择 | 理由 | 不选 |
| --- | --- | --- | --- |
| 构建 | Vite 5 + React 18 + TypeScript（strict） | 秒级冷启动，配置少；不引入 Next.js（后台无 SSR/SEO 需求，`web/` 的 Next.js 已删除） | Next.js、CRA |
| 路由 | React Router 6（createBrowserRouter） | 嵌套布局 + 路由守卫直观 | 自研 hash 路由 |
| 服务端状态 | TanStack Query v5 | 缓存、轮询、失效、重试开箱即用，正好匹配设备实时页 | Redux、SWR 手写 |
| 客户端状态 | React useState/useReducer + Context（仅会话与主题） | 后台几乎没有跨页客户端状态 | Zustand（非必要不引入） |
| 表单 | react-hook-form + zod | 植物/商品字段多，需要字段级错误 | Formik |
| 样式 | 原生 CSS + CSS 变量 + 每组件一个 `.module.css` | 设计规范要求精确的 1px 线、24px gutter、tabular-nums，UI 库会带来自带间距与阴影 | Tailwind 工具类堆叠、Ant Design、MUI |
| 图表 | 移植 tasteskill 的 `charts.js` 为 TS 模块（SVG，无依赖） | 与研究基线一致的坐标轴/网格规则，体积小 | ECharts、Recharts（默认样式与规范冲突） |
| 图标 | 内联 SVG（16px 线框，stroke 1.5） | 规范禁止彩色圆圈图标 | 图标字体、emoji |
| 测试 | Vitest + Testing Library；契约测试用 MSW | — | — |

### 6.2 目录结构

```
web-admin/                       (新建，与 backend/ 平级；不复用已删除的 web/)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── .env.example                 VITE_API_BASE=http://localhost:8000
└── src/
    ├── main.tsx
    ├── app/
    │   ├── router.tsx           路由表 + 守卫
    │   ├── shell.tsx            侧边栏 + 画布
    │   └── providers.tsx        QueryClient / Session / Toast
    ├── features/
    │   ├── auth/                LoginPage、useSession、RequireRole
    │   ├── overview/            OverviewPage、KpiStrip、AnomalyList、DeviceRail
    │   ├── devices/             DeviceList、DeviceDetail（4 tab）、CalibrationPanel、CommandButton
    │   ├── orders/              OrderList、OrderDetail、StatusTransition
    │   ├── plants/              PlantList、PlantForm（三分组）
    │   ├── products/            ProductList、StockAdjust
    │   ├── users/               UserList、UserDetail
    │   └── settings/            SettingsPage、DangerZone、AuditLog
    ├── ui/                      Table、Pill、Panel、KpiStrip、Toolbar、Empty、ErrorState、Tabs、Field、Confirm
    ├── lib/
    │   ├── api.ts               fetch 封装、错误规范化、401 拦截
    │   ├── queries.ts           查询键工厂与 hooks
    │   ├── format.ts            金额/百分比/相对时间/等宽数字
    │   └── charts.ts            SVG 图表（line/bars/barList）
    └── styles/                  tokens.css、base.css、app.css
```

### 6.3 路由表

| 路径 | 页面 | 角色 | 说明 |
| --- | --- | --- | --- |
| `/login` | 登录 | 公开 | 成功后校验 role |
| `/` | 重定向 `/overview` | — | — |
| `/overview` | 总览 | 全部 | — |
| `/devices` | 设备列表 | 全部 | `?status=offline&q=` 同步到 URL |
| `/devices/:id` | 设备详情 | 全部 | `?tab=live|history|events|config` |
| `/orders` | 订单列表 | operator/support/superadmin | — |
| `/orders/:id` | 订单详情 | 同上 | — |
| `/plants` | 植物库 | operator/superadmin | — |
| `/plants/:id` | 植物编辑 | 同上 | — |
| `/products` | 商品 | operator/superadmin | — |
| `/users` | 用户 | support/superadmin | — |
| `/users/:id` | 用户详情 | 同上 | — |
| `/settings` | 设置 | superadmin | 各区块用 hash 子路由 |
| `*` | 未找到 | — | — |

### 6.4 数据层

- `api.ts`：`baseUrl` 来自 `VITE_API_BASE`；自动加 `Authorization`；响应非 2xx 抛 `ApiError{status, detail}`；401 触发 `session.clear()` 并跳登录。
- 登录请求单独用表单编码发送（`URLSearchParams`），不要 JSON。
- 查询键：`['overview', range]`、`['devices', filters]`、`['device', id]`、`['device', id, 'readings', window, granularity]`、`['orders', filters]` 等。
- 新鲜度：列表 `staleTime: 30_000`；总览 `staleTime: 60_000`；设备详情的实时 tab `refetchInterval: 10_000`，其余 tab 关闭轮询。
- 写操作成功后 `invalidateQueries` 精确失效，不做全量刷新。
- 全局错误边界 + 每个列表的局部错误态（保留表头，表格区一行错误说明 + 重试按钮）。

### 6.5 权限

`RequireRole` 包裹路由；导航项按角色过滤；写按钮在无权限时不渲染（不是禁用后不加说明）。后端仍是最终防线。

### 6.6 组件清单

`KpiStrip`（单容器 + 1px 分隔）、`Panel`（1px 边框，无阴影）、`Table`（吸顶表头、右对齐数字、等宽数字）、`Pill`（5 种语义）、`Toolbar`（搜索 + 筛选 + 计数）、`Tabs`（1px 通栏线 + 2px 指示条）、`Empty`（保留框架 + 一句说明）、`ErrorState`、`Confirm`（破坏性操作，写明后果）、`Field`（标签在上，错误在输入框下）、`TimeAgo`、`CopyId`。

---

## 7. 界面设计规格

### 7.1 判定与依据

- 类型：app screen（管理控制台）；设计方向 **framed-sheet**（light，seed `367902491`，2026-11-15 重抽，kind `smb-admin`），记录在 `.taste-skill/app/direction.json`。
- 该方向只有一处 move，被完整采纳、无 redraw：侧栏与 48px 顶栏共用同一张 tinted 底、两者之间**没有分隔线**；页面是一张白色 sheet，从窗口右、下各内缩 8px，1px 边、16 圆角、**无阴影**；激活项只靠 2px 下划线或字重区分，chrome 其余全灰。
- 研究基线（247 个站点中 23 个真实产品屏的统计）：17/23 无阴影，12 个屏没有实心主按钮，9 个屏正文标题 ≤16px，0 个屏用彩色圆形图标或 sparkline，0 个屏做斑马纹表格。
- 因此本后台：表面扁平、线分三级、一个强调色只上数据、导航弱、图表无 chrome、表格只靠留白与对齐。
- face：取两条。① frame 的 tint 换成 APP 的暖白偏粉灰 `--ground: #f7f3f0`，sheet 保持纯白——与小程序/APP 的暖白 `#fffbf5` 同源，不像中性灰那样把界面推向通用仪表盘；② 品牌玫瑰粉直接做数据色 `--chart-1: #d93a44`，只出现在折线、柱与 tab 下划线，chrome 保持灰。
- 配色唯一来源是 `APP/src/constants/theme.ts`（主色 `#f46` 系 `#ff6b88`/`#e6335c`、清新绿 `#52c41a`、暖黄 `#faad14`、暖白 `#fffbf5`、正文 `#333333`）。原值不能直接搬到 Web：`#f46` 在白底只有 3.75:1，压到 `--accent: #c9303c`（5.29:1）才够 WCAG AA，`--chart-1` 用 `#d93a44`（4.53:1）。绿色只保留给正向状态，不再承担强调色。
- signature element：设备详情页标题行。h1 是人给花盆起的名字（「展厅东北角花盆」），设备码、位置、固件、IP、上次标定压进 h1 下方一行 13px 副行，设备码用等宽字体。机器码不占标题位，但永远在首屏可见。

### 7.2 Token

| 用途 | 值 | 备注 |
| --- | --- | --- |
| `--ground` | `#f7f0ef` | frame 的 tint（face ①：APP 暖白偏玫瑰的玫瑰骨色，色相落在红区而非黄区，避免读成米黄） |
| `--surface` | `#ffffff` | sheet 与卡片 |
| `--raised` | `#fbf7f4` | 内嵌井、hover、缩略图底 |
| `--active` | `#f3ece7` | 导航 hover、图标按钮 hover |
| `--border` | `#ebe4df` | sheet 边、1px 通栏线 |
| `--rule` | `#f5f0ec` | 表格行线 |
| `--control` | `#d8cdc6` | 控件边、图表基线 |
| `--text` / `--muted` / `--faint` | `#2b2523` / `#6b6461` / `#7c7570` | 三级文字；text 15.1:1、muted 5.8:1、faint 4.5:1（仅用于刻度与页脚） |
| `--accent` / `--accent-hover` | `#c9303c` / `#b12a35` | 品牌玫瑰压暗版，白底 5.29:1；实底主按钮、tab 下划线、导航图标 |
| `--accent-soft` / `--accent-track` | `#fbe9ea` / `#f4d2d4` | 面积填充起色、头像底、未满柱、开关轨 |
| `--positive` / `--negative` / `--warning` | `#2f7a0e` / `#8f1c22` / `#7a4d05` | 状态语义；绿色从此只表示"正常" |
| `--chart-1` / `--chart-2` / `--chart-3` | `#d93a44` / `#2f7a0e` / `#a86f0c` | 单序列只用 chart-1（face ②） |
| 胶囊 | 正向 `#eef8e6/#245c07`、负向 `#fdeaea/#8f1c22`、提醒 `#fdf5e2/#7a4d05`、中性 `#f3ece7/#4a4441` | 淡底深字同色系，高 22 |
| 字体 | IBM Plex Sans 400/500/600 正文；IBM Plex Mono 400 仅 ID、键与表格数字 | 正文 14/20，表格 14/20，小号 12-13，区块标题 16/600，页面标题 24/600 |
| 圆角 | sheet 16，卡片 10，控件 8，胶囊 999 | 不用 11-12，也不做 4 直角胶囊 |
| 间距 | 4 的倍数；卡片内 20，块间 24 | KPI 行与图表行同一 gutter |
| 侧边栏 | 228px（≤1100 收 200） | 永不深色、永不高饱和 |
| 控件高 | 32（标题/筛选行） | 表格行 48，开关 30 × 18 |

品牌色冲突处理：`design.md` 首行写主色 `#e94b52`（珊瑚红），第三节又写"清新绿 + 暖木色"。APP 实际实现（`APP/src/constants/theme.ts`）是以 `#f46` 玫瑰粉为主、`#52c41a` 清新绿为辅、`#faad14` 暖黄点缀，本节按 APP 现状落地。所有引用收敛在 `--accent`、`--accent-hover`、`--accent-soft`、`--accent-track`、`--chart-1` 五个变量，若最终裁决为绿系只需改这五行；绿色已保留为正向状态色，改配色时不会与语义打架。

### 7.3 骨架与栅格算术

```
1440 视口（Chrome 实测）
├── 侧栏 228（frame 的一部分，与 48px 顶栏同底色，两者之间没有分隔线）
└── .main 1212（右、下各内缩 8）
    ├── 顶栏 48
    └── sheet 1204（padding 24 → 内容 1154）
        ├── 栅格 12 列，gutter 24 → 列宽 (1154 - 11×24) / 12 = 74.17
        │   ├── 8 列 = 761（左栏）
        │   └── 4 列 = 369（右栏）
        │       └── 761 + 24 + 369 = 1154
        ├── 面板内宽 = 栏宽 - 2×20：左 721，右 329
        ├── 列表：表格满宽 1154（不套卡片），th 36 / td 48
        └── 设置：居中 1152，左标签列 450 + 24 + 面板 678 = 1152
```

实现用 `grid-template-columns: repeat(12, minmax(0,1fr))` 与 `.span-8 / .span-4`，不写死 761 这类整数；上表是验收时的实测值。

首屏 1440×900 实测（`/` 总览，`document.scrollHeight = 1123`）：

| 元素 | x | top | 宽 × 高 | 说明 |
| --- | --- | --- | --- | --- |
| sheet | 228 | 48 | 1204 × 1067 | 1px 边、16 圆角、无阴影 |
| 标题行 | 253 | 73 | 1154 × 53 | h1 24/600 + 副行 13 |
| KPI 条 | 253 | 146 | 1154 × 117 | 单容器，1px 分隔，4 等分 |
| 左栏第一张卡（销售额趋势） | 253 | 287 | 761 × 319 | 图 240 高 |
| 右栏第一张卡（待办） | 1038 | 287 | 369 × 335 | 与左栏同顶 |
| 左栏第二张卡（最近订单） | 253 | 630 | 761 × 386 | 表 719 宽 |
| 右栏第二张卡（在线率） | 1038 | 645 | 369 × 445 | 与左栏底接近 |

两栏同顶（287），左栏底 1016、右栏底 1090；两栏都是 `display:flex; flex-direction:column`、卡片间距 24，卡片内部不拉伸子块。订单页 11 行时 `scrollHeight` 正好 900（不出现滚动条），设备页 24 行时 1534。

### 7.4 逐屏规格

每屏回答一个问题，并写一句 finding。屏序与路由和 `web-admin/` 一致。

**S1 登录 `/login`**（`src/screens/Login.tsx`）
- 问题：谁能进来。
- 两栏：左陈述块（一句 26/600「设备读数、订单与用户，在同一张表里对齐。」，末段用 `--accent` 着色 + 四条 fact 行：在线设备 18 / 24 台、今日订单 11 单 · 3,180 元、待处理告警 5 条、最近同步 13:55 秒级（四条 fact 全部从种子数据算出）），右 384 卡片；整体 max-width 1000、gap 72、垂直居中。≤860 时左栏整块隐藏，只留卡片居中，避免标题在 420 宽度下滑成多行。
- 左栏不是营销口号，而是把当天真实状态摆在登录之前——进来的人先知道自己在进一个什么现场。
- 右卡片：20/600「登录运营后台」+ 13px 灰副行「护花使者 · 设备、订单与用户运营」；账号、密码两个 38 高字段；主按钮深墨色实底白字（不用品牌绿——本屏强调色一旦用绿会与「正常/在线」语义混淆）；错误信息 13px `--negative` 在按钮上方；底部 13px `--faint`「仅限已授权的运营人员。登录行为会记录来源 IP 与时间，用于审计。」
- 屏幕底部固定一行 `--faint`：「环境：生产 · 华东」与「v1.0.0」两端对齐。

**S2 总览 `/`**（`src/screens/Overview.tsx`）
- 问题：今天是否需要人工介入。
- h1「总览」24/600；副行「2026-11-15 周六 · 数据截至 13:55，每 60 秒刷新」；右侧 segmented（今日 / 7 日 / 30 日）与「导出」描边按钮。
- KPI 条 4 格（单容器，1px 分隔）：今日销售额 3,180 元（= 今日 11 张订单金额之和，cap「-17.6% 较昨日 3,860」，负数走 `--negative`）、今日订单 11 单（cap「其中待确认 N 单」）、在线设备 18 / 24 台（cap「N 台离线，N 台告警」）、待处理告警 N 条（cap「N 台设备，N 张订单超时」）。N 由种子数据算出而非写死，改数据时 KPI、侧栏计数与待办列表同步变化。无图标、无 sparkline、无着色底。
- 左 8 列两张卡：销售额趋势（图 240 高、min 0 / max 5000、5 条水平网格、无 y 轴线、单序列无图例、`--accent-soft` 面积填充、meta「近 7 天合计 22,160 元」）+ 最近订单（5 行，订单号等宽、状态胶囊，末行「查看全部 N 张订单」文字链接）。
- 右 4 列两张卡：待办 5 行（每行一句事实 + 一个胶囊：高危 / 掉线 / 超时 / 补货 / 升级）+ 设备在线率柱图（96 高、5 根柱，对应 A 栋 5/7、B 栋 4/6、园区 4/5、温室 4/4、仓库备用 1/2），每行下挂「N 台已登记 · 备注」。
- 空态：无设备时 KPI 打灰短横，主图位置给「尚无设备上报」一句，高度收敛到 120。

**S3 设备与传感 `/devices`**（`src/screens/Devices.tsx`）
- 问题：哪台设备现在有问题。
- h1「设备与传感」；副行「24 台已登记 · 18 台在线 · 上报间隔 10 秒」；右侧「导出清单」描边 +「登记设备」实心（本屏唯一实心按钮）。
- 警示条：`--pill-warning-bg` 底、无边框，点名 3 台离线设备编码 +「查看断连记录」小按钮。
- tab（全部 24 / 在线 18 / 离线 3 / 告警 3）坐在 1px 通栏线上，可切换并过滤表格；指示条 2px 墨色、`right: -8px` 使宽度略超标签。
- 工具栏：搜索 300 × 32（占位「设备编码、名称或位置」）+ 分组 select + 固件 select + 右侧「N 台」。
- 表格不套卡片，表头 13px `--muted`、无底色；列：设备（编码等宽 + IP 副行）/ 位置 / 固件（右对齐）/ 最后上报（右对齐 + 信号副行）/ 土壤湿度（右对齐 + 告警行副行「低于下限 35%」）/ 光照（右对齐）/ 状态胶囊 / 详情按钮。
- 行高 48；离线行不整行染色；缺失读数打灰短横 `—`，真零照常打印 `0`。
- 空态：「没有匹配的设备」+ 清除筛选。

**S4 设备详情 `/devices/:code`**（`src/screens/DeviceDetail.tsx`）
- 问题：这台设备的读数可信吗。
- 面包屑「设备与传感」；h1 是**人给花盆起的名字**（「展厅东北角花盆」）；设备码、位置、固件、IP、最后上报压在 h1 下一行 13px 副行，设备码等宽——机器码不占标题位，但永远首屏可见。
- 标题行右侧：状态 chip +「查看日志」描边 +「下发命令」实心。
- 4 格 KPI：土壤湿度 32.4%（cap 用 `--negative`「低于下限 35%」）、土壤温度 18.4 °C（cap「DS18B20 探头」）、光照 812 lx（cap「BH1750 读数」）、上报间隔 10.0 s（cap「接收延迟 186 ms」）。
- 左 8 列：土壤湿度 · 近 24 小时折线（236 高、min 20 / max 70、5 条网格、阈值 35 画 `--negative` 虚线、标注「07:00 浇水 64.8%」）+ 最近上报原始表（时间等宽、土壤湿度 / 土温 / 光照 / 固件右对齐）。
- 右 4 列：土壤标定（cal air 2,215 ADC、cal water 984 ADC +「重新校准」）、命令队列 3 条（成功 pos / 待执行 neu / 失败 neg，每条带「下发 · 回执」副行）、健康度 4 行（上报成功率 8,556 / 8,600 次、掉线次数最长 42 秒、时钟漂移 ESP32 未校时、信号强度 2.4G · 信道 6）。
- 离线时顶部警示条写「最后上报 12 分钟前，已判定离线」，读数表暂停轮询并显式提示。

**S5 订单 `/orders`**（`src/screens/Orders.tsx`）
- 问题：今天有哪些单要发出去。
- h1「订单」；副行「2026-11-15 · 今日 11 单，合计 3,180 元」（单数与金额由 `todayOrders` 从订单数组算出，改数据不会与 KPI 打架）；右侧「导出」。
- 状态 tab 6 个（全部 11 / 待确认 2 / 待发货 2 / 已发货 4 / 已完成 2 / 已取消 1）可切换过滤，tab 后带计数；计数由数据算出，不写死。
- 工具栏：搜索「订单号或用户名」+ 配送方式 select（快递 / 自提）+ 右侧「N 张」。
- 表格 8 列：订单号（等宽）、用户、件数（右）、金额（右，两位小数 + 灰「元」单位）、配送、状态胶囊、动作。
- 待确认行给可见的墨色文字动作「确认」，其余行是 kebab；不做灰色静默文字。
- 表格下方 `.table-foot`：左侧「显示 1-11 条，共 11 条」，右侧上 / 下一页 + 等宽「1 / 1」。
- 状态机 `pending → confirmed → shipped → completed`，任意非终态可 `cancelled`；后端 `PUT /api/admin/orders/{id}` 不校验跳转合法性，由前端拦。

**S6 用户 `/users`**（`src/screens/Users.tsx`）
- 问题：谁在用，谁有硬件。
- h1「用户」；副行「1,842 位已注册 · 412 位 7 日内活跃 · 97 位绑定了设备」；右侧「导出」+「新建账号」实心。
- 4 格 KPI：注册用户 1,842（cap 近 7 天新增 46）、7 日活跃 412（cap 活跃率 22.4%）、绑定设备 97（cap 共 24 台设备在线）、后台账号 4（cap 1 位超级管理员）。
- 表格 8 列：用户（32 首字占位 + 名字 + ID 副行）、邮箱、角色胶囊、植物（右）、订单（右）、设备（右）、注册时间、最近登录（右）。
- 角色胶囊只给 support / operator / hardware / superadmin，普通用户不显示胶囊，避免整列色块；0 值打灰短横。
- 表格下方 `.table-foot`：「显示 1-9 条，共 1,842 条」+ 分页「1 / 185」。
- 缺口：后端 `/api/admin/users` 无状态字段、无最后登录，本屏这两列依赖新增 `last_login_at`。

**S7 设置 `/settings`**（`src/screens/Settings.tsx`）
- 问题：判定与保留规则到底怎么定。
- 居中 1152；标题行右侧「恢复默认」描边 +「保存全部更改」实心。
- 每节一行：左 450 标签列（16/500 标题 + 13 灰描述 + 一行 `--faint` 的「当前：…」），右 678 井（`#fafafa` 底、8 圆角、16 内边距、无边框无阴影）；节间通栏 1px 线、上下各 32。
- 四节：设备上报（在线判定窗口 30 秒、离线告警阈值 120 秒、原始读数保留 7 天，各带单位后缀与一句后果说明）、告警通知（三个 switch + 土壤湿度下限 25 + 同类告警防重复 60 分钟）、账号与权限（显示名称、登录邮箱、角色 select，另给「修改密码」）、危险操作（两个 `--danger-zone` 描边卡：清空设备原始读数 1,246,080 条、注销后台账号）。
- 每个开关旁必须写清触发条件与后果，不只写「启用」；每节底部有独立「保存本节」，整页另有「保存全部更改」。

**S8 植物库 `/plants`**（`src/screens/Plants.tsx`，与订单同属「经营」组）
- 问题：哪些植物缺料、缺图、识别类没映射。
- h1「植物库」；副行「12 种已上架 · 识别模型覆盖 47 类 · 8 种待补图」；右侧「导入」+「新增植物」实心。
- 警示条：8 种植物缺少主图或未校验 `yolo_class_id`，补全前不进入识别候选集。
- 工具栏：搜索「名称或学名」+ 类别 select（观叶 / 观花 / 香草 / 蔬果）+「12 种」。
- 表格 8 列：植物（28 缩略图 + 名称 + 学名副行）、类别、YOLO 类别（等宽右对齐）、养护难度（右）、新手友好（右）、成活率（右 + %）、光照、毒性胶囊。
- 缺失值打灰短横；有毒 / 无毒都用胶囊，因为毒性是必须一眼看到的字段。
- 写入前必须补后端 schema 缺的 `image_url` 与 `yolo_class_id` 校验（见 4.5）。

### 7.5 组件细则

- KPI：一个容器、1px 分隔、等宽列（`grid-auto-flow: column`）；无图标、无迷你图、无着色底。标签 13 在上、值 28/500 `tabular-nums` 在左、cap 12 在下，三段间距各 3-4；单位 14 灰、左距 4。
- 面板：1px `--border`、10 圆角、20 内边距、无阴影；标题 16/600 与右侧 meta 12 同一基线。内嵌的信息组用 `--raised` 底 + 10 圆角 + 16 内边距，不再套第二层边框。
- 表格：不套卡片；行线 1px `--rule`；th 36 高、13px `--muted`、无底色、不加大写也不加字距；td 48 高、14px；数值列右对齐 + `tabular-nums`，右内边距 20；金额两位小数带千分位、单位灰且 3px 间距；缺失值 `--control` 短横，真零照常打印；一行一个状态胶囊。
- 胶囊：高 22、全圆角 999、13px，四组淡底深字（正向 `#eef8e6/#245c07`、负向 `#fdeaea/#8f1c22`、提醒 `#fdf5e2/#7a4d05`、中性 `#f3ece7/#4a4441`）。胶囊只表达状态，不表达可点击；可点击的是文字链接或描边小按钮。
- 图表：一个问题一条序列，单序列不画图例；y 刻度 5 个整数、标签 11px `--faint` 右对齐；水平网格 1px `--grid`，基线 1.25px `--control`，无 y 轴线；x 标签 4-8 个不旋转、首尾改锚点防出界；折线 2px `--chart-1`；面积是同一色相 `--chart-1` 从 0.18 到 0 的竖向渐变，不引入第二种色相；阈值线 `--negative` 4 3 虚线、opacity .5 并带「下限 35%」文字；事件标注 3 3 虚线 + 6px 偏移标签，靠右 96px 内改 `text-anchor: end`。
- 图表交互：hover 出竖线（`--control`）+ 3.5px 圆点（白描边）+ 浮层（时间、数值、单位），浮层贴图表顶端并夹在 `[62, 宽-62]` 内；浮层出现时隐藏事件标注，避免文字重叠。柱状图 hover 换 `--accent` 并加深对应的 x 标签；未收满数据的当日用 `--accent-track` 浅柱，不加额外说明。
- 按钮：高 32，小号 26；每屏最多一个实心（`--accent` 底白字，hover 转 `--accent-hover`），其余描边或纯文字；破坏性操作用 `--accent-track` 描边 + `--negative` 文字，并二次确认；禁用态文字转 `--control` 且 hover 不变色。
- 表单：标签在上 13/500、距输入 8；输入 38 高、1px `--border`、8 圆角，焦点时边框转 `--accent` 并加 1px 外描边（不用 box-shadow）；帮助文案 13 `--muted`、距输入 6；字段之间 16。
- 开关：30 × 18，`appearance: none` 去掉原生外观，`::after` 14 白点，选中转 `--accent` 并右移 12。
- 分段控件：容器 `--raised` 底、高 32、内边距 2；选中项白底、字重 500。
- tab：36 高、14px，选中 600 加 2px `--accent` 下划线，下划线 `right: -8px` 使其略超出标签宽度；计数用 13px `--faint`。
- 空态与骨架：骨架用真实尺寸灰块，不做 shimmer；空态保留表头与卡片框架，一句话加一个动作。

### 7.6 状态与反馈

| 场景 | 表达 |
| --- | --- |
| 加载中 | 骨架占位，保持行高与列宽；局部加载不改布局 |
| 空结果 | 框架 + 一句说明 + 清除筛选 |
| 请求失败 | 该区块内一行错误说明 + 重试；不整屏白屏 |
| 无权限 | 页面级说明 + 返回入口，不显示空表格 |
| 数据新鲜度 | 6px 圆点 + 相对时间，超阈值圆点转 `--negative` |
| 警示 | 顶部 `.notice`（`--pill-warning-bg` 底、无边框）+ 一个文字动作 |
| 写操作成功 | 行内状态更新 + 顶部 32 高提示条 3 秒后消失；不做弹窗动画 |
| 破坏性确认 | 对话框列出受影响对象数量与不可逆后果 |
| 分页 | 表格下方 `.table-foot`：左侧条数与总数，右侧上 / 下一页 + 等宽页码 |

### 7.7 响应式

三档断点，与 `web-admin/src/styles/admin.css` 一致；截图见 `web-admin/shots/`（1440×900）。

- ≥1101：侧栏 228 常驻；12 列栅格，总览与设备详情为 8 + 4 双栏；gutter 24。
- 861-1100：侧栏收到 200，gutter 与内边距收到 20；`.span-8 / .span-6 / .span-4` 全部落 12 列单栏；KPI 变 2×2（第 2 列补左边框、第 3 行起补上边框）；设置页 450 + 678 转单列。
- ≤860：`--sidebar-width: 0`、`.frame` 改 block，侧栏转顶部横向滚动条（品牌名与五个导航项同行，分组标签与页脚隐藏）；sheet 内边距 16、圆角收到 12；表格 `min-width: 720px` 横向滚动；标题行允许换行，右侧动作不再靠右。
- 打印：不设计（各屏均无打印样式）。

### 7.8 禁止清单

- 不使用 emoji（全部用 16px 线框 SVG）。
- 不使用彩色圆形图标、渐变按钮、玻璃拟态、发光阴影。
- 卡片不同时使用边框与阴影；静止态无阴影。
- 表格不做斑马纹、不做表头填充色块。
- 不使用紫/靛色作为强调色（研究基线中已被用滥）。
- 不在 KPI 上加 sparkline。
- 不使用仪表盘式环形进度（除非 3-5 份的占比）。
- 不出现"欢迎回来"式问候标题。
- 不在同一屏同时出现页面级与卡片级的日期范围。

---

## 8. 验收与验证

| 层 | 方法 | 通过标准 |
| --- | --- | --- |
| 接口契约 | pytest + httpx，对 `/api/devices/{code}/readings` 建 8 个用例（首次建档、重复 seq、缺 token、超范围、乱序、空读数、限流、命令回传） | 全部通过 |
| 前端类型 | `tsc --noEmit` | 0 error |
| 前端单测 | Vitest：format、状态机、权限守卫 | 覆盖关键分支 |
| UI 规范 | `node scripts/lint.mjs --app <files>` | 无 FAIL |
| 视觉 | `node scripts/inspect.mjs <file> --out shots --widths 1440,768,390 --app --json` | 退出码 0；抓 1440 与 390 截图人工复核 |
| 固件 | `pio run` + 第 5.12 节 7 条回环 | 全部通过 |

---

## 9. 里程碑

| 里程碑 | 内容 | 产出 | 估算 |
| --- | --- | --- | --- |
| M1 | 工程骨架、登录、总览（经营部分）、订单 | 可登录、可看趋势与订单 | 4 人日 |
| M2 | 设备后端（表 + 4 个接口 + 聚合）、固件修复与上报 v2、设备列表与详情 | 10 秒一条读数进入后台并可视 | 6 人日 |
| M3 | 植物库扩展、商品与库存、用户、总览设备块、DS18B20 土温 | 内容与运营闭环 | 5 人日 |
| M4 | 识别/诊断统计、调度任务页、mDNS 发现、导出 | 运营分析 | 4 人日 |
| M5 | RBAC、审计日志、设置页、危险操作、性能与可访问性复核 | 可多人使用 | 4 人日 |

前置条件：M2 的第一步必须是修复 `firmware/src/main.cpp` 的编译错误（12.2），否则所有固件验证都无法进行。

---

## 10. 风险与待决

| 编号 | 风险 | 影响 | 建议 |
| --- | --- | --- | --- |
| R1 | 品牌主色未裁决（`#e94b52` 与"清新绿"冲突） | 界面强调色可能返工 | 本轮用变量占位；裁决后改 4 个变量 |
| R2 | 固件源码当前无法编译 | M2 阻塞 | 第一天修 12.2，加 CI 编译检查 |
| R3 | 无设备鉴权 | 内网可伪造上报 | 启用 device token，调试期用开关 |
| R4 | 只有 admin 布尔位，无审计 | 多人使用无法追责 | M5 补角色与审计表 |
| R5 | 10 秒周期在设备数 >50 时写库压力 | 查询变慢 | 提前上小时聚合与月分区 |
| R6 | 热点网段漂移 | 现场失联 | M2 串口 `server` 命令，M4 mDNS |
| R7 | `allow_origins=["*"]` | 任意站点可调管理接口（仍受 JWT 限制） | 收窄到后台域名 |
| R8 | 无库存流水 | 库存对不上无法追溯 | M3 补 `stock_movements` |

待决问题：

1. 设备是否必须绑定到用户（`owner_user_id`）？当前设计为可空。
2. 是否需要多租户/多门店？若需要，所有表要加 `tenant_id`。
3. 是否需要中英文切换？若需要，字符串必须从第一天外置。
4. 订单发货是否需要对接快递单号与物流查询？
5. 设备数据是否对用户可见（消费者端展示自家花盆湿度）？

---

## 附录 A：接口新增清单

| 方法 | 路径 | 说明 | 里程碑 |
| --- | --- | --- | --- |
| POST | `/api/devices/{code}/readings` | 设备上报 | M2 |
| GET | `/api/devices/{code}/commands` | 设备拉取命令 | M2 |
| POST | `/api/devices/{code}/commands/{id}/ack` | 设备确认命令 | M2 |
| GET | `/api/admin/devices` | 设备列表 | M2 |
| GET | `/api/admin/devices/summary` | 汇总 | M2 |
| GET | `/api/admin/devices/{id}` | 详情 | M2 |
| PATCH | `/api/admin/devices/{id}` | 编辑 | M2 |
| GET | `/api/admin/devices/{id}/readings` | 读数 | M2 |
| GET | `/api/admin/devices/{id}/events` | 事件 | M2 |
| POST | `/api/admin/devices/{id}/commands` | 下发命令 | M2 |
| GET | `/api/admin/devices/export` | 导出 CSV | M4 |
| PATCH | `/api/admin/users/{id}` | 角色与状态 | M5 |
| GET | `/api/admin/jobs` | 调度任务状态 | M4 |
| GET | `/api/admin/audit` | 审计日志 | M5 |
| PUT | `/api/admin/plants/{id}` | 扩展字段 | M3 |
| POST | `/api/products/{id}/stock` | 库存调整 | M3 |

## 附录 B：术语

| 术语 | 含义 |
| --- | --- |
| 设备码 device_code | 固件宏 `DEVICE_CODE`，当前 `FG-ESP32-001` |
| 上报周期 | `REPORT_INTERVAL`，当前 10000 ms |
| 哨兵值 | 传感器失败时的内部约定值，如 SHT30 的 `-100.0f`，不得进入报文 |
| 模拟态 | 土壤 ADC 未接线/不稳时固件生成的 45°+20°sin 波形，界面必须标注 |
| stale | 超过 3 个上报周期未收到数据（30 秒） |
| 校准 air/water | 干燥空气与水中采样的 ADC 原始值，用于把原始值换算为 0-100% |

## 附录 C：参考

- 固件缺陷与排障：`firmware/README.md` 第 12、13 章。
- 后端路由注册：`backend/app/api/router.py`。
- 定时任务：`backend/app/main.py` `setup_scheduler()`、`backend/app/tasks/reminder_tasks.py`。
- 界面规范：design-taste-frontend `references/app-screens.md`；本项目的方向文件 `.taste-skill/app/direction.json`。
- 配套界面稿（React demo）：`web-admin/`，见其 `README.md`。
