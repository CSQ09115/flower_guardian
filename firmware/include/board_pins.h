/**
 * 护花使者 - 硬件引脚地图 (board_pins.h)
 * =====================================
 * 来源：商家资料包《面包板版本（小智ai）》中小智源码
 *       main/boards/bread-compact-wifi/config.h
 *
 * 这份文件就是整块板子的"电路图目录"。
 * 以后每次接线 / 写驱动，先来这里查引脚号，不要凭记忆猜。
 * 学生分工时，每个人负责的模块引脚也可以从这里分配。
 */
#pragma once

// ============ 板载器件 ============
#define PIN_BUILTIN_LED     48   // 板载 LED（已在 v0.1 点灯程序中验证）
#define PIN_BOOT_BUTTON     0   // BOOT 按键（烧录时按住它进下载模式）
#define PIN_TOUCH_BUTTON   47   // 触摸按键（套件轻触开关可接这里）
#define PIN_VOL_UP         40   // 音量+ （可自定义用作其他功能）
#define PIN_VOL_DOWN       39   // 音量- （可自定义用作其他功能）

// ============ 音频输入：INMP441 麦克风 (I2S) ============
#define PIN_MIC_WS          4   // WS  (Word Select 字选择)
#define PIN_MIC_SCK         5   // SCK (时钟)
#define PIN_MIC_SD          6   // SD  (数据输出 DIN)

// ============ 音频输出：MAX98357 功放 (I2S) → 接喇叭 ============
#define PIN_SPK_DOUT        7   // DIN (数据输入)
#define PIN_SPK_BCLK       15   // BCLK (位时钟)
#define PIN_SPK_LRCLK      16   // LRC  (左右声道时钟)

// ============ 显示：0.91寸 OLED (I2C, SSD1306) ============
#define PIN_OLED_SDA       41   // I2C 数据线
#define PIN_OLED_SCL       42   // I2C 时钟线

// ============ 光照传感器：BH1750 (I2C) ============
// I2C 是"总线"，一条线上可以挂多个设备，靠各自的地址区分。
// BH1750 和 OLED 共用 GPIO41/42 这一组 I2C，不额外占用引脚。
//    OLED   地址 = 0x3C
//    BH1750 地址 = 0x23（当 ADDR 引脚接地；若 ADDR 接 3.3V 则变成 0x5C）
// 两个地址不同，所以同总线不会打架。
#define PIN_I2C_SDA         PIN_OLED_SDA   // 与 OLED 共用，都是 GPIO41
#define PIN_I2C_SCL         PIN_OLED_SCL   // 与 OLED 共用，都是 GPIO42
#define BH1750_I2C_ADDR     0x23           // ADDR 接地时的地址（最常用）
#define BH1750_I2C_ADDR_ALT 0x5C           // ADDR 接高电平时的地址（固件会自动探测，不用手改）

// BH1750 常用命令（详见数据手册）
#define BH1750_CMD_POWER_ON       0x01  // 上电，等待测量指令
#define BH1750_CMD_RESET          0x07  // 重置数据寄存器（上电后建议发一次）
#define BH1750_CMD_CONT_H_RES     0x10  // 连续测量·高分辨率（1 lux，每次约 120ms）
#define BH1750_CMD_ONE_H_RES      0x20  // 单次测量·高分辨率（测完自动休眠，省电）

// ============ 预留：传感器将使用的引脚 ============
// 土壤湿度传感器（电容式，模拟输出 ADC）: 建议接 GPIO1~GPIO10 之一
//   注意 ESP32-S3 的 ADC1 是 GPIO1~10，ADC2 在开 WiFi 时不能用！
// DS18B20 土壤温度（单总线）: 建议接 GPIO8 或 GPIO9（空闲通用脚）
//   需要 4.7kΩ 上拉电阻接到 3.3V
#define PIN_SOIL_MOISTURE   2   // 土壤湿度 ADC 输入（计划, GPIO2 属 ADC1）
#define PIN_SOIL_TEMP       8   // DS18B20 数据脚（计划, 需 4.7k 上拉）
// ============ 空气温湿度传感器：SHT30 (I2C) ============
// 与 BH1750 共用 GPIO41/42 总线，靠不同地址区分：
// SHT30 = 0x44（ADDR 接地/悬空）或 0x45（ADDR 接高电平）
#define SHT30_I2C_ADDR      0x44
#define SHT30_I2C_ADDR_ALT  0x45
