"""
补装两个遗漏包：tool-esptool（烧录工具）+ tool-esp-rom-elfs（芯片 ROM 符号表）
esptool 真实文件名从 GitHub API 查得（不再猜）：esptool-v5.4.0-windows-amd64.zip
"""
import json
import os
import shutil
import subprocess
import sys
import tarfile
import zipfile

BASE_CN = "https://dl.espressif.cn/github_assets"
PKGS_DIR = os.path.join(os.path.expanduser("~"), ".platformio", "packages")
DL_DIR = "D:/esp32dl/downloads"

JOBS = [
    {
        "name": "tool-esptool",
        "version": "2.50400.0",
        "system": ["windows_amd64"],
        "url": f"{BASE_CN}/espressif/esptool/releases/download/v5.4.0/esptool-v5.4.0-windows-amd64.zip",
        "file": "esptool.zip",
    },
    {
        "name": "tool-esp-rom-elfs",
        "version": "0.0.1+20241011",
        "system": "*",
        "url": f"{BASE_CN}/espressif/esp-rom-elfs/releases/download/20241011/esp-rom-elfs-20241011.tar.gz",
        "file": "rom_elfs.tar.gz",
    },
]


def download(url, dest):
    r = subprocess.run(["curl", "-L", "--retry", "3", "-sS", "-o", dest, url])
    return r.returncode == 0


def extract_any(archive, tmp):
    """zip 和 tar.gz 都能解"""
    if archive.endswith(".zip"):
        with zipfile.ZipFile(archive) as z:
            z.extractall(tmp)
    else:
        with tarfile.open(archive) as t:
            t.extractall(tmp)


def install(job):
    dest = os.path.join(DL_DIR, job["file"])
    if not download(job["url"], dest):
        print(f"!! 下载失败 {job['name']}")
        return False
    size = os.path.getsize(dest)
    print(f"下载完成: {size/1048576:.1f}MB")
    if size < 10000:  # 小于10KB几乎肯定是404页面而不是真文件
        print(f"!! 文件异常偏小，疑似下载到错误页面 {job['name']}")
        return False

    pkg_dir = os.path.join(PKGS_DIR, job["name"])
    if os.path.isdir(pkg_dir):
        shutil.rmtree(pkg_dir)
    os.makedirs(pkg_dir)

    tmp = os.path.join(DL_DIR, "extract_tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    extract_any(dest, tmp)

    entries = os.listdir(tmp)
    if len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])):
        src = os.path.join(tmp, entries[0])
    else:
        src = tmp
    for item in os.listdir(src):
        shutil.move(os.path.join(src, item), os.path.join(pkg_dir, item))

    with open(os.path.join(pkg_dir, "package.json"), "w", encoding="utf-8") as f:
        json.dump({"name": job["name"], "version": job["version"],
                   "system": job["system"]}, f, indent=2)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"OK -> {pkg_dir}")
    return True


def main():
    os.makedirs(DL_DIR, exist_ok=True)
    for job in JOBS:
        print(f"\n=== [{job['name']}] ===")
        install(job)
    return 0


if __name__ == "__main__":
    sys.exit(main())
