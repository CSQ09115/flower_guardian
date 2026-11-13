# 护花使者 · ESP32-S3 固件 (firmware/)

> 花盆端硬件终端：采集土壤湿度、光照、温湿度，经 WiFi 上报到后台。
> 本目录是 **PlatformIO + Arduino 框架** 工程，芯片为 **ESP32-S3-N16R8**（16MB Flash + 8MB PSRAM）。

---

## 目录

- [1. 当前状态](#1-当前状态)
- [2. 目录结构](#2-目录结构)
- [3. 硬件清单与引脚分配](#3-硬件清单与引脚分配)
- [4. 快速开始](#4-快速开始)
- [5. 配置 wifi_config.h](#5-配置-wifi_configh)
- [6. 编译与烧录](#6-编译与烧录)
- [7. 串口调试命令](#7-串口调试命令)
- [8. 土壤湿度标定](#8-土壤湿度标定)
- [9. 数据上报协议](#9-数据上报协议)
- [10. LED 状态编码](#10-led-状态编码)
- [11. 固件版本演进](#11-固件版本演进)
- [12. 已知问题与待办](#12-已知问题与待办)
- [13. 排障速查表](#13-排障速查表)
- [14. 工具脚本](#14-工具脚本)
- [15. 相关文档](#15-相关文档)

---

## 1. 当前状态

| 项目 | 值 | 位置 |
|------|-----|------|
| 固件版本（实际） | `0.4.0` | `src/main.cpp:31` 的 `FIRMWARE_VERSION` 宏 |
| 固件版本（文件头注释） | `v0.2.1` ❌ 未同步 | `src/main.cpp:2` |
| 芯片 | ESP32-S3-N16R8 | `platformio.ini` |
| 框架 | Arduino | `platformio.ini` |
| 上报间隔 | 10 秒（`REPORT_INTERVAL=10000` ms） | `include/wifi_config.h` |
| 串口波特率 | 115200 | `platformio.ini` |

**已实现的传感器**：土壤湿度（电容式 ADC，真实读数）、光照（BH1750，真实读数）。
**仍是模拟值的**：土壤温度（公式 `22 + 3·sin(t/120)`，待接 DS18B20）。
**有驱动但未接入主循环的**：SHT30 空气温湿度（详见[第 12 节](#12-已知问题与待办)）。

---

## 2. 目录结构

```
firmware/
├── platformio.ini          # 工程配置：芯片、Flash/PSRAM、分区表、波特率
├── src/
│   └── main.cpp            # 主程序（约 960 行，含详细中文注释）
├── include/
│   ├── board_pins.h        # 硬件引脚地图（接线前先查这里）
│   ├── wifi_config.h       # 本机私有配置：WiFi + 服务器 + 设备号（已 gitignore）
│   ├── wifi_config.h.example  # 配置模板，复制后改名使用
│   └── README.md           # 头文件目录说明
├── tools/                  # 离线环境搭建脚本 + 串口调试脚本
├── docs/
│   └── 离线环境搭建.md      # 国内网络装不了 PlatformIO 时的完整方案
└── .pio/                   # 编译产物（已 gitignore）
```

编译产物在 `.pio/build/flower_guardian/`：`firmware.bin`（固件）、`bootloader.bin`（引导程序）、`partitions.bin`（分区表）。

---

## 3. 硬件清单与引脚分配

> 接线前先查 `include/board_pins.h`，**不要凭记忆猜引脚**。该文件的数值全部来自商家资料包中小智 AI 源码的 `config.h`。

### 3.1 板载器件

| 器件 | GPIO | 宏名 | 说明 |
|------|------|------|------|
| 板载 LED | 48 | `PIN_BUILTIN_LED` | v0.1 点灯程序已验证 |
| BOOT 按键 | 0 | `PIN_BOOT_BUTTON` | 烧录时按住进下载模式 |
| 触摸按键 | 47 | `PIN_TOUCH_BUTTON` | 套件轻触开关可接这里 |
| 音量 + / - | 40 / 39 | `PIN_VOL_UP` / `PIN_VOL_DOWN` | 可自定义作其他用途 |

### 3.2 I2C 总线（一条总线挂三个器件，靠地址区分）

| 器件 | 地址 | 地址由什么决定 | 固件行为 |
|------|------|----------------|----------|
| OLED SSD1306 | `0x3C` / `0x3D` | 模块固定 | 仅引脚预留，**暂无显示驱动代码** |
| BH1750 光照 | `0x23` / `0x5C` | ADDR 接 GND = 0x23；接 3.3V = 0x5C | 两个地址**自动探测**，见 `main.cpp:198` |
| SHT30 温湿度 | `0x44` / `0x45` | ADDR 接地/悬空 = 0x44；接高 = 0x45 | 两个地址自动探测，见 `main.cpp:328` |

**公共引脚**：`SDA = GPIO41`、`SCL = GPIO42`（`PIN_I2C_SDA` / `PIN_I2C_SCL` 直接别名到 OLED 的两个宏）。
接线：`VCC → 3.3V`、`GND → GND`，模块板上自带 4.7kΩ 上拉电阻，无需外加。

### 3.3 模拟输入

| 器件 | GPIO | 说明 |
|------|------|------|
| 电容式土壤湿度 | 2 | 模块 `AOUT` → GPIO2。**必须用 ADC1（GPIO1~10）** |
| DS18B20 土壤温度 | 8 | 计划中，需 4.7kΩ 上拉；**固件未实现** |

> ⚠️ **ESP32 的 ADC2（GPIO11~20）在开启 WiFi 后不可用**，读出来全是乱值。这是最常见的坑之一，本项目直接用 GPIO2（ADC1）避开。

### 3.4 音频（引脚预留，暂无驱动代码）

| 器件 | 引脚 | 用途 |
|------|------|------|
| INMP441 麦克风 | WS=4 / SCK=5 / SD=6 | I2S 输入 |
| MAX98357 功放 | DIN=7 / BCLK=15 / LRC=16 | I2S 输出 → 喇叭 |

---

## 4. 快速开始

```bash
cd firmware

# 1. 准备私有配置（只做一次）
cp include/wifi_config.h.example include/wifi_config.h
#    然后编辑 wifi_config.h，填入自家的 WiFi 名称/密码、电脑的局域网 IP

# 2. 编译
pio run

# 3. 烧录（端口按实际情况改，Windows 形如 COM7，macOS 形如 /dev/cu.usbmodem*）
pio run -t upload --upload-port COM7

# 4. 看日志（115200）
pio device monitor
```

开机后串口应打印芯片体检 + 传感器体检 + WiFi 连接结果，之后每 10 秒打印一行读数。

> ⚠️ **当前上报会失败**：固件 POST 的目标接口 `/api/devices/{DEVICE_CODE}/readings` 尚未在
> `backend/app` 中实现，后端会返回 404。表现为 LED 每 10 秒急闪三下。详见[第 12 节](#12-已知问题与待办)。

---

## 5. 配置 wifi_config.h

`wifi_config.h` 含 WiFi 密码，**已在 `.gitignore` 中忽略，禁止提交**。从模板复制后按下表填写：

| 宏 | 含义 | 示例 |
|----|------|------|
| `WIFI_SSID` | WiFi 名称，**只能 2.4GHz** | `"FlowerGuardian_2G"` |
| `WIFI_PASSWORD` | WiFi 密码 | `"12345678"` |
| `SERVER_HOST` | 运行后端服务的电脑的**局域网** IP | `"192.168.43.103"` |
| `SERVER_PORT` | 后端端口（主后端为 8000） | `8000` |
| `DEVICE_CODE` | 设备编号，一盆花一个码 | `"FG-ESP32-001"` |
| `REPORT_INTERVAL` | 上报间隔（毫秒） | `10000` |

**四个高频坑**：

1. **SSID 必须逐字节完全匹配**。Windows「网络连接」里显示的名字可能带后缀（本项目曾多出一个 `" 5"`），导致「扫描看得见却连不上」，报原因码 **201**。
   → 建议现场把热点改成纯英文名，彻底避开中文编码问题。
2. **手机热点网段会漂移**。热点重启后网段可能在 `192.168.43.x` 与 `192.168.50.x` 之间变化，`SERVER_HOST` 每次变化都要改并**重新烧录**。
3. **不要**同时反复调用 `WiFi.begin()` 和开启 `setAutoReconnect(true)`，两者冲突会报 `STA clear config failed / ESP_ERR_WIFI_STATE`。本固件采用手动重连，每次重连前先 `WiFi.disconnect(true)`（见 `main.cpp:102`）。
4. **模板端口与实配不一致**：`wifi_config.h.example` 里默认是 `SERVER_PORT=8001`（历史「路线A」独立传感器微服务），而现行「路线B」已统一走主后端 **8000**。照抄模板会连错端口，务必改成 8000。

---

## 6. 编译与烧录

### 6.1 工程关键配置

| 配置项 | 值 | 原因 |
|--------|-----|------|
| `platform` | `espressif32` | 乐鑫 ESP32 系列 |
| `board` | `esp32-s3-devkitc-1` | N16R8 兼容官方 DevKitC-1 引脚定义 |
| `board_build.arduino.memory_type` | `qio_opi` | Flash 四线（QSPI）+ PSRAM 八线（Octal SPI） |
| `board_upload.flash_size` | `16MB` | N16R8 的 16MB Flash |
| `board_build.partitions` | `default_16MB.csv` | 16MB 分区表 |
| `build_flags` | `-DBOARD_HAS_PSRAM` | 启用 8MB PSRAM（跑语音 AI 必须） |
| `upload_speed` | `921600` | 原生 USB 烧录更快 |

### 6.2 ⚠️ 双 Type-C 口：只有一个能烧录

这是本项目踩到的最大的坑。

| 接口 | 设备管理器 | 能否烧录 | 原因 |
|------|------------|----------|------|
| 原生 USB 口 | `USB\VID_303A&PID_4001` → COM5 | ❌ 不能 | 芯片自带 USB-OTG，无 DTR/RTS 复位电路，esptool 连不上 |
| **标「COM」的口**（右侧） | `USB\VID_1A86&PID_55D3` → COM7 | ✅ 能 | 沁恒 **CH343** 串口芯片，复位电路齐全，约 18 秒完成 |

**结论：烧录和看串口日志都走 CH343 那个口。** 插错口的表现是
`Failed to connect to ESP32-S3: No serial data received` —— 不是驱动问题，换口即可。

### 6.3 国内网络装不上工具链？

PlatformIO 官方下载服务器（`dl.registry.platformio.org`）对中国地区 IP 返回 **403**，表现为
`pio run` 卡在 `Downloading 0%`。完整绕过方案见 **[docs/离线环境搭建.md](docs/离线环境搭建.md)**，
其中包含 6 个组装脚本（在 `tools/` 下）的按序执行方法、`.piopm` 与占位包的原理、以及 4 处手工适配补丁。

---

## 7. 串口调试命令

在 `pio device monitor` 或普通串口终端（115200）里直接输入命令回车即可，**无需重新烧录**。
实现见 `main.cpp:840` 的 `handleSerialCommands()`。

| 命令 | 作用 | 典型用途 |
|------|------|----------|
| `help` | 列出全部命令 | 忘了命令时 |
| `scan` | 扫描默认 I2C 引脚（41/42）上 0x08~0x77 的设备 | 怀疑传感器没接好 |
| `scan <SDA> <SCL>` | 用指定引脚扫描，如 `scan 8 9` | 不确定线插在哪组脚 |
| `pins` | I2C 引脚自检：空闲电平 / SDA 是否被 SCL 拉着走（短接）/ 外部上拉是否存在 | 面包板插错列 |
| `adc` | 打印土壤湿度 ADC 原始值、10 次采样的 min~max、跳动量、换算湿度 | 标定前先看这个 |
| `cal air` | 把当前值记为「全干」标定并写入 NVS | 探针放空气中 |
| `cal water` | 把当前值记为「全湿」标定并写入 NVS | 探针插水里 |
| `cal show` | 查看当前 air / water 标定值 | 确认标定是否生效 |

**`scan` 结果怎么读**（`main.cpp:703`）：

| 现象 | 结论 |
|------|------|
| 一个设备都扫不到 | 供电没接 / SDA、SCL 接错脚 / 线断了 |
| 扫到 0x3C 但没 0x23 | 总线是通的，只有 BH1750 有问题（或地址不是 0x23） |
| 扫到陌生地址 | ADDR 引脚电平不对，模块处于另一个地址 |

**`pins` 的环回测试原理**：先把 SCL 设为输出、SDA 设为输入，翻转 SCL 看 SDA 是否跟随。
跟随 = 两根线短接（最常见原因是插在面包板**同一列**，a~e 五个孔内部导通）。
第三步会关掉 ESP32 内部上拉再读，用来判断模块是否真的上电——内部上拉会把悬空脚也拉高，不关掉结论就不可信。

---

## 8. 土壤湿度标定

### 8.1 为什么要标定

每块电容式模块的元件误差都不同，出厂默认值只能当参考。做法是**两点标定**：把「完全干燥」和「完全饱和」两个原始值定下来，中间的任意读数就能线性换算成 0~100%。

换算式（`main.cpp:483`）：

```
湿度% = (airRaw - raw) × 100 / (airRaw - waterRaw)     结果夹到 0~100
```

### 8.2 标定步骤

```
① 探针悬空放在空气中（不要碰任何东西）
   串口输入：adc          ← 先看读数是否稳定
   串口输入：cal air      ← 记为全干点

② 探针插进一杯水（只没过探针，别淹到电路板）
   串口输入：cal water    ← 记为全湿点

③ 串口输入：cal show       ← 确认两个值已保存
```

标定值存在 Flash 的 NVS 里（命名空间 `soil-cal`，键 `air` / `wat`），**断电不丢，不用每次重标**。

### 8.3 出厂默认值与容错

| 常量 | 值 | 含义 |
|------|-----|------|
| `SOIL_AIR_DEFAULT` | `3200` | 出厂「全干」原始值 |
| `SOIL_WATER_DEFAULT` | `1300` | 出厂「全湿」原始值 |
| `SOIL_ADC_SAMPLES` | `10` | 每次读数采 10 个样本取平均（滤毛刺） |
| `SOIL_NOISE_LIMIT` | `300` | 10 样本 max-min 差 > 300 → 判定引脚悬空 |
| `SOIL_FAIL_RESET` | `5` | 连续 5 次判定不稳 → 回退模拟值 |

**未接线时会发生什么**：ADC 引脚悬空读数乱跳，连续 5 次不稳后固件判定「没接线」，自动回退到模拟波形
（`45 + 20·sin(t/60) + 噪声`，夹到 0~100），保证三端界面不出现诡异跳变。
**接好线后无需重启**，下一轮检测到稳定信号就自动切回真实数据。
未满 5 次时沿用上一次的值，避免浇水溅到板子上的瞬间误判。

---

## 9. 数据上报协议

**请求**（`main.cpp:591` 的 `postReading()`）：

```http
POST http://{SERVER_HOST}:{SERVER_PORT}/api/devices/{DEVICE_CODE}/readings
Content-Type: application/json

{
  "soil_moisture": 52.3,
  "soil_temp": 22.4,
  "light_lux": 312.5,
  "firmware": "0.4.0",
  "ip_address": "192.168.43.77"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `soil_moisture` | float | 土壤湿度百分比（可能是模拟值，见上节） |
| `soil_temp` | float | 土壤温度℃，**当前恒为模拟值** |
| `light_lux` | float \| **null** | 光照勒克斯；BH1750 未接或读失败时为 `null` |
| `firmware` | string | 固件版本，取自 `FIRMWARE_VERSION` |
| `ip_address` | string | 本机 WiFi 获得的 IP，便于排查 |

**实现细节**：
- 手工 `snprintf` 拼 JSON，不引入 ArduinoJson（减少依赖），body 缓冲 320 字节
- HTTP 超时 5 秒
- WiFi 未连接时直接跳过本次上报，返回 0
- 成功判定：`code == 200 || code == 201`；其余（含 404）都会触发 LED 急闪三下

> 后端尚未实现该接口。若要联调，需要在 `backend/app/api/endpoints/` 下新建设备路由并在
> `backend/app/api/router.py` 注册；同时建议给 `DeviceReading` 建表。

---

## 10. LED 状态编码

板载 LED 在 **GPIO48**。远处一眼看状态：

| 闪烁节奏 | 含义 | 代码位置 |
|----------|------|----------|
| 每 250ms 翻转（快闪） | 正在连接 WiFi | `main.cpp:112` |
| 亮 120ms / 灭 120ms，2 次 | WiFi 连接失败，等待 15 秒后重试 | `main.cpp:909` |
| 亮 500ms / 灭 500ms（慢闪） | 正常运行，已联网 | `main.cpp:955` |
| 亮 80ms / 灭 80ms，3 次 | 本次上报失败（非 200/201） | `main.cpp:944` |

---

## 11. 固件版本演进

| 版本 | 主要变化 |
|------|----------|
| v0.1 | 点灯程序，验证 GPIO48 |
| v0.2 | WiFi 联网 + NTP 校时 + 定时 HTTP 上报（数据全模拟） |
| v0.2.1 | 修复 SSID 逐字节匹配（原因码 201）、修复 `WiFi.begin` 与 `setAutoReconnect` 冲突 |
| v0.3 | I2C 总线解锁、BH1750 光照真实读数、`scan` / `pins` 串口诊断命令 |
| **v0.4.0** | 电容式土壤湿度（GPIO2 ADC）替代模拟值 + 两点标定（存 NVS）+ 未接线自动回退 |

**设计思路**：先把「设备 → 后台」链路彻底打通，传感器到货后只替换 `readSensors()` 一个函数，
联网/上报/后端全都不用改 —— 这就是「先通路、后接传感器」。

---

## 12. 已知问题与待办

以下是当前源码中**已确认存在**的问题，按影响程度排序。

### 12.1 SHT30 未接入主循环（功能缺失）

- `sht30Init()`（`main.cpp:337`）和 `sht30AutoRetry()`（`main.cpp:349`）**从未被调用**：
  `setup()` 里只调了 `soilInit()` 和 `bh1750Init()`，`loop()` 里只调了 `bh1750AutoRetry()`（`main.cpp:923`）。
- 结果：`sht30Ready` 永远是 `false`，`readSHT30()` 恒返回失败。

### 12.2 readSensors 存在编译级错误（阻塞项）

`main.cpp:527` 的形参是 `airtemp` / `airhum`（全小写），而函数体 `main.cpp:577-581` 用的是
`airTemp` / `airHum`（驼峰）→ 未声明标识符，**当前源码无法编译通过**。

### 12.3 上报字段与函数签名不匹配

`readSensors()` 声明了 5 个参数，但 `loop()` 里只传了 3 个（`main.cpp:929-930`），
`postReading()` 也只有 3 个参数（`main.cpp:591`）→ 空气温湿度即便读到也进不了报文。
配套地，`-100.0f` 这个「读不到」哨兵从未被转换成 JSON 的 `null`，`air_temp` / `air_hum` 字段根本不存在。

### 12.4 后端接口缺失

`/api/devices/{DEVICE_CODE}/readings` 在 `backend/app` 中**零命中**（`api/router.py` 注册的 22 个
router 里没有任何设备/传感器路由）。固件上报必然 404。

### 12.5 失败判定的语义缺陷

`postReading()` 里只要 `code > 0` 就打印「上报成功」并 `++reportCount`（`main.cpp:623`），
所以 **404 也会被打印成成功**；而 `loop()` 又按 `code != 200 && code != 201` 判失败闪灯。
两处口径不一致，容易误导排障。建议统一为「2xx 才算成功」。

### 12.6 版本号注释未同步

文件头注释仍是 `v0.2.1`（`main.cpp:2`），宏已是 `0.4.0`（`main.cpp:31`）。

### 12.7 源码晚于最后一次成功编译

`.pio/build/flower_guardian/firmware.bin` 的时间戳是 **2026-11-04 18:09**，
而 `src/main.cpp` 是 **2026-11-12 15:35** —— 也就是说 SHT30 那段代码加入后**还没有成功编译过**。
使用前请先 `pio run` 确认能过。

### 12.8 待办清单

- [ ] 修复 `12.2` 的编译错误，把 `airTemp` / `airHum` 打通到 `postReading()` 与 JSON
- [ ] `setup()` 里调用 `sht30Init()`，`loop()` 里调用 `sht30AutoRetry()`
- [ ] 实现后端 `/api/devices/{code}/readings`（建表 + 路由 + 注册）
- [ ] DS18B20 土壤温度接入（GPIO8，4.7kΩ 上拉）
- [ ] OLED SSD1306 本地显示驱动
- [ ] 统一上报成功判定口径

---

## 13. 排障速查表

### 13.1 烧录

| 现象 | 原因 / 处理 |
|------|-------------|
| `Failed to connect ... No serial data received` | **插错 Type-C 口**，换成标「COM」的那个 |
| `Could not open COM5, port is busy` | 串口被占用：关掉 PIO 监视器 / Arduino IDE / 厂家刷机工具 |
| 一直打印 `Connecting.....` | 手动进下载模式：按住 **BOOT** → 点一下 **RST** → 松开 BOOT |
| COM 口是灰的 / `Present: False` | 幽灵设备：重新插拔，数据线接板子右侧标 COM 的口 |
| `pio run` 卡在 `Downloading 0%` | 平台服务器对国内 IP 返回 403，走 [离线环境搭建](docs/离线环境搭建.md) |

### 13.2 联网

| 现象 | 原因 / 处理 |
|------|-------------|
| 原因码 **201** 找不到 AP | SSID 不匹配：Windows 显示名可能带后缀，改用纯英文 SSID |
| 原因码 **15** / **202** / **204** | 密码错误（握手/认证失败） |
| 原因码 **5** 关联设备过多 | 热点连接数已满，断开其他设备 |
| 连上了但上报失败 | `SERVER_HOST` 不是电脑当前 IP；或电脑防火墙未放行端口；或热点开了 AP 隔离 |
| 重启热点后失联 | 网段漂移（43.x ↔ 50.x），改 `SERVER_HOST` 并**重新烧录** |

### 13.3 传感器

| 现象 | 原因 / 处理 |
|------|-------------|
| `scan` 一个设备都没有 | 查供电（万用表量模块 VCC-GND 应约 3.3V）、SDA/SCL 是否接反、杜邦线是否断芯 |
| `pins` 报「SDA 跟着 SCL 变了」 | 两根线插在面包板**同一列**（a~e 内部导通），挪开至少一列 |
| `pins` 报「没有外部上拉」 | 模块没上电，或四根线没真正连到板子 |
| 光照一直 `null` | BH1750 未接 / 地址不对 / 总线卡死。固件每 10 秒自动重探，接好即恢复 |
| 土壤湿度显示「模拟」 | ADC 信号持续不稳（未接线或线松），接好后自动切回真实值 |
| 土壤湿度数值反了 | `cal air` / `cal water` 标定顺序搞反，重新标定 |
| 土温永远是 22℃ 左右 | 正常 —— DS18B20 尚未实现，当前是模拟值 |

---

## 14. 工具脚本

`tools/` 下分两类脚本，均需 Python 3 + `pyserial`（串口类）。

### 14.1 环境搭建（仅国内离线场景，按序执行）

```bash
python tools/install_toolchain.py   # 1. 从 dl.espressif.cn 下载 6 个真实工具链包
python tools/install_extra.py       # 2. 补装 esptool 与 esp-rom-elfs
python tools/fix_piopm.py           # 3. 补 .piopm 清单（关键，否则 PIO 仍会联网）
python tools/make_stubs.py          # 4. 给用不到的 13 个包造占位壳，阻止联网
python tools/fix_libs.py            # 5. 重构 esp32s3-libs 目录 + 生成芯片构建脚本
python tools/patch_core.py          # 6. 补 ARDUINO_BOARD / ARDUINO_VARIANT 板级宏
```

> ⚠️ 这几个脚本里写死了 Windows 路径（`D:/esp32dl/downloads`、`C:/Users/...`），换机器要先改。

### 14.2 串口调试

| 脚本 | 用法 | 作用 |
|------|------|------|
| `serial_monitor.py` | `python tools/serial_monitor.py COM7 30` | 监听串口日志，默认 20 秒；不带参数则列出可用串口 |
| `send_command.py` | `python tools/send_command.py COM7 "scan 8 9"` | 发一条调试命令并回显；参数：端口 / 命令 / 回显秒 / 开机等待秒 |
| `reset_and_read.py` | `python tools/reset_and_read.py COM7 25` | 通过 DTR/RTS 硬复位后抓完整开机日志 |
| `find_i2c_pins.py` | `python tools/find_i2c_pins.py COM7` | 遍历 32 组候选引脚自动找 BH1750 接在哪组 I2C 上 |

> 提示：`pyserial` 打开串口时 DTR/RTS 变化会触发板子复位，所以开机等待要留够
> （WiFi + NTP 约 8~12 秒），否则会漏掉自检日志。

---

## 15. 相关文档

- [离线开发环境搭建](docs/离线环境搭建.md) —— 国内镜像手工组装工具链、双 Type-C 口详解
- [项目主 README](../README.md) —— 整体架构、后端 API、移动端
- [技术规划文档](../docs/plans/) —— 各功能的设计与实施记录

---

*文档最后更新：2026-11-13*
