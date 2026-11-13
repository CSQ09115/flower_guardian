/**
 * 护花使者 固件 v0.2.1 —— 连 WiFi + 上报数据到后台
 * =================================================
 * 相比 v0.1 新增的能力：
 *   1. 连接 WiFi（带超时重试，失败自动重连）
 *   2. 从网络获取标准时间（NTP）—— 上报的数据要有准确时间戳才有意义
 *   3. 定时用 HTTP POST 把传感器数据发给后台（这一版先发模拟数据）
 *   4. 用 LED 的闪烁节奏表达状态：快闪=连网中，慢闪=正常，急闪=上报失败
 *
 * v0.2.1 修复（本次实战踩到的两个坑，都很有教学价值）：
 *   [坑1] SSID 必须逐字节完全匹配。Windows 显示的网络名可能比实际广播的 SSID
 *         多出后缀（本项目就多了个 " 5"），导致"扫描看得见却连不上"（原因码 201）。
 *   [坑2] 不能反复调用 WiFi.begin() 又同时开启 setAutoReconnect(true)，
 *         两者冲突会报 "STA clear config failed / ESP_ERR_WIFI_STATE"。
 *         正确做法：手动管理重连，每次重连前先 WiFi.disconnect(true)。
 *
 * 这一版的核心目标：把"设备 → 后台"这条链路**彻底打通**。
 * 数据先用模拟值，等传感器到货后，只要替换 readSensors() 一个函数即可，
 * 其他（联网、上报、后台）全部不用改 —— 这就是"先通路、后接传感器"的好处。
 */
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>      // I2C 通信库（Arduino 自带，不需要额外安装）—— BH1750 用它
#include <Preferences.h>  // 把标定数据存进 Flash（NVS），断电也不丢
#include <time.h>

#include "board_pins.h"
#include "wifi_config.h"

#define FIRMWARE_VERSION "0.4.0"   // v0.4.0：电容式土壤湿度传感器（GPIO2 ADC）替代模拟值

// LED 引脚统一从"硬件地图" board_pins.h 取，不要在各文件里各写各的
#define LED_PIN PIN_BUILTIN_LED

// ---------------------------------------------------------------- 状态变量
bool wifiConnected = false;
unsigned long lastReportTime = 0;   // 上次上报的时间戳（毫秒）
unsigned long reportCount = 0;      // 已上报条数
unsigned long failCount = 0;        // 失败条数
volatile uint8_t lastDisconnectReason = 0;  // 最近一次断开的原因码（事件回调里写入）

// ---------------------------------------------------------------- WiFi 事件
/** 把 WiFi 断开原因码翻译成人话（常见几种，其余显示原始码） */
String reasonStr(uint8_t r) {
  switch (r) {
    case 2:   return "认证过期(密码错?)";
    case 4:   return "关联超时";
    case 5:   return "关联设备过多(热点连接数满)";
    case 15:  return "四次握手超时(密码错!)";
    case 201: return "找不到该AP(SSID不匹配!)";
    case 202: return "认证失败(密码错!)";
    case 204: return "握手超时(密码错!)";
    default:  return "原因码" + String(r);
  }
}

/**
 * WiFi 事件回调 —— 底层状态变化都会触发，是排查联网问题的"黑匣子"。
 * 保留在正式固件里：设备部署到现场后，连不上网时能第一时间定位原因。
 */
void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("  [WiFi] 已连上 AP，正在申请 IP...");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.printf("  [WiFi] 拿到 IP：%s\n", WiFi.localIP().toString().c_str());
      break;
    case ARDUINO_EVENT_WIFI_STA_LOST_IP:
      Serial.println("  [WiFi] ⚠ IP 丢失");
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      lastDisconnectReason = info.wifi_sta_disconnected.reason;
      Serial.printf("  [WiFi] 断开！%s\n", reasonStr(lastDisconnectReason).c_str());
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- 工具函数
/** 获取格式化后的本地时间字符串（NTP 校准后才准确） */
String currentTimeStr() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 100)) {
    return "时间未同步";
  }
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buf);
}

/**
 * 连接 WiFi，最多等 timeoutMs 毫秒；返回是否成功
 *
 * 关键细节（v0.2.1 修复）：
 *   重连前必须先 disconnect，否则上一次还没结束的连接过程会导致
 *   "STA clear config failed"，表现就是永远连不上。
 */
bool connectWiFi(unsigned long timeoutMs = 20000) {
  WiFi.disconnect(true);   // 先彻底断开，清理上一次的连接状态
  delay(300);

  Serial.printf("正在连接 WiFi：%s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);                 // 工作站模式（连路由器），不是热点模式
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));  // 连接过程中 LED 快闪
    delay(250);
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi 连接成功！");
    Serial.printf("  IP 地址    : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("  网关       : %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("  MAC 地址   : %s\n", WiFi.macAddress().c_str());
    Serial.printf("  信号强度   : %d dBm", WiFi.RSSI());
    Serial.println(WiFi.RSSI() > -60 ? "（信号很好）" : (WiFi.RSSI() > -75 ? "（信号一般）" : "（信号偏弱）"));
    return true;
  }

  Serial.printf("WiFi 连接失败 —— %s，15 秒后重试\n",
                reasonStr(lastDisconnectReason).c_str());
  return false;
}

/** 从 NTP 服务器获取时间。用阿里云的服务器，国内更快 */
void syncTime() {
  Serial.print("正在同步网络时间... ");
  // 参数：时区偏移（东八区 = 8*3600 秒）、夏令时偏移、NTP 服务器
  configTime(8 * 3600, 0, "ntp.aliyun.com", "ntp1.aliyun.com", "pool.ntp.org");
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 10000)) {
    Serial.println("成功：" + currentTimeStr());
  } else {
    Serial.println("失败（不影响上报，但数据时间戳会用芯片运行时间）");
  }
}

