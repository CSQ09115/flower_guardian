import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.database import engine
from app.db.base import Base
from contextlib import asynccontextmanager

# web 目录构建产出（npm run build）：根目录是官网静态站点，
# admin/ 子目录是运营后台（Vite 多页构建，base=/）。
ADMIN_UI_DIR = Path(__file__).resolve().parent.parent / "admin_ui"


class SPAStaticFiles(StaticFiles):
    """带 SPA 兜底的静态目录：文件存在返回文件，否则回退 index.html（history 路由）。

    注意 StaticFiles.get_response 的 path 参数相对挂载目录，因此 fallback
    传相对路径（如 "index.html"）而不是绝对路径。
    """

    def __init__(self, directory: str, fallback: str, **kwargs) -> None:
        super().__init__(directory=directory, **kwargs)
        self._fallback = fallback

    async def get_response(self, path: str, scope):  # type: ignore[override]
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                response = await super().get_response(self._fallback, scope)
            else:
                raise
        if response.status_code == 404:
            response = await super().get_response(self._fallback, scope)
        # HTML 入口禁止缓存：浏览器每次都重新拉取入口页，避免部署新版后
        # 旧 HTML 引用已不存在的资源（如 Next.js 的 /_next/*）导致刷新循环
        content_type = response.headers.get("content-type", "")
        if response.status_code == 200 and content_type.startswith("text/html"):
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
        return response

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 先导入并注册全部模型，再建表，最后导入路由与服务。
# 识别服务在模块导入期会读取 YOLO 配置，必须保证此时 system_configs 已存在；
# create_all 只会补齐缺失的表，不会影响已有表和数据。
import app.models  # noqa: F401
Base.metadata.create_all(bind=engine)

# 轻量级列迁移：create_all 不会为已有表补列，这里为 users 表补 phone 列（短信登录）
from sqlalchemy import text
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(20)"))
        conn.execute(text("CREATE UNIQUE INDEX ix_users_phone ON users (phone)"))
        conn.commit()
        logger.info("users 表已新增 phone 列")
    except Exception:
        # 列已存在（重复启动/新库）时忽略
        pass

# 设备管理模块：create_all 不会为已有表补列，这里为 devices 表逐列补齐（PostgreSQL）
# 阈值/标定/启停列；device_alerts 是新表，由上面 create_all 直接建出
_DEVICE_COLUMNS = [
    ("report_interval", "INTEGER DEFAULT 10"),
    ("enabled", "BOOLEAN DEFAULT TRUE"),
    ("moisture_min", "FLOAT DEFAULT 35.0"),
    ("moisture_max", "FLOAT DEFAULT 70.0"),
    ("temp_min", "FLOAT DEFAULT 12.0"),
    ("temp_max", "FLOAT DEFAULT 30.0"),
    ("air_temp_min", "FLOAT DEFAULT 5.0"),
    ("air_temp_max", "FLOAT DEFAULT 35.0"),
    ("air_humidity_min", "FLOAT DEFAULT 20.0"),
    ("air_humidity_max", "FLOAT DEFAULT 90.0"),
    ("lux_min", "FLOAT DEFAULT 500.0"),
    ("lux_max", "FLOAT DEFAULT 30000.0"),
    ("alarm_enabled", "BOOLEAN DEFAULT TRUE"),
    ("air_raw", "INTEGER DEFAULT 3200"),
    ("water_raw", "INTEGER DEFAULT 1300"),
    ("calibration_source", "VARCHAR(40) DEFAULT '出厂默认'"),
    ("updated_at", "TIMESTAMP"),
]
try:
    with engine.connect() as conn:
        for _col, _def in _DEVICE_COLUMNS:
            conn.execute(text(f"ALTER TABLE devices ADD COLUMN IF NOT EXISTS {_col} {_def}"))
        conn.commit()
    logger.info("devices 表阈值/标定列已就绪")
except Exception as e:
    logger.warning(f"devices 表列迁移失败（新库首次 create_all 后列已存在）: {e}")

# verificationpurpose 为 PG 原生 ENUM，新增枚举值需 ALTER TYPE（autocommit 下执行）
try:
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("ALTER TYPE verificationpurpose ADD VALUE IF NOT EXISTS 'BIND_EMAIL'"))
        logger.info("verificationpurpose 枚举已包含 BIND_EMAIL")
except Exception as e:
    logger.warning(f"更新 verificationpurpose 枚举失败（新库首次 create_all 后会自动包含）: {e}")

from app.api.router import api_router

# 定时任务调度器
scheduler = None


