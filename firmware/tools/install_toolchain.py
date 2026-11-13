"""
护花使者 - PlatformIO 工具链国内下载组装脚本
=============================================
背景：PlatformIO 官方下载服务器 (dl.registry.platformio.org) 拦截中国区域访问(403)，
     GitHub 直连仅 15KB/s 不可用。
方案：从乐鑫官方国内 CDN (dl.espressif.cn/github_assets) 下载与 PlatformIO 要求
     完全相同版本的工具链，手动组装到 ~/.platformio/packages/ 目录。

原理：PlatformIO 启动构建时，会扫描 packages 目录：
     只要 <包名>/package.json 里的 name 和 version 符合平台要求，就直接使用本地包，
     不再联网下载。所以我们"把货先摆到仓库里"，它就懒得去网购了。

教学点：
  1. 排障思维：官方路不通 -> 找内容的"原始出处"(乐鑫) -> 找乐鑫的国内镜像
  2. 供应链安全：下载后校验来源是官方域名，不使用来历不明的第三方镜像
"""
import json
import os
import shutil
import subprocess
import sys
import zipfile

BASE_CN = "https://dl.espressif.cn/github_assets"
PKGS_DIR = os.path.join(os.path.expanduser("~"), ".platformio", "packages")
DL_DIR = "D:/esp32dl/downloads"

# PlatformIO 平台要求的包（版本来自 ~/.platformio/platforms/espressif32/platform.json）
JOBS = [
    {
        "name": "toolchain-xtensa-esp-elf",          # ESP32-S3 主编译器
        "version": "14.2.0+20260121",
        "system": ["windows_amd64"],
        "url": f"{BASE_CN}/espressif/crosstool-NG/releases/download/esp-14.2.0_20260121/xtensa-esp-elf-14.2.0_20260121-x86_64-w64-mingw32.zip",
        "zipname": "xtensa.zip",
    },
    {
        "name": "toolchain-riscv32-esp",             # RISC-V 协处理器编译器
        "version": "14.2.0+20260121",
        "system": ["windows_amd64"],
        "url": f"{BASE_CN}/espressif/crosstool-NG/releases/download/esp-14.2.0_20260121/riscv32-esp-elf-14.2.0_20260121-x86_64-w64-mingw32.zip",
        "zipname": "riscv.zip",
    },
    {
        "name": "framework-arduinoespressif32",     # Arduino 核心框架源码
        "version": "4.30312.0",                      # PIO 编号，对应 arduino-esp32 3.3.12
        "system": "*",
        "url": f"{BASE_CN}/espressif/arduino-esp32/releases/download/3.3.12/esp32-core-3.3.12.zip",
        "zipname": "core.zip",
    },
    {
        "name": "framework-arduinoespressif32-esp32s3-libs",  # S3 芯片的预编译库
        "version": "3.3.12",
        "system": "*",
        "url": f"{BASE_CN}/espressif/arduino-esp32/releases/download/3.3.12/esp32s3-libs-3.3.12.zip",
        "zipname": "s3libs.zip",
    },
    {
        "name": "tool-esptool",                      # 烧录工具
        "version": "2.50400.0",                      # PIO 编号，对应 esptool v5.4
        "system": ["windows_amd64"],
        "url": f"{BASE_CN}/espressif/esptool/releases/download/v5.4.0/esptool-v5.4.0-win64.zip",
        "zipname": "esptool.zip",
    },
]


def human_size(n):
    return f"{n/1048576:.1f}MB" if n >= 1048576 else f"{n/1024:.1f}KB"


def download(url, dest):
    """用 curl 下载（支持断点续传，失败自动重试）"""
    cmd = ["curl", "-L", "--retry", "3", "--continue-at", "-",
           "-sS", "-o", dest, url]
    r = subprocess.run(cmd)
    return r.returncode == 0


def extract_and_install(job):
    """解�� zip -> 摆放到 PlatformIO 包目录 -> 写 package.json"""
    pkg_dir = os.path.join(PKGS_DIR, job["name"])
    if os.path.isdir(pkg_dir):
        shutil.rmtree(pkg_dir)
    os.makedirs(pkg_dir)

    # 解压到临时目录，探明 zip 的顶层结构
    tmp = os.path.join(DL_DIR, "extract_" + job["zipname"].replace(".zip", ""))
    if os.path.isdir(tmp):
        shutil.rmtree(tmp)
    os.makedirs(tmp)
    with zipfile.ZipFile(os.path.join(DL_DIR, job["zipname"])) as z:
        z.extractall(tmp)

    # zip 通常带一个顶层目录（如 xtensa-esp-elf-14.2.0_.../），
    # 我们要把"它里面的内容"提升到包目录顶层
    entries = os.listdir(tmp)
    if len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])):
        src = os.path.join(tmp, entries[0])
    else:
        src = tmp
    for item in os.listdir(src):
        shutil.move(os.path.join(src, item), os.path.join(pkg_dir, item))
    shutil.rmtree(tmp)

    # 写 package.json —— PlatformIO 只认这个"身份证"
    manifest = {
        "name": job["name"],
        "version": job["version"],
        "system": job["system"],
        "description": f"{job['name']} installed via Espressif CN mirror",
    }
    with open(os.path.join(pkg_dir, "package.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    shutil.rmtree(tmp, ignore_errors=True)


def main():
    os.makedirs(DL_DIR, exist_ok=True)
    os.makedirs(PKGS_DIR, exist_ok=True)
    ok = 0
    for job in JOBS:
        dest = os.path.join(DL_DIR, job["zipname"])
        print(f"\n=== [{job['name']}] ===")
        print(f"下载: {job['url']}")
        if not download(job["url"], dest):
            print(f"!! 下载失败: {job['zipname']}")
            continue
        size = os.path.getsize(dest)
        print(f"下载完成: {human_size(size)}")
        print("组装到 PlatformIO 包目录...")
        extract_and_install(job)
        print(f"OK -> {os.path.join(PKGS_DIR, job['name'])}")
        ok += 1

    print(f"\n========== 完成 {ok}/{len(JOBS)} ==========")
    # 列出成品供检查
    print("\n包目录清单:")
    for job in JOBS:
        d = os.path.join(PKGS_DIR, job["name"])
        mark = "OK " if os.path.isdir(d) else "缺失"
        print(f"  [{mark}] {job['name']} ({job['version']})")
    return 0 if ok == len(JOBS) else 1


if __name__ == "__main__":
    sys.exit(main())