// ---------------------------------------------------------------- BH1750 光照传感器
/**
 * BH1750 —— 数字光照强度传感器，直接通过 I2C 读出勒克斯(lux)。
 *
 * 为什么不用库？BH1750 的协议非常简单（发一个命令、读两个字节），
 * 十几行代码就能驱动，少一个第三方库就少一个"装不上/版本不对"的坑，
 * 比赛现场也更好讲清楚原理。
 *
 * 接线（与 OLED 共用 I2C 总线）：
 *   VCC → 3.3V    GND → GND
 *   SDA → GPIO41  SCL → GPIO42
 *   ADDR → GND（地址就是 0x23；若接 3.3V 地址变 0x5C，代码里的 BH1750_I2C_ADDR 要改）
 *
 * 量程参考：室内 100~500 lux，阴天户外 1000~5000，晴天正午 30000+。
 */
bool bh1750Ready = false;      // 传感器是否在线
uint8_t bh1750Addr = BH1750_I2C_ADDR;  // 实际探测到的地址（0x23 或 0x5C）
uint8_t lightFailCount = 0;    // 光照连续读取失败次数（用于触发自动重探）
#define LIGHT_FAIL_RESET 5     // 连续失败这么多次就判定掉线，转入自动重探

/**
 * I2C 总线解锁 —— 处理"总线卡死"。
 *
 * 【什么是总线卡死】I2C 通信进行到一半时如果线被碰到（接触不良），
 * 从机可能停在"正在发送数据"的状态，死死拉住 SDA 不放。
 * 之后主机发任何地址它都不应答，看起来像传感器坏了，其实只有复位才治得好。
 *
 * 【解锁原理】把引脚临时切换成普通 GPIO，手动产生 9 个时钟脉冲
 * （I2C 协议规定一帧最多 9 个时钟，打满 9 个从机必然交还 SDA），
 * 再补一个"停止信号"，从机就回到空闲状态了。
 */
void i2cBusRecovery() {
  Wire.end();   // 先释放 I2C 外设，把引脚控制权还给我们
  pinMode(PIN_I2C_SCL, OUTPUT_OPEN_DRAIN);
  pinMode(PIN_I2C_SDA, OUTPUT_OPEN_DRAIN);
  digitalWrite(PIN_I2C_SCL, HIGH);
  digitalWrite(PIN_I2C_SDA, HIGH);
  delayMicroseconds(10);
  for (int i = 0; i < 9; i++) {
    digitalWrite(PIN_I2C_SCL, LOW);
    delayMicroseconds(10);
    digitalWrite(PIN_I2C_SCL, HIGH);
    delayMicroseconds(10);
  }
  // 补一个 STOP 信号：SCL 高电平期间 SDA 由低变高
  digitalWrite(PIN_I2C_SDA, LOW);
  delayMicroseconds(10);
  digitalWrite(PIN_I2C_SCL, HIGH);
  delayMicroseconds(5);
  digitalWrite(PIN_I2C_SDA, HIGH);
  delayMicroseconds(10);
}

/** 在总线上探测 BH1750（两个候选地址挨个问），返回找到的地址，找不到返回 0 */
uint8_t bh1750Probe() {
  const uint8_t candidates[] = {BH1750_I2C_ADDR, BH1750_I2C_ADDR_ALT};
  for (uint8_t i = 0; i < 2; i++) {
    Wire.beginTransmission(candidates[i]);
    if (Wire.endTransmission() == 0) return candidates[i];   // 0 = 有应答
  }
  return 0;
}

/**
 * 初始化 BH1750。返回 true 表示在 I2C 总线上找到了它。
 *
 * 【为什么自动探测两个地址】
 * BH1750 的地址由 ADDR 引脚决定：接地 = 0x23，接 3.3V = 0x5C。
 * 同学接线时 ADDR 经常是空着的（悬空），此时电平不确定，地址到底是哪个说不准。
 * 与其让人去改代码，不如两个地址都试一遍，哪个应答就用哪个。
 * 这也是 I2C 的常用调试技巧：扫描总线，看哪些地址有设备。
 */
bool bh1750Init(bool quiet = false) {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);   // 以主机身份加入 I2C 总线

  uint8_t found = bh1750Probe();

  if (found == 0) {
    // 第一轮没找到 —— 总线可能卡死了，先解锁再试一次（见 i2cBusRecovery 注释）
    i2cBusRecovery();
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    found = bh1750Probe();
  }

  if (found == 0) {
    if (!quiet) {
      Serial.println("BH1750 光照传感器 : 未检测到（0x23 / 0x5C 均无应答）");
      Serial.println("   → 检查接线：VCC→3.3V  GND→GND  SDA→41  SCL→42");
      Serial.println("   → 光照将上报为 null，其余功能不受影响");
    }
    return false;
  }

  bh1750Addr = found;

  // 上电 → 复位 → 进入连续高分辨率测量模式
  Wire.beginTransmission(bh1750Addr);
  Wire.write(BH1750_CMD_POWER_ON);
  Wire.endTransmission();

  Wire.beginTransmission(bh1750Addr);
  Wire.write(BH1750_CMD_RESET);
  Wire.endTransmission();

  Wire.beginTransmission(bh1750Addr);
  Wire.write(BH1750_CMD_CONT_H_RES);   // 连续测量，之后随时可读最新值
  Wire.endTransmission();

  delay(150);   // 高分辨率模式第一次测量需要约 120ms，多留点余量

  // 丢弃重启后的第一帧：芯片刚进入测量模式时数据寄存器里可能是
  // 上电残留值（实测会出现 5 万+ lux 的离谱数），读一次扔掉，下一帧才可靠
  uint16_t dummy;
  (void)dummy;
  Wire.requestFrom(bh1750Addr, 2);
  while (Wire.available()) Wire.read();

  if (!quiet) {
    Serial.printf("BH1750 光照传感器 : 已就绪，I2C 地址 0x%02X%s\n",
                  bh1750Addr,
                  bh1750Addr == BH1750_I2C_ADDR ? "（ADDR 接地）" : "（ADDR 接高电平）");
  }
  return true;
}

