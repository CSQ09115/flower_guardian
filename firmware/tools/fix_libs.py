# -*- coding: utf-8 -*-
"""
修复 esp32s3-libs 包结构 + 生成芯片构建脚本
背景：PlatformIO 官方平台 8.0.0 期望 libs 包内部结构为
      <libs包>/esp32s3/{bin,include,lib,ld,flags,...} 且含 esp32s3/pioarduino-build.py
      （构建脚本会加载它来注入芯片相关的编译/链接参数）
而乐鑫官方 release 的 esp32s3-libs-3.3.12.zip 解压后这些目录直接在根目录，
且不含构建脚本。本脚本完成两件事：
  1. 把根目录内容搬进 esp32s3/ 子目录
  2. 依据包内 flags/ 下的参数清单，生成 esp32s3/pioarduino-build.py
"""
import io
import os
import shutil

LIBS = r"C:/Users/wh11g/.platformio/packages/framework-arduinoespressif32-esp32s3-libs"
CHIP = "esp32s3"

# ---------- 第一步：目录重构 ----------
chip_dir = os.path.join(LIBS, CHIP)
os.makedirs(chip_dir, exist_ok=True)
moved = []
for name in sorted(os.listdir(LIBS)):
    if name in (CHIP, "package.json", ".piopm"):
        continue
    src = os.path.join(LIBS, name)
    dst = os.path.join(chip_dir, name)
    if os.path.isdir(src) and os.path.isdir(dst):
        continue
    if os.path.exists(dst):
        continue
    shutil.move(src, dst)
    moved.append(name)
print("已迁入 %s/ 的目录：" % CHIP, moved if moved else "(无需移动)")

# ---------- 第二步：生成构建脚本 ----------
script_path = os.path.join(chip_dir, "pioarduino-build.py")

content = r'''"""
ESP32-S3 Arduino 预编译库构建脚本（护花使者工程自制版）

作用：把 esp32s3-libs 包中 flags/ 目录下的编译参数清单
（S_flags / c_flags / cpp_flags / defines / includes / ld_flags / ld_libs / ld_scripts）
注入到 PlatformIO 的 SCons 构建环境里。

为什么需要自己写：PlatformIO 官方平台上，这个文件随 libs 包一起分发；
我们是用乐鑫国内镜像手工组装的环境，包里没有它，故按同样的规则生成。
"""

from os.path import isdir, isfile, join

from SCons.Script import DefaultEnvironment

env = DefaultEnvironment()
platform = env.PioPlatform()
board = env.BoardConfig()

chip = (board.get("build.chip_variant", "") or board.get("build.mcu", "")).lower()

# 定位芯片库包（兼容"合并包"与"按芯片分包"两种布局）
libs_dir = None
for name in ("framework-arduinoespressif32-libs",
             "framework-arduinoespressif32-%s-libs" % chip):
    try:
        d = platform.get_package_dir(name)
    except Exception:
        d = None
    if d and isdir(d):
        libs_dir = d
        break

variant_dir = join(libs_dir, chip) if isdir(join(libs_dir, chip)) else libs_dir


def _flags(name):
    """读取 flags/ 下的参数清单文件，按空白切分成列表"""
    path = join(variant_dir, "flags", name)
    if not isfile(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return f.read().split()


# --- Flash / PSRAM 组合库目录 ---
# N16R8 是 Flash 四线(QSPI) + PSRAM 八线(OPI)，对应目录 qio_opi。
# 这类目录里的库会覆盖通用 lib/ 目录中的同名库，所以必须排在前面。
memory_type = board.get("build.arduino.memory_type", "")
if not memory_type:
    flash_mode = board.get("build.flash_mode", "qio")
    psram_type = "opi" if board.get("build.psram_type", "") == "opi" else "qspi"
    memory_type = "%s_%s" % (flash_mode, psram_type)
mem_dir = join(variant_dir, memory_type)

# --- 头文件搜索路径 ---
# includes 清单里的写法是 "-iwithprefixbefore newlib/platform_include"，
# 这些相对路径都存在于 libs 包的 include/ 目录下，据此转换成真实路径
cpppath = []
tokens = _flags("includes")
i = 0
while i < len(tokens):
    tok = tokens[i]
    if tok == "-iwithprefixbefore":
        i += 1
        if i < len(tokens):
            cpppath.append(join(variant_dir, "include", tokens[i]))
    elif tok.startswith("-I"):
        rest = tok[2:]
        if not rest and i + 1 < len(tokens):
            i += 1
            rest = tokens[i]
        cpppath.append(rest)
    i += 1

# ESP-IDF 的配置头文件 sdkconfig.h 由乐鑫预生成，
# 放在各 Flash/PSRAM 组合目录的 include/ 下（如 qio_opi/include/sdkconfig.h），
# 必须优先于通用 include/ 目录被搜索到
cpppath.insert(0, join(mem_dir, "include"))

# --- 宏定义（去掉 -D 前缀，交给 SCons 的 CPPDEFINES）---
defines = [t[2:] for t in _flags("defines") if t.startswith("-D")]

# memory.ld 放在 ld/ 目录，sections.ld 放在 Flash/PSRAM 组合目录（如 qio_opi/），
# 所以两个目录都要找
ld_dir = join(variant_dir, "ld")
link_scripts = []
tokens = _flags("ld_scripts")
i = 0
while i < len(tokens):
    tok = tokens[i]
    name = None
    if tok == "-T":
        i += 1
        name = tokens[i] if i < len(tokens) else None
    elif tok.startswith("-T"):
        name = tok[2:]
    if name:
        found = None
        for d in (mem_dir, ld_dir):
            if isfile(join(d, name)):
                found = join(d, name)
                break
        # SCons 会把 LINKFLAGS 的每一项作为独立参数传给链接器，
        # 所以 "-T" 和脚本路径必须是两个独立元素
        link_scripts += ["-T", found if found else name]
    i += 1

libpath = [mem_dir, join(variant_dir, "lib"), ld_dir]

env.Append(
    CPPPATH=cpppath,
    CPPDEFINES=defines,
    CCFLAGS=_flags("S_flags"),
    CFLAGS=_flags("c_flags"),
    CXXFLAGS=_flags("cpp_flags"),
    LIBPATH=[p for p in libpath if p and isdir(p)],
    LIBS=[t[2:] for t in _flags("ld_libs") if t.startswith("-l")],
    LINKFLAGS=_flags("ld_flags") + link_scripts,
)
'''

with io.open(script_path, "w", encoding="utf-8") as f:
    f.write(content)
print("已生成构建脚本:", script_path)
print("libs 包 esp32s3/ 目录内容:", sorted(os.listdir(chip_dir))[:12])
