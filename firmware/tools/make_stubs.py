"""
为"本项目用不到"的包创建占位包（stub），阻止 PlatformIO 联网下载
=============================================================
背景：platform.json 声明了 20+ 个包，PIO 会逐个检查，缺失就联网下载。
     其中 GDB 调试器 / OpenOCD / CMake / Ninja / 文件系统工具(mkspiffs 等) /
     esp-idf 框架 等，在"Arduino 框架 + 串口烧录"的项目里完全用不到。
     而它们的官方下载源在国内被 403 拦截，永远下不完。

策略：给这些包造一个"空壳"——目录里只有 package.json 和 .piopm，
     版本号严格落在 platform.json 要求的范围内。PIO 检查到"包已安装且版本合规"，
     就停止联网。这些工具我们永远不调用，所以空壳不影响编译。

工程思维：这叫"依赖降级/依赖替换"，是工业界处理不可用依赖的常用手段。
"""
import json
import os

PKGS_DIR = os.path.join(os.path.expanduser("~"), ".platformio", "packages")

# (包名, 版本号, 类型, owner) —— 版本号取自 platform.json 的要求范围
STUBS = [
    ("tool-xtensa-esp-elf-gdb", "11.2.0", "tool", "espressif"),
    # 版本号以 PIO 实际要求为准（它在日志里明说要 ~11.2.0，而不是配置里的 12.1.0）
    ("tool-riscv32-esp-elf-gdb", "11.2.0", "tool", "espressif"),
    ("toolchain-esp32ulp", "1.23800.0", "tool", "platformio"),
    ("tool-dfuutil-arduino", "1.11.0", "tool", "platformio"),
    ("tool-openocd-esp32", "2.1100.0", "tool", "espressif"),
    ("tool-mkspiffs", "2.230.0", "tool", "platformio"),
    ("tool-mklittlefs", "1.203.0", "tool", "platformio"),
    ("tool-mkfatfs", "2.0.0", "tool", "platformio"),
    ("tool-cmake", "3.30.0", "tool", "platformio"),
    ("tool-ninja", "1.7.0", "tool", "platformio"),
    ("tool-mconf", "1.4060000.0", "tool", "platformio"),
    ("tool-idf", "1.0.1", "tool", "platformio"),
    ("framework-espidf", "4.60100.0", "framework", "platformio"),
]


def main():
    for name, version, ptype, owner in STUBS:
        pkg_dir = os.path.join(PKGS_DIR, name)
        os.makedirs(pkg_dir, exist_ok=True)

        # 身份证：PIO 用它判断"装的这个包是不是我要的"
        with open(os.path.join(pkg_dir, "package.json"), "w", encoding="utf-8") as f:
            json.dump({"name": name, "version": version,
                       "system": ["*"],
                       "description": f"stub package for {name} (not used by this project)"},
                      f, indent=2)

        # 验收单：PIO 判断"包是否已安装"
        with open(os.path.join(pkg_dir, ".piopm"), "w", encoding="utf-8") as f:
            json.dump({"type": ptype, "name": name, "version": version,
                       "spec": {"owner": owner, "id": None, "name": name,
                                "requirements": None, "uri": None}}, f)

        print(f"[占位] {name} ({version})")
    print(f"\n完成，共 {len(STUBS)} 个占位包")


if __name__ == "__main__":
    main()