/**
 * 运行中自动重试：传感器没找到时，每隔一段时间再探测一次。
 *
 * 这样做的好处：同学把传感器接上之后，不用按 RST、不用重新烧录，
 * 板子自己就会在几十秒内发现它并开始上报数据。
 * 反过来，传感器中途被拔掉，也会自动停止上报而不是卡死。
 */
void bh1750AutoRetry() {
  if (bh1750Ready) return;
  static unsigned long lastTry = 0;
  if (millis() - lastTry < 10000) return;   // 每 10 秒试一次
  lastTry = millis();

  if (bh1750Init(true)) {                   // quiet=true：重试阶段不打日志
    bh1750Ready = true;
    Serial.printf("[自动重试] 发现 BH1750，地址 0x%02X，开始上报光照\n", bh1750Addr);
  }
}

/**
 * 读一次光照值，单位 lux。返回 false 表示读取失败。
 * 换算公式：lux = 原始16位数据 / 1.2 （数据手册规定，高分辨率模式下的固定系数）
 */
bool readLight(float &lux) {
  if (!bh1750Ready) return false;

  Wire.requestFrom(bh1750Addr, 2);   // 要 2 个字节
  if (Wire.available() != 2) return false; // 没凑够 2 字节 = 这一帧坏了

  uint16_t raw = (Wire.read() << 8) | Wire.read();   // 高字节在前
  lux = raw / 1.2f;
  return true;
}
// ---------------------------------------------------------------- SHT30 温湿度传感器
/**
 * SHT30 —— 工业级空气温湿度二合一，I2C 通信。
 * 和 BH1750 的区别：BH1750 发一条命令就进"连续测量"，随时可读；
 * SHT30 是"一次一测"：每次要先发测量命令 → 等 15ms → 读 6 字节。
 * 6 字节 = 温度2字节 + 温度CRC + 湿度2字节 + 湿度CRC。
 * CRC 是工业协议的标配：验证数据在传输中没出错，比"直接信"严谨。
 */
bool sht30Ready = false;
uint8_t sht30Addr = SHT30_I2C_ADDR;
uint8_t sht30FailCount = 0;
#define SHT30_FAIL_RESET 5

/** CRC-8 校验（SHT30 数据手册规定：多项式 0x31，初值 0xFF） */
uint8_t sht30CRC(const uint8_t *data, uint8_t len) {
  uint8_t crc = 0xFF;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t b = 0; b < 8; b++)
      crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x31) : (uint8_t)(crc << 1);
  }
  return crc;
}

/** 探测 SHT30（0x44 / 0x45 两个地址挨个问，和 BH1750 一个套路） */
uint8_t sht30Probe() {
  const uint8_t candidates[] = {SHT30_I2C_ADDR, SHT30_I2C_ADDR_ALT};
  for (uint8_t i = 0; i < 2; i++) {
    Wire.beginTransmission(candidates[i]);
    if (Wire.endTransmission() == 0) return candidates[i];
  }
  return 0;
}

bool sht30Init(bool quiet = false) {
  uint8_t found = sht30Probe();
  if (found == 0) {
    if (!quiet) Serial.println("SHT30 温湿度传感器 : 未检测到（0x44 / 0x45 均无应答）");
    return false;
  }
  sht30Addr = found;
  if (!quiet) Serial.printf("SHT30 温湿度传感器 : 已就绪，I2C 地址 0x%02X\n", sht30Addr);
  return true;
}

/** 热插拔自动重试（和 bh1750AutoRetry 相同的节奏：每 10 秒一次） */
void sht30AutoRetry() {
  if (sht30Ready) return;
  static unsigned long lastTry = 0;
  if (millis() - lastTry < 10000) return;
  lastTry = millis();
  if (sht30Init(true)) {
    sht30Ready = true;
    Serial.printf("[自动重试] 发现 SHT30，地址 0x%02X，开始上报温湿度\n", sht30Addr);
  }
}

/**
 * 读一次温湿度。返回 false 表示读取失败（没接/CRC 错/总线卡）。
 * 换算公式（数据手册规定）：
 *   温度℃ = -45 + 175 × 原始值 / 65535
 *   湿度%  = 100 × 原始值 / 65535
 */
bool readSHT30(float &tempC, float &humPct) {
  if (!sht30Ready) return false;

  // 1. 发测量命令 0x2C06（单次测量·高精度）
  Wire.beginTransmission(sht30Addr);
  Wire.write(0x2C);
  Wire.write(0x06);
  if (Wire.endTransmission() != 0) return false;

  // 2. 等测量完成：手册说最长 15ms，留余量
  delay(20);

  // 3. 读 6 字节：温MSB 温LSB 温CRC 湿MSB 湿LSB 湿CRC
  if (Wire.requestFrom(sht30Addr, 6) != 6) return false;
  uint8_t buf[6];
  for (int i = 0; i < 6; i++) buf[i] = Wire.read();

  // 4. CRC 校验：两段数据各查各的，谁错了都不采用
  if (sht30CRC(buf, 2) != buf[2]) return false;
  if (sht30CRC(buf + 3, 2) != buf[5]) return false;

  // 5. 换算
  uint16_t rawT = (buf[0] << 8) | buf[1];
  uint16_t rawH = (buf[3] << 8) | buf[4];
  tempC = -45.0f + 175.0f * rawT / 65535.0f;
  humPct = 100.0f * rawH / 65535.0f;
  return true;
}


