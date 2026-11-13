"""
远程复位 ESP32 并抓取开机日志
=================================
原理：CH343 这类 USB 转串口芯片的 DTR/RTS 引脚，在开发板上接到了 EN(复位)
和 IO0(下载模式) 的自动下载电路。按特定顺序翻转这两个引脚，等价于按一下 RST 键。

用法：python tools/reset_and_read.py COM7 25
"""
import sys
import time
import serial
import serial.tools.list_ports


def list_ports():
    print("当前可用串口：")
    for p in serial.tools.list_ports.comports():
        print(f"  {p.device}  {p.description}")


def read_for(ser, seconds, tag=""):
    end = time.time() + seconds
    while time.time() < end:
        try:
            line = ser.readline()
        except Exception:
            break
        if not line:
            continue
        try:
            text = line.decode("utf-8", errors="replace").rstrip()
        except Exception:
            continue
        if text:
            print(f"{tag}{text}")


def hard_reset(ser):
    """翻转 DTR/RTS 产生一次复位脉冲（与 esptool 的做法一致）"""
    ser.setDTR(False)
    ser.setRTS(True)
    time.sleep(0.2)
    ser.setDTR(True)
    ser.setRTS(False)
    time.sleep(0.2)
    ser.setDTR(False)
    ser.setRTS(False)


def main():
    port = sys.argv[1] if len(sys.argv) > 1 else "COM7"
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0

    try:
        ser = serial.Serial(port, 115200, timeout=1)
    except Exception as e:
        print(f"打不开 {port}：{e}")
        list_ports()
        return

    print(f"已打开 {port}，先读 5 秒当前状态...")
    print("-" * 60)
    read_for(ser, 5)

    print("-" * 60)
    print(">>> 发送复位脉冲（等价于按一下 RST 键）")
    hard_reset(ser)

    print(f">>> 抓取开机日志 {seconds:.0f} 秒")
    print("-" * 60)
    read_for(ser, seconds)
    ser.close()


if __name__ == "__main__":
    main()
