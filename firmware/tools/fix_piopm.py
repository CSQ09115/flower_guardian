"""
修复 PlatformIO 不识别手工安装包的问题
=======================================
问题现象：包已摆进 ~/.platformio/packages/，但 PIO 仍尝试联网下载（Downloading 0%）。
根因：PlatformIO 除了 package.json，还要求每个包目录里有一份 .piopm 文件
      —— 相当于"验收单"，记录包的规范来源信息。PIO 自己安装时会自动生成，
      手工摆放的包没有，就被当成"未安装"。

格式（从 platformio 官方包抄的样本）：
{"type": "tool", "name": "...", "version": "...",
 "spec": {"owner": "platformio", "id": 8037, "name": "...", "requirements": null, "uri": null}}
"""
import json
import os

PKGS_DIR = os.path.join(os.path.expanduser("~"), ".platformio", "packages")

# (包名, 版本, 类型) —— 版本必须与 platform.json 要求一致
PACKAGES = [
    ("toolchain-xtensa-esp-elf", "14.2.0+20260121", "tool"),
    ("toolchain-riscv32-esp", "14.2.0+20260121", "tool"),
    ("framework-arduinoespressif32", "4.30312.0", "framework"),
    ("framework-arduinoespressif32-esp32s3-libs", "3.3.12", "framework"),
    ("tool-esptool", "2.50400.0", "tool"),
    ("tool-esp-rom-elfs", "0.0.1+20241011", "tool"),
]


def main():
    for name, version, ptype in PACKAGES:
        pkg_dir = os.path.join(PKGS_DIR, name)
        if not os.path.isdir(pkg_dir):
            print(f"[跳过] 目录不存在: {name}")
            continue
        manifest = {
            "type": ptype,
            "name": name,
            "version": version,
            "spec": {
                "owner": "platformio",
                "id": None,
                "name": name,
                "requirements": None,
                "uri": None,
            },
        }
        path = os.path.join(pkg_dir, ".piopm")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(manifest, f)
        print(f"[已写入] {name} ({version}, {ptype})")


if __name__ == "__main__":
    main()