// ---------------------------------------------------------------- 电容式土壤湿度传感器
/**
 * 电容式土壤湿度传感器（套件里那块蓝色/黑色的长条板，v1.2 版最常见）
 *
 * 【它和电阻式的区别——为什么比赛要用电容式】
 *   电阻式：两根裸露的金属脚插进土里，量两脚之间的电阻。
 *           土里含水和离子就导电，电阻变小。缺点：金属脚会电解腐蚀，
 *           几周就锈穿了，数据漂移。
 *   电容式：探针外面盖着绝缘层，测的是探针与土壤之间的"电容量"。
 *           水的介电常数（80）远大于空气（1）和干土（约4），
 *           含水越多电容越大，输出电压越低。探针不接触土壤本身，
 *           几乎不腐蚀，长期稳定 —— 这就是它贵一点但值得的原因。
 *
 * 【输出是模拟电压，不是数字量】
 *   模块的 AOUT 引脚输出 0~3.3V 之间的连续电压，要接 ESP32 的 ADC 引脚。
 *   接线：VCC → 3.3V    GND → GND    AOUT → GPIO2
 *   注意：必须用 ADC1 的引脚（GPIO1~10）！
 *   ESP32 的 ADC2（GPIO11~20）在 WiFi 开启时会被系统占用，读出来全是乱值，
 *   这是无数人踩过的经典大坑，我们直接用 GPIO2（ADC1）避开它。
 *
 * 【为什么要"两点标定"】
 *   同一块板子，插在干土里和水杯里读数差很多，但每块板子的具体数值
 *   都不一样（元件误差）。所以出厂值只能当参考，真正的做法是：
 *     ① 把探针放在空气里 → 串口输 cal air   → 记下"完全干燥"的原始值
 *     ② 把探针插进水杯里 → 串口输 cal water → 记下"完全饱和"的原始值
 *   两个点定下来之后，中间的任意原始值就能线性换算成 0~100% 的湿度。
 *   标定值存在 Flash（NVS）里，断电重启也不会丢，不用每次重标。
 *
 * 【怎么知道传感器没接】
 *   ADC 引脚悬空时读数会乱跳（受静电和邻居引脚干扰），
 *   真传感器插在稳定环境里读数几乎不动。
 *   所以我们一次采 10 个样本算最大最小值：跳动太大 → 判定"没接线"，
 *   自动回退到模拟数据，保证三端界面不会出现诡异的乱跳数值。
 *   传感器接好线之后 10 秒内会自动恢复真实数据，不用重启。
 */

#define SOIL_ADC_SAMPLES  10    // 每次读数采 10 个样本取平均，滤掉毛刺
#define SOIL_AIR_DEFAULT  3200  // 出厂默认：空气(全干)原始值，标定后会覆盖
#define SOIL_WATER_DEFAULT 1300 // 出厂默认：水中(全湿)原始值
#define SOIL_NOISE_LIMIT  300   // 10 个样本里最大最小差超过它 → 判定引脚悬空

int soilAirRaw = SOIL_AIR_DEFAULT;     // "全干"标定值（ADC 原始读数，0~4095）
int soilWaterRaw = SOIL_WATER_DEFAULT; // "全湿"标定值
int soilFailCount = 0;                 // 连续判定"信号不稳"的次数
#define SOIL_FAIL_RESET 5              // 连续不稳这么多次 → 判定没接线，回退模拟值
bool soilSimulated = true;             // 当前湿度是真实值(false)还是模拟值(true)
Preferences soilPrefs;                 // 标定值存这里，断电不丢

/**
 * 采一组样本。返回平均值，同时带出最小/最大值（用于判断信号稳不稳）。
 * 为什么不直接 analogRead 一次就用？ADC 单次读数有 ±几十 的毛刺，
 * 传感器数据要上报存库，一次读数抖 2% 湿度，图就画花了。
 */
int readSoilRaw(int &mn, int &mx) {
  mn = 4095; mx = 0;
  uint32_t sum = 0;
  for (int i = 0; i < SOIL_ADC_SAMPLES; i++) {
    int v = analogRead(PIN_SOIL_MOISTURE);
    sum += v;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    delay(3);
  }
  return sum / SOIL_ADC_SAMPLES;
}

/** 从 Flash 读回标定值（第一次开机读到的是出厂默认值） */
void soilLoadCal() {
  // 第一次开机时标定命名空间还不存在，只读打开会报 NOT_FOUND，
  // 所以先用可写模式"摸一下"，把命名空间创建出来，以后就能只读了
  soilPrefs.begin("soil-cal", false);
  soilPrefs.end();
  soilPrefs.begin("soil-cal", true);   // true = 只读打开
  soilAirRaw   = soilPrefs.getInt("air", SOIL_AIR_DEFAULT);
  soilWaterRaw = soilPrefs.getInt("wat", SOIL_WATER_DEFAULT);
  soilPrefs.end();
}

/** 把标定值写进 Flash（NVS），断电重启也不丢 */
void soilSaveCal() {
  soilPrefs.begin("soil-cal", false);  // false = 可写
  soilPrefs.putInt("air", soilAirRaw);
  soilPrefs.putInt("wat", soilWaterRaw);
  soilPrefs.end();
}

/** 把 ADC 原始值线性换算成湿度百分比：干=0%，湿=100%，中间线性插值 */
float soilRawToPercent(int raw) {
  if (soilAirRaw <= soilWaterRaw) return 0;  // 防呆：标定反了(不可能)就不乱算
  float p = (float)(soilAirRaw - raw) * 100.0f / (float)(soilAirRaw - soilWaterRaw);
  return constrain(p, 0.0f, 100.0f);
}

