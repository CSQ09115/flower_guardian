"""
给 ESP32 发送串口调试命令，并打印返回内容
=========================================
用法：
  python tools/send_command.py COM7 scan
  python tools/send_command.py COM7 "scan 8 9"
  python tools/send_command.py COM7 help
  python tools/send_command.py COM7 scan 12 12   # 命令回显 12 秒 + 开机等待 12 秒

参数：端口 / 命令 / 回显秒数(默认6) / 开机等待秒数(默认1.5)

原理：固件 loop() 里会读串口缓冲，收到一行文本就执行对应命令。
注意：pyserial 打开串口时 DTR/RTS 变化会触发板子复位，
      所以 boot_wait 要留够开机时间（WiFi+NTP 约 8~12 秒），
      等待期间的开机日志也会一并打印出来，方便看自检结果。
"""
import sys
import time
import serial
import serial.tools.list_ports


def drain(ser, seconds, tag=""):
    end = time.time() + seconds
    while time.time() < end:
        try:
            line = ser.readline()
        except Exception:
            break
        if line:
            print(f"{tag}{line.decode('utf-8', errors='replace').rstrip()}", flush=True)


def main():
    port = sys.argv[1] if len(sys.argv) > 1 else "COM7"
    command = sys.argv[2] if len(sys.argv) > 2 else "scan"
    wait = float(sys.argv[3]) if len(sys.argv) > 3 else 6.0
    boot_wait = float(sys.argv[4]) if len(sys.argv) > 4 else 1.5

    try:
        ser = serial.Serial(port, 115200, timeout=1)
    except Exception as e:
        print(f"打不开 {port}：{e}")
        print("可用串口：", [p.device for p in serial.tools.list_ports.comports()])
        return

    if boot_wait > 0:
        print(f"等待板子启动 {boot_wait:.0f} 秒（同时打印开机日志）...", flush=True)
        print("-" * 60, flush=True)
        drain(ser, boot_wait)
        ser.reset_input_buffer()

    print(f">>> 发送命令: {command}", flush=True)
    print("-" * 60, flush=True)
    ser.write((command + "\n").encode("utf-8"))
    ser.flush()
    drain(ser, wait)
    ser.close()


if __name__ == "__main__":
    main()
