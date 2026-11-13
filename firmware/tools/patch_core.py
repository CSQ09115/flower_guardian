# -*- coding: utf-8 -*-
"""
给 Arduino 核心构建脚本补上板级宏定义 ARDUINO_BOARD / ARDUINO_VARIANT

背景：Arduino IDE 编译时会从 boards.txt 读取 build.board，生成
      -DARDUINO_BOARD="ESP32S3_DEV" -DARDUINO_VARIANT="esp32s3"
这类宏。PlatformIO 官方打包的构建脚本会做同样的事，我们手工组装的
框架包缺了这一步，导致 USB.cpp / chip-debug-report.cpp 编译失败。
本补丁让脚本自己从 boards.txt 里查，而不是写死，换板子也不会失效。
"""
import io

CORE = r"C:/Users/wh11g/.platformio/packages/framework-arduinoespressif32/tools/platformio-build.py"

ANCHOR = '''env.Append(
    CPPPATH=[
        join(FRAMEWORK_DIR, "cores", board_config.get("build.core", "esp32")),
    ]
)'''

ADD = '''
# [护花使者补丁] 板级宏定义（等价于 Arduino IDE 从 boards.txt 生成的值）
_board_id = board_config.get("build.board", "")
if not _board_id:
    _boards_txt = join(FRAMEWORK_DIR, "boards.txt")
    if isfile(_boards_txt):
        with open(_boards_txt, "r", encoding="utf-8", errors="ignore") as _f:
            for _line in _f:
                if _line.startswith("%s.build.board=" % board_config.get("build.variant", "")):
                    _board_id = _line.split("=", 1)[1].strip()
                    break
if not _board_id:
    _board_id = (board_config.get("build.variant", "") or chip_variant).upper()

env.Append(
    CPPDEFINES=[
        ("ARDUINO_BOARD", '\\\\"%s\\\\"' % _board_id),
        ("ARDUINO_VARIANT", '\\\\"%s\\\\"' % (board_config.get("build.variant", "") or chip_variant)),
    ]
)'''

src = io.open(CORE, encoding="utf-8").read()
if "护花使者补丁] 板级宏定义" in src:
    print("补丁已存在，跳过")
elif ANCHOR not in src:
    raise SystemExit("未找到锚点，请先应用核心头文件路径补丁")
else:
    src = src.replace(ANCHOR, ANCHOR + ADD, 1)
    io.open(CORE, "w", encoding="utf-8").write(src)
    print("板级宏定义补丁已写入")