void soilInit() {
  analogReadResolution(12);   // 12 位分辨率：读数范围 0~4095
  analogRead(PIN_SOIL_MOISTURE);   // 先读一次把引脚绑定为 ADC 通道（否则下一行会报错）
  // 11dB 衰减 = 最大量程挡，能测到接近 3.3V 的信号（默认挡到 ~2.2V 就饱和了）
  analogSetPinAttenuation(PIN_SOIL_MOISTURE, ADC_11db);
  soilLoadCal();

  int mn, mx;
  int raw = readSoilRaw(mn, mx);
  Serial.printf("土壤湿度 GPIO%d : 原始值 %d（%d~%d）→ 换算 %.1f%%\n",
                PIN_SOIL_MOISTURE, raw, mn, mx, soilRawToPercent(raw));
  Serial.printf("   标定值：空气=%d  水=%d（串口输 cal air / cal water 可重新标定）\n",
                soilAirRaw, soilWaterRaw);
  if (mx - mn > SOIL_NOISE_LIMIT) {
    Serial.println("   ⚠ 读数跳动很大，疑似未接线（悬空）—— 先按模拟值上报，接好线自动切换");
  }
}

/** 串口命令：实时看 ADC 原始值（标定时就盯着这个数） */
void soilShowRaw() {
  int mn, mx;
  int raw = readSoilRaw(mn, mx);
  Serial.printf("土壤湿度 GPIO%d : 原始值 %d（10次采样 %d~%d，跳动 %d）\n",
                PIN_SOIL_MOISTURE, raw, mn, mx, mx - mn);
  Serial.printf("   换算湿度 %.1f%%   |  标定：空气=%d  水=%d\n",
                soilRawToPercent(raw), soilAirRaw, soilWaterRaw);
  if (mx - mn > SOIL_NOISE_LIMIT) {
    Serial.println("   ⚠ 跳动过大，像是引脚悬空 —— 检查 AOUT 是否接到 GPIO2");
  }
}

/**
 * 读取传感器 —— 土温仍为模拟值（DS18B20 到货后替换），光照/湿度为真实读数
 * 函数签名不变，下面的上报逻辑完全不用动。
 *
 * lightLux 返回 -1 表示"没读到"（传感器没接或这一帧出错），
 * 上报时会写成 null，后端和 App 都能正确处理空值。
 */
void readSensors(float &soilMoisture, float &soilTemp, float &lightLux,float &airtemp,float &airhum) {
  // ---- 土壤湿度：真实 ADC 读数，未接线自动回退模拟值 ----
  int mn, mx;
  int raw = readSoilRaw(mn, mx);
  bool stable = (mx - mn <= SOIL_NOISE_LIMIT) && raw > 50 && raw < 4045;

  if (stable) {
    soilMoisture = soilRawToPercent(raw);
    if (soilSimulated) {
      soilSimulated = false;
      Serial.printf("[土壤] 检测到稳定信号(原始值 %d)，切换为真实湿度数据\n", raw);
    }
    soilFailCount = 0;
  } else {
    // 信号乱跳：要么没接线，要么线松了。连续 5 次都这样才回退，
    // 避免浇水溅到板子上的瞬间误判。
    if (++soilFailCount >= SOIL_FAIL_RESET) {
      if (!soilSimulated) {
        soilSimulated = true;
        Serial.println("[土壤] ADC 信号持续不稳，判定未接线，回退模拟数据（接好线自动恢复）");
      }
      soilFailCount = 0;
      // 模拟"土壤慢慢变干、浇水后又变湿"的过程（和原来 v0.2 一样的波形）
      float t = millis() / 1000.0f;
      soilMoisture = 45.0f + 20.0f * sin(t / 60.0f) + random(-100, 100) / 100.0f;
      if (soilMoisture < 0) soilMoisture = 0;
      if (soilMoisture > 100) soilMoisture = 100;
    }
    // 还没到 5 次：沿用上一次的值，不上报一个明显的坏点
  }

  // ---- 土壤温度：仍是模拟值（DS18B20 到货后在这里替换）----
  float t = millis() / 1000.0f;
  soilTemp = 22.0f + 3.0f * sin(t / 120.0f) + random(-20, 20) / 100.0f;

  // ---- 光照：BH1750 真实读数 ----
  if (readLight(lightLux)) {
    lightFailCount = 0;
  } else {
    lightLux = -1.0f;
    // 连续失败：大概率是线松了，或 I2C 总线卡死。
    // 把 ready 置 false，让 bh1750AutoRetry() 接管 —— 它会先解锁总线再重新初始化，
    // 这样不用按 RST、不用重新烧录，板子自己就能恢复。
    if (++lightFailCount >= LIGHT_FAIL_RESET) {
      bh1750Ready = false;
      lightFailCount = 0;
      Serial.println("[光照] 连续读取失败，转入自动重探（先解锁 I2C 总线）");
    }
  }
    // ---- 空气温湿度：SHT30 真实读数 ----
  if (readSHT30(airTemp, airHum)) {
    sht30FailCount = 0;
  } else {
    airTemp = -100.0f;   // 约定：-100 表示"没读到"，上报时写成 null
    airHum  = -100.0f;
    if (++sht30FailCount >= SHT30_FAIL_RESET) {
      sht30Ready = false;
      sht30FailCount = 0;
      Serial.println("[SHT30] 连续读取失败，转入自动重探");
    }
  }
}

