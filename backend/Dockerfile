# 护花使者后端镜像（FastAPI + 管理后台静态站点）
# 构建前必须在 web 目录执行 npm run build:admin，确保 backend/admin_ui 已生成。
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    TZ=Asia/Shanghai

WORKDIR /app

# OpenCV / Pillow 运行时依赖；libpq5 供 PostgreSQL 驱动使用
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
        libpq5 \
        tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

# 默认安装 CPU 版 PyTorch，避免拉取整套 CUDA 依赖；
# 需要 GPU 推理时通过 --build-arg TORCH_INDEX_URL=<CUDA 源> 覆盖。
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
# 默认走清华 PyPI 镜像，国内网络构建更稳定；需要官方源时通过 --build-arg PIP_INDEX_URL=https://pypi.org/simple 覆盖
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
RUN pip install --no-cache-dir --index-url ${TORCH_INDEX_URL} torch torchvision \
    && pip install --no-cache-dir --index-url ${PIP_INDEX_URL} -r requirements.txt

COPY . .

# 管理后台产物由 web 目录构建后同步而来，缺失时直接构建失败并给出提示
RUN test -f admin_ui/index.html || (echo "缺少 admin_ui/index.html，请先在 web 目录执行 npm run build:admin" >&2 && exit 1)

# 运行时写入目录（正式部署请用 volume 挂载）
RUN mkdir -p static/plants models/uploads uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