def setup_scheduler():
    """配置定时任务"""
    global scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        from app.tasks.reminder_tasks import (
            check_upcoming_reminders,
            refresh_weather_factors,
            send_daily_reminders,
            send_overdue_reminders
        )

        scheduler = AsyncIOScheduler()

        # 每小时检查即将到期的提醒
        scheduler.add_job(
            check_upcoming_reminders,
            CronTrigger(minute=0),
            id="check_reminders",
            replace_existing=True
        )

        # 每日9点发送提醒
        scheduler.add_job(
            send_daily_reminders,
            CronTrigger(hour=9, minute=0),
            id="daily_reminders",
            replace_existing=True
        )

        # 每6小时刷新天气
        scheduler.add_job(
            refresh_weather_factors,
            CronTrigger(hour="*/6"),
            id="refresh_weather",
            replace_existing=True
        )

        # 每3小时检查逾期提醒
        scheduler.add_job(
            send_overdue_reminders,
            CronTrigger(hour="*/3"),
            id="overdue_reminders",
            replace_existing=True
        )

        scheduler.start()
        logging.info("定时任务调度器已启动")
    except ImportError:
        logging.warning("APScheduler 未安装，跳过定时任务配置")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化植物数据
    from app.db.seed_plants import seed_plants
    from app.db.seed_admin import seed_admin_user
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        seed_plants(db)
        seed_admin_user(db)
    finally:
        db.close()

    # 启动定时任务
    setup_scheduler()

    yield

    # 关闭定时任务
    if scheduler:
        scheduler.shutdown()
        logging.info("定时任务调度器已关闭")


app = FastAPI(title="护花使者 API", version="1.0.0", lifespan=lifespan)

# 挂载静态文件目录（植物图片）
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# WebSocket CORS 中间件
@app.middleware("http")
async def add_websocket_cors_headers(request: Request, call_next):
    response = await call_next(request)
    # 为所有响应添加 WebSocket 相关的 CORS 头
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, CONNECT"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "false"
    # 静态图片禁用强缓存：本地图片更新后浏览器通过 ETag/Last-Modified 重新校验（304），
    # 保证同名文件被替换后前台能立即看到新图
    if request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response

# Include API routes
app.include_router(api_router)

# Include WebSocket routes
from app.api.endpoints.websocket import router as websocket_router
app.include_router(websocket_router)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    # 官网有自己的图标（构建产出的 assets/favicon-32.png）就优先用官网的；
    # 其次 dist 根下的 favicon.ico；都没有时沿用旧的 admin favicon。
    for candidate, media in (
        (ADMIN_UI_DIR / "assets" / "favicon-32.png", "image/png"),
        (ADMIN_UI_DIR / "favicon.ico", "image/x-icon"),
    ):
        if candidate.is_file():
            return FileResponse(candidate, media_type=media)
    raise StarletteHTTPException(status_code=404)


@app.get("/health")
def health_check():
    # 尝试导入服务，如果失败则返回警告
    try:
        from app.services.recognition import plant_recognition_service
        from app.services.pest_recognition import pest_recognition_service

        return {
            "status": "healthy",
            "plant_model": plant_recognition_service.model is not None,
            "pest_model": pest_recognition_service.model is not None
        }
    except Exception as e:
        return {
            "status": "healthy",
            "warning": str(e)
        }


@app.get("/models/status")
def models_status():
    """获取模型状态"""
    try:
        from app.services.recognition import plant_recognition_service
        from app.services.pest_recognition import pest_recognition_service

        return {
            "plant": {
                "loaded": plant_recognition_service.model is not None,
                "classes_count": len(plant_recognition_service.classes),
                "model_path": plant_recognition_service.model_path
            },
            "pest": {
                "loaded": pest_recognition_service.model is not None,
                "classes_count": len(pest_recognition_service.classes),
                "model_path": pest_recognition_service.model_path
            }
        }
    except Exception as e:
        return {
            "error": str(e),
            "plant": {"loaded": False, "classes_count": 0},
            "pest": {"loaded": False, "classes_count": 0}
        }


# ── 静态站点（官网 + 运营后台）────────────────────────────────────
# 挂载顺序敏感：必须在所有 /api、/docs、WebSocket 与显式路由之后挂载，
# 避免遮蔽 API；/admin 先于 / 挂载，保证后台路径优先命中。
# 后台是 hash 路由，/admin/* 的未知路径回退 admin/index.html（SPA 兜底）。

if (ADMIN_UI_DIR / "admin" / "index.html").exists():
    app.mount(
        "/admin",
        SPAStaticFiles(
            directory=str(ADMIN_UI_DIR / "admin"),
            fallback="index.html",
            html=True,
        ),
        name="admin",
    )
    logging.info("运营后台已挂载：/admin -> %s", ADMIN_UI_DIR / "admin")
else:
    logging.warning(
        "未找到运营后台静态资源 %s，请在 web 目录执行 npm run build 后复制 dist/admin",
        ADMIN_UI_DIR / "admin",
    )

if (ADMIN_UI_DIR / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(ADMIN_UI_DIR), html=True), name="site")
    logging.info("官网已挂载：/ -> %s", ADMIN_UI_DIR)
else:
    logging.warning("未找到官网静态资源 %s，请在 web 目录执行 npm run build 后复制 dist", ADMIN_UI_DIR)