/** 把一条传感器数据 POST 给后台；返回 HTTP 状态码（0 表示请求都没发出去） */
int postReading(float soilMoisture, float soilTemp, float lightLux) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi 未连接，跳过本次上报");
    return 0;
  }

  HTTPClient http;
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT)
             + "/api/devices/" + String(DEVICE_CODE) + "/readings";

  // 光照可能是 null（传感器没接时），先拼成字符串再塞进 JSON，
  // 这样"有值"和"没值"能共用同一段拼接代码
  char lightStr[24];
  if (lightLux >= 0) {
    snprintf(lightStr, sizeof(lightStr), "%.1f", lightLux);
  } else {
    snprintf(lightStr, sizeof(lightStr), "null");
  }

  // 手工拼 JSON（不引入 ArduinoJson 库，减少依赖；字段少时够用）
  char body[320];
  snprintf(body, sizeof(body),
           "{\"soil_moisture\":%.1f,\"soil_temp\":%.1f,\"light_lux\":%s,"
           "\"firmware\":\"%s\",\"ip_address\":\"%s\"}",
           soilMoisture, soilTemp, lightStr, FIRMWARE_VERSION,
           WiFi.localIP().toString().c_str());

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  int code = http.POST(body);
  if (code > 0) {
    String resp = http.getString();
    const char *soilTag = soilSimulated ? "模拟" : "真实";
    Serial.printf("上报成功 [%lu] HTTP %d | 湿度 %.1f%%(%s) 土温 %.1f℃ 光照 %s lux | 返回 %d 字节\n",
                  ++reportCount, code, soilMoisture, soilTag, soilTemp, lightStr, resp.length());
  } else {
    Serial.printf("上报失败 [%lu] 错误码 %d（%s）\n",
                  ++failCount, code, http.errorToString(code).c_str());
    Serial.println("  → 若持续失败，检查：① 电脑防火墙是否放行 8001 端口");
    Serial.println("    ② SERVER_HOST 是否为电脑当前 IP  ③ 手机热点是否开了 AP 隔离");
  }
  http.end();
  return code;
}

// ---------------------------------------------------------------- 主程序
void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  delay(500);   // 给串口一点时间初始化

  Serial.println();
  Serial.println("====================================");
  Serial.printf("  护花使者 固件 v%s 启动\n", FIRMWARE_VERSION);
  Serial.println("====================================");

  // 芯片体检
  Serial.printf("芯片型号 : %s\n", ESP.getChipModel());
  Serial.printf("Flash    : %.0f MB\n", ESP.getFlashChipSize() / 1048576.0);
  Serial.printf("PSRAM    : %.0f MB\n", ESP.getPsramSize() / 1048576.0);
  Serial.printf("CPU 频率 : %u MHz\n", ESP.getCpuFreqMHz());
  Serial.printf("设备编号 : %s\n", DEVICE_CODE);
  Serial.printf("目标服务器: http://%s:%d\n", SERVER_HOST, SERVER_PORT);

  // ---- 传感器体检：启动先扫一遍 I2C 总线，确认 BH1750 在不在 ----
  // 这一步很有用：接错线、地址不对，开机日志立刻就能看出来，不用等到上报才发现
  Serial.println("---- 传感器初始化 ----");
  Serial.printf("I2C 引脚 : SDA=GPIO%d  SCL=GPIO%d\n", PIN_I2C_SDA, PIN_I2C_SCL);
  soilInit();   // 土壤湿度 ADC（未接线也能初始化，接好线 10 秒内自动切换真实数据）
  bh1750Ready = bh1750Init();
  if (bh1750Ready) {
    float lux;
    if (readLight(lux)) {
      Serial.printf("BH1750 光照传感器 : 已就绪，当前 %0.1f lux\n", lux);
    } else {
      Serial.println("BH1750 光照传感器 : 已找到但首帧读取失败");
    }
  } else {
    // 详细原因 bh1750Init() 里已经打印过了，这里只补充"接下来会怎样"
    Serial.println("   → 运行中每 10 秒自动重探一次，接好线后不用按 RST、不用重烧录");
  }
  Serial.println("----------------------");

  WiFi.onEvent(onWiFiEvent);   // 注册事件回调（必须在 WiFi.begin 之前）

  // 1. 连 WiFi
  wifiConnected = connectWiFi();
  if (wifiConnected) {
    syncTime();   // 2. 校时
  }

  Serial.println("------------------------------------");
  Serial.println("开始循环上报数据（每 " + String(REPORT_INTERVAL / 1000) + " 秒一次）");
  Serial.println("调试命令：scan 扫I2C、pins 查引脚、adc 看土壤ADC、cal air/water 标定土壤、help 全部命令");
}

/**
 * I2C 扫描仪 —— 排查传感器接线问题的"万用表"
 * ============================================================
 * 原理：I2C 总线上每个设备都有一个 7 位地址（0x08~0x77）。
 * 主机挨个向这些地址"打招呼"（发送起始信号 + 地址字节），
 * 如果某个地址上有设备，它会把 SDA 拉低作为应答（ACK）。
 * 有应答 = 这个地址挂着设备；没应答 = 这个地址是空的。
 *
 * 这是嵌入式开发里最常用的调试手段：接线怀疑有问题时，先扫一遍总线。
 * 扫描结果能立刻区分三种情况：
 *   1. 一个设备都扫不到      → 供电没接 / SDA、SCL 接错脚 / 线断了
 *   2. 扫到了但地址不是 0x23 → ADDR 引脚电平不对，改地址或改接线
 *   3. 扫到了 0x3C（OLED）却没 0x23 → 总线是通的，只有光照模块有问题
 */
void i2cScan(int sda, int scl) {
  Serial.printf("扫描 I2C 总线  SDA=GPIO%d  SCL=GPIO%d\n", sda, scl);
  Serial.println("（向 0x08~0x77 每个地址发一次请求，看谁应答）");

  Wire.end();              // 先释放总线，才能换引脚重新初始化
  delay(50);
  Wire.begin(sda, scl);    // 以指定引脚加入 I2C 总线
  delay(50);

  int found = 0;
  for (uint8_t addr = 0x08; addr <= 0x77; addr++) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();   // 0 = 有设备应答(ACK)
    if (err == 0) {
      const char *name = "";
      if (addr == 0x23 || addr == 0x5C) name = "  ← BH1750 光照传感器";
      else if (addr == 0x3C || addr == 0x3D) name = "  ← SSD1306 OLED 屏";
      else if (addr == 0x44 || addr == 0x45) name = "  ← SHT30 温湿度";
      else if (addr == 0x68) name = "  ← DS3231 时钟";
      Serial.printf("  地址 0x%02X 有应答%s\n", addr, name);
      found++;
    }
  }

  if (found == 0) {
    Serial.println("  ✗ 总线上一个设备都没有。请检查：");
    Serial.println("     1) 传感器 VCC 是否真的接到了 3.3V（用万用表量模块 VCC-GND 应有 3.3V）");
    Serial.println("     2) SDA / SCL 有没有接反，或者插到了别的 GPIO 上");
    Serial.println("     3) 杜邦线是否松动、断芯");
  } else {
    Serial.printf("  ✓ 共发现 %d 个设备\n", found);
    if (bh1750Addr == 0 || !bh1750Ready) {
      Serial.println("  提示：没看到 0x23/0x5C，说明 BH1750 没挂到这条总线上");
    }
  }

  // 扫描完把总线恢复到正常工作用的引脚
  Wire.end();
  delay(50);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
}

