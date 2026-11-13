"""
串口监视小工具（Windows 版）
=================================
用途：直接读 COM 口的日志，不需要 PlatformIO 的交互终端。
用法：python tools/serial_monitor.py [串口号] [秒数]
示例：python tools/serial_monitor.py COM7 30
"""
import sys
import time
import serial
import serial.tools.list_ports

def list_ports():
    print("当前可用的串口：")
    for p in serial.tools.list_ports.comports():
        print(f"  {p.device}  {p.description}")

def main():
    port = sys.argv[1] if len(sys.argv) > 1 else None
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 20.0

    if not port:
        list_ports()
        print("\n请指定串口，例如：python tools/serial_monitor.py COM7 30")
        return

    print(f"正在监听 {port}（波特率 115200），持续 {seconds:.0f} 秒，Ctrl+C 可提前结束")
    print("-" * 60)
    try:
        ser = serial.Serial(port, 115200, timeout=1)
    except Exception as e:
        print(f"打不开 {port}：{e}")
        list_ports()
        return

    end = time.time() + seconds
    try:
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
                print(text)
    except KeyboardInterrupt:
        print("\n已停止")
    finally:
        ser.close()

if __name__ == "__main__":
    main()
