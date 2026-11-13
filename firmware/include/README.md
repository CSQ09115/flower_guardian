# include/ — 固件全局头文件

本目录只放**头文件**，所有 `#define` 常量集中在这里，改配置不用翻 `main.cpp`。

| 文件 | 作用 | 是否入库 |
|------|------|----------|
| `board_pins.h` | 硬件引脚地图：LED、按键、I2C、ADC、I2S 的 GPIO 编号与器件 I2C 地址 | ✅ 提交 |
| `wifi_config.h.example` | 私有配置模板：WiFi 名称/密码、后端地址、设备编号 | ✅ 提交 |
| `wifi_config.h` | 从上面模板复制而来，填入本机真实配置 | ❌ 已 gitignore |

## 首次使用

```bash
cp wifi_config.h.example wifi_config.h   # 然后编辑填入自己的 WiFi 与电脑 IP
```

## 改引脚先看这里

接线前先查 `board_pins.h`，**不要凭记忆猜引脚**。该文件数值来自商家资料包中小智 AI 源码的 `config.h`。

特别注意：**ESP32 的 ADC2（GPIO11~20）在开启 WiFi 后不可用**，读出来全是乱值。
模拟传感器必须接在 ADC1（GPIO1~10）上，本项目土壤湿度用的就是 GPIO2。

完整的接线表、传感器说明与排障方法见上级文档 [../README.md](../README.md)。
