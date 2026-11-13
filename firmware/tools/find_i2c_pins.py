"""
自动寻找 BH1750 接在哪组 I2C 引脚上
=====================================
背景：接线照片里 SDA/SCL 两根线被开发板挡住，看不到终点插在哪一列。
      固件在 GPIO41/42 上扫描不到任何 I2C 设备，怀疑接到了别的 GPIO。

做法：保持串口打开（避免每次开串口触发 DTR 复位），
      依次让固件用不同的 (SDA, SCL) 组合扫描总线，
      哪一组能应答 0x23 / 0x5C，传感器就接在那儿。

用法：python tools/find_i2c_pins.py COM7
"""
import sys
import time
import re
import serial
import serial.tools.list_ports

# 候选引脚对：都是 ESP32-S3 上可安全用作普通 GPIO 的引脚
# 注意：33~37 在 N16R8(Octal PSRAM) 上被 PSRAM 占用，0/3/45/46 是启动配置脚，均不扫描
CANDIDATES = [
    (41, 42), (42, 41),   # 代码里配置的那组，以及接反的情况
    (8, 9), (9, 8),
    (4, 5), (5, 4),
    (1, 2), (2, 1),
    (21, 22), (22, 21),
    (18, 19), (19, 18),
    (12, 13), (13, 12),
    (38, 39), (39, 38),
    (40, 41), (41, 40),
    (47, 48), (48, 47),
    (15, 16), (16, 15),
    (6, 7), (7, 6),
    (10, 11), (11, 10),
    (17, 18), (18, 17),
    (2, 41), (2, 42), (1, 41), (1, 42),
]


def main():
    port = sys.argv[1] if len(sys.argv) > 1 else "COM7"
    try:
        ser = serial.Serial(port, 115200, timeout=1)
    except Exception as e:
        print(f"打不开 {port}：{e}")
        print("可用串口：", [p.device for p in serial.tools.list_ports.comports()])
        return

    # 打开串口可能触发 DTR 复位，等板子完成开机（WiFi + NTP 大约 8~12 秒）
    print("等待板子启动...", flush=True)
    time.sleep(12)
    ser.reset_input_buffer()

    hits = []
    print(f"开始扫描 {len(CANDIDATES)} 组引脚，每组约 1 秒\n", flush=True)
    for sda, scl in CANDIDATES:
        ser.write(f"scan {sda} {scl}\n".encode("utf-8"))
        ser.flush()
        time.sleep(1.2)
        buf = b""
        while ser.in_waiting:
            buf += ser.read(ser.in_waiting)
            time.sleep(0.05)
        text = buf.decode("utf-8", errors="replace")
        addrs = re.findall(r"地址 0x([0-9A-Fa-f]{2}) 有应答", text)
        if addrs:
            print(f"  ★ SDA={sda:2d} SCL={scl:2d}  ->  发现 {', '.join('0x'+a for a in addrs)}", flush=True)
            hits.append((sda, scl, addrs))
        else:
            print(f"    SDA={sda:2d} SCL={scl:2d}  ->  空", flush=True)

    print("\n" + "=" * 60)
    if hits:
        print("找到设备！传感器应该接在这组引脚上：")
        for sda, scl, addrs in hits:
            print(f"  SDA=GPIO{sda}  SCL=GPIO{scl}  地址 {', '.join('0x'+a for a in addrs)}")
        print("\n要么把线改回 GPIO41/42，要么改 board_pins.h 里的 PIN_I2C_SDA/SCL 后重新烧录。")
    else:
        print("所有候选引脚都没扫到任何 I2C 设备 —— 问题不在引脚号。")
        print("最大嫌疑是【供电】：用万用表量 BH1750 模块 VCC 与 GND 之间，")
        print("应该有 3.3V（或 5V，取决于你接的是哪个脚）。没电压就先查电源轨。")
    ser.close()


if __name__ == "__main__":
    main()