/**
 * 引脚连通性自检 —— 自动判断 SDA / SCL 有没有被短接
 * ============================================================
 * 背景：面包板同一列的 a~e 五个孔内部是导通的。新手把 SDA 和 SCL
 *       插进同一列，两根信号线就等于直接焊在一起，I2C 必然一个设备
 *       都扫不到。这种错误肉眼看照片很难发现，但可以用软件测出来。
 *
 * 方法（环回测试）：
 *   1. 先把两根线都设为带上拉的输入，读空闲电平。I2C 总线空闲时
 *      SDA/SCL 都应该是高电平；若被拉低，说明有短路或接错 GND。
 *   2. 把 SCL 改成输出，SDA 保持输入。让 SCL 先低后高。
 *      如果两根线短接，SCL 的电平会原样传到 SDA，SDA 读数会跟着变。
 *      如果没短接，SDA 被自己的上拉固定在高电平，不跟随。
 *
 * 这个思路是数字电路里最基础的"输出驱动、输入回读"，学生容易理解。
 */
void pinDiagnostic() {
  Wire.end();          // 释放 I2C 外设，改用普通 GPIO 模式
  delay(30);

  // ---- 1. 空闲电平 ----
  pinMode(PIN_I2C_SDA, INPUT_PULLUP);
  pinMode(PIN_I2C_SCL, INPUT_PULLUP);
  delay(10);
  int sdaIdle = digitalRead(PIN_I2C_SDA);
  int sclIdle = digitalRead(PIN_I2C_SCL);
  Serial.printf("空闲电平  SDA(GPIO%d)=%s  SCL(GPIO%d)=%s\n",
                PIN_I2C_SDA, sdaIdle ? "高" : "低",
                PIN_I2C_SCL, sclIdle ? "高" : "低");
  Serial.println("  I2C 总线空闲时两根线都应为高（上拉电阻拉起来的）。");

  // ---- 2. 环回测试 ----
  pinMode(PIN_I2C_SCL, OUTPUT);
  pinMode(PIN_I2C_SDA, INPUT_PULLUP);
  digitalWrite(PIN_I2C_SCL, LOW);
  delay(20);
  int sdaWhenSclLow = digitalRead(PIN_I2C_SDA);
  digitalWrite(PIN_I2C_SCL, HIGH);
  delay(20);
  int sdaWhenSclHigh = digitalRead(PIN_I2C_SDA);
  Serial.printf("环回测试  SCL拉低→SDA=%s   SCL拉高→SDA=%s\n",
                sdaWhenSclLow ? "高" : "低", sdaWhenSclHigh ? "高" : "低");

  if (sdaWhenSclLow == LOW && sdaWhenSclHigh == HIGH) {
    Serial.println("  ✗ SDA 跟着 SCL 变了 —— 两根信号线短接！");
    Serial.println("     最常见原因：SDA 和 SCL 插在面包板【同一列】，a~e 内部导通。");
    Serial.println("     把其中一根挪到相隔至少一列的孔位即可。");
  } else {
    Serial.println("  ✓ SDA 不跟随 SCL，两根信号线没有短接。");
    Serial.println("     若仍扫不到设备，重点查供电：万用表量模块 VCC-GND 应有约 3.3V。");
  }
  if (sdaIdle == LOW || sclIdle == LOW) {
    Serial.println("  ✗ 有信号线空闲时是低电平，可能被接到了 GND 或被外部电路拉低。");
  }

  // ---- 3. 外部上拉检测：判断模块有没有真的挂到总线上 ----
  // 原理：GY-302 模块板上自带 4.7kΩ 上拉电阻，把 SDA/SCL 拉到模块 VCC。
  //       把 ESP32 引脚切成纯输入(高阻)、关掉内部上拉之后：
  //         模块上电且连通 → 外部上拉还在 → 读到高电平
  //         模块没电 / 线悬空 → 引脚完全悬空 → 读到低电平
  //       注意：上一步「空闲电平为高」说明不了问题，因为 ESP32 内部上拉
  //       也会把悬空脚拉高；必须关掉它再读，结论才可信。
  pinMode(PIN_I2C_SDA, INPUT);   // 无内部上拉，纯高阻输入
  pinMode(PIN_I2C_SCL, INPUT);
  delay(20);
  int sdaHigh = 0, sclHigh = 0;
  for (int i = 0; i < 20; i++) {
    sdaHigh += digitalRead(PIN_I2C_SDA);
    sclHigh += digitalRead(PIN_I2C_SCL);
    delay(2);
  }
  Serial.printf("外部上拉检测（关内部上拉，连读20次）  SDA高=%d/20  SCL高=%d/20\n",
                sdaHigh, sclHigh);
  if (sdaHigh >= 15 && sclHigh >= 15) {
    Serial.println("  ✓ 有外部上拉 → 模块已上电，且两根线确实连到了总线上");
    Serial.println("     这种情况下还扫不到设备，怀疑模块损坏或不是 BH1750 芯片。");
  } else {
    Serial.println("  ✗ 没有外部上拉 → 模块没上电，或 VCC/GND/SDA/SCL 没连到板子");
    Serial.println("     重点查：红线接的电源轨有没有 3.3V、黑线 GND 是否与板子 GND 同列。");
  }

  // ---- 4. 恢复 I2C 外设 ----
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  delay(30);
  if (bh1750Ready) bh1750Init(true);   // 重新发一次测量命令，恢复连续测量模式
}

/**
 * 串口命令处理 —— 在串口监视器里输入命令就能现场调试，不用重新烧录
 * 目前支持：
 *   scan          扫描默认 I2C 引脚(41/42)
 *   scan 41 42    扫描指定的 SDA/SCL 引脚
 *   pins          引脚连通性自检（查短接 / 查空闲电平）
 *   help          显示帮助
 */
void handleSerialCommands() {
  static String line = "";
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      line.trim();
      if (line.length() > 0) {
        if (line == "scan") {
          i2cScan(PIN_I2C_SDA, PIN_I2C_SCL);
        } else if (line.startsWith("scan ")) {
          // 解析 "scan <sda> <scl>"
          int sp = line.indexOf(' ', 5);
          if (sp > 0) {
            int sda = line.substring(5, sp).toInt();
            int scl = line.substring(sp + 1).toInt();
            if (sda > 0 && scl > 0) i2cScan(sda, scl);
            else Serial.println("用法：scan <SDA引脚> <SCL引脚>，例如 scan 8 9");
          } else {
            Serial.println("用法：scan <SDA引脚> <SCL引脚>，例如 scan 8 9");
          }
        } else if (line == "pins") {
          pinDiagnostic();
        } else if (line == "adc") {
          soilShowRaw();   // 实时看土壤湿度 ADC 原始值（标定前先看这个）
        } else if (line == "cal air") {
          // 标定"全干"：把探针放在空气里（不要碰任何东西），输这条命令
          int mn, mx;
          soilAirRaw = readSoilRaw(mn, mx);
          soilSaveCal();
          Serial.printf("✓ 已标定[空气/全干] = %d，并写入 Flash 断电不丢\n", soilAirRaw);
        } else if (line == "cal water") {
          // 标定"全湿"：把探针插进一杯水里（只没过探针，别淹到电路板！）
          int mn, mx;
          soilWaterRaw = readSoilRaw(mn, mx);
          soilSaveCal();
          Serial.printf("✓ 已标定[水/全湿] = %d，并写入 Flash 断电不丢\n", soilWaterRaw);
        } else if (line == "cal show") {
          Serial.printf("当前标定：空气(全干)=%d  水(全湿)=%d  → 存在 Flash(NVS)\n",
                        soilAirRaw, soilWaterRaw);
        } else if (line == "help") {
          Serial.println("可用命令：");
          Serial.println("  scan / scan <sda> <scl>   扫描 I2C 总线设备");
          Serial.println("  pins                      I2C 引脚连通性自检");
          Serial.println("  adc                       看土壤湿度 ADC 原始值");
          Serial.println("  cal air                   标定土壤[全干]点（探针放空气里）");
          Serial.println("  cal water                 标定土壤[全湿]点（探针插水里）");
          Serial.println("  cal show                  查看当前标定值");
          Serial.println("  help                      显示本帮助");
        } else {
          Serial.printf("未知命令 '%s'，输入 help 查看可用命令\n", line.c_str());
        }
      }
      line = "";
    } else {
      line += c;
      if (line.length() > 64) line = "";   // 防止缓冲区被刷爆
    }
  }
}

void loop() {
  handleSerialCommands();   // 随时可以在串口监视器里敲命令调试
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("!! WiFi 断开，准备重连");
      wifiConnected = false;
    }
    wifiConnected = connectWiFi(15000);
    if (!wifiConnected) {
      // 连不上：LED 急促闪两下，然后等待下一轮（等 15 秒，不是死循环猛试）
      for (int i = 0; i < 2; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(120);
        digitalWrite(LED_PIN, LOW);
        delay(120);
      }
      delay(15000);
      return;
    }
  }

  // ---- 1.5 传感器热插拔：没找到 BH1750 就隔 10 秒再找一次 ----
  // 这样同学接上传感器后不必按 RST，也不用重新烧录。
  bh1750AutoRetry();

  // ---- 2. 到点了就上报一次 ----
  if (millis() - lastReportTime >= REPORT_INTERVAL) {
    lastReportTime = millis();

    float soilMoisture, soilTemp, lightLux;
    readSensors(soilMoisture, soilTemp, lightLux);

    // 串口实时打印一次完整读数（调试/答辩演示时看这个最直观）
    // 注意：这里必须先把结果存进 String 变量再取 c_str()。
    // 如果直接在 printf 里写三元表达式（String 和 const char* 混用），
    // 临时 String 对象会在 printf 执行前就被销毁，打印出来是乱码 —— 本项目踩过的坑。
    String lightText = (lightLux >= 0) ? (String(lightLux, 1) + " lux") : String("无(传感器未接)");
    String soilText = String(soilMoisture, 1) + "%" + (soilSimulated ? "(模拟)" : "");
    Serial.printf("  读数 → 湿度 %s | 土温 %.1f℃ | 光照 %s\n",
                  soilText.c_str(), soilTemp, lightText.c_str());

    int code = postReading(soilMoisture, soilTemp, lightLux);
    if (code != 200 && code != 201) {
      // 上报异常：LED 急促闪三下，方便远距离一眼看出问题
      for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(80);
        digitalWrite(LED_PIN, LOW);
        delay(80);
      }
    }
    Serial.printf("  当前时间：%s\n", currentTimeStr().c_str());
  }

  // ---- 3. LED 慢闪表示"活着且已联网" ----
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
