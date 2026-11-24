# 天气服务 - 和风天气API + Open-Meteo (智能提醒用)
import httpx
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Open-Meteo API (免费，无需 API Key)
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# 中国城市经纬度映射 (用于智能提醒)
CITY_COORDINATES = {
    "北京": (39.9042, 116.4074),
    "上海": (31.2304, 121.4737),
    "广州": (23.1291, 113.2644),
    "深圳": (22.5431, 114.0579),
    "杭州": (30.2741, 120.1551),
    "成都": (30.5728, 104.0668),
    "武汉": (30.5928, 114.3055),
    "西安": (34.3416, 108.9398),
    "南京": (32.0603, 118.7969),
    "重庆": (29.4316, 106.9123),
}


async def get_current_weather(location: str) -> Optional[Dict[str, Any]]:
    """获取当前位置天气 (用于智能提醒) - 使用 Open-Meteo"""
    coords = CITY_COORDINATES.get(location)
    if not coords:
        # 尝试用和风天气
        return await get_weather_for_smart_reminder(location)

    lat, lon = coords

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "timezone": "Asia/Shanghai"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(OPEN_METEO_URL, params=params, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                current = data.get("current", {})
                return {
                    "temperature": current.get("temperature_2m"),
                    "humidity": current.get("relative_humidity_2m"),
                    "precipitation": current.get("precipitation"),
                    "location": location,
                    "source": "open-meteo"
                }
        except Exception as e:
            logger.warning(f"Open-Meteo API error: {e}")

    return None


async def get_weather_for_smart_reminder(location: str) -> Optional[Dict[str, Any]]:
    """使用和风天气API获取天气 (智能提醒用)"""
    from app.core.system_config import get_config_value
    # 仅从数据库读取业务配置，不回退 .env；未配置时直接返回，不抛异常
    api_key = get_config_value("weather", "api_key")
    base_url = get_config_value("weather", "base_url") or HEFENG_BASE

    if not api_key:
        return None

    # 先通过城市名获取坐标
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo_url = "https://geoapi.qweather.com/v2/city/lookup"
            geo_params = {
                "location": location,
                "key": api_key
            }
            geo_resp = await client.get(geo_url, params=geo_params)
            if geo_resp.status_code == 200:
                geo_json = geo_resp.json()
                if geo_json.get("code") == "200" and geo_json.get("location"):
                    geo = geo_json["location"][0]
                    lat, lon = float(geo.get("lat", 0)), float(geo.get("lon", 0))
                else:
                    return None
            else:
                return None
    except Exception as e:
        logger.warning(f"获取城市坐标失败: {e}")
        return None

    # 获取天气
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            weather_url = f"{base_url}/weather/now"
            weather_params = {
                "location": f"{lon},{lat}",
                "key": api_key
            }
            weather_resp = await client.get(weather_url, params=weather_params)
            if weather_resp.status_code == 200:
                weather_json = weather_resp.json()
                now_data = weather_json.get("now", {})
                return {
                    "temperature": float(now_data.get("temp", 0)),
                    "humidity": float(now_data.get("humidity", 0)),
                    "precipitation": float(now_data.get("precip", 0)),
                    "location": location,
                    "source": "qweather"
                }
    except Exception as e:
        logger.warning(f"和风天气API error: {e}")

    return None


def get_watering_advice(weather: Dict[str, Any]) -> str:
    """获取浇水建议"""
    temp = weather.get("temperature") or weather.get("temp")
    humidity = weather.get("humidity")
    precipitation = weather.get("precipitation")

    tips = []

    if temp is not None:
        if temp > 35:
            tips.append("高温预警！建议今天浇水")
        elif temp > 30:
            tips.append("天气炎热，可提前浇水")
        elif temp < 5:
            tips.append("低温寒冷，减少浇水")

    if humidity is not None:
        if humidity > 80:
            tips.append("湿度较高，可延迟浇水")
        elif humidity < 30:
            tips.append("空气干燥，建议浇水")

    if precipitation and precipitation > 0:
        tips.append("有降雨，可适当延迟")

    return "；".join(tips) if tips else "天气适宜，按正常间隔浇水"

# 和风天气 API 内置默认地址（非敏感默认值，允许代码内置）
HEFENG_BASE = "https://devapi.qweather.com/v7"

# Open-Meteo 空气质量 API（免费，无需 Key）
OPEN_METEO_AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

# WMO 天气代码 → (中文描述, 和风天气图标代码)：Open-Meteo 降级时保持前端展示兼容
_WMO_MAP = {
    0: ("晴", 100), 1: ("多云", 101), 2: ("少云", 102), 3: ("阴", 104),
    45: ("雾", 501), 48: ("雾", 501),
    51: ("毛毛雨", 300), 53: ("毛毛雨", 300), 55: ("毛毛雨", 300),
    56: ("冻毛毛雨", 301), 57: ("冻毛毛雨", 301),
    61: ("小雨", 305), 63: ("中雨", 306), 65: ("大雨", 307),
    66: ("冻雨", 301), 67: ("冻雨", 301),
    71: ("小雪", 400), 73: ("中雪", 401), 75: ("大雪", 402), 77: ("雪粒", 400),
    80: ("小雨", 305), 81: ("中雨", 306), 82: ("大雨", 307),
    85: ("阵雪", 407), 86: ("阵雪", 407),
    95: ("雷阵雨", 302), 96: ("雷阵雨伴冰雹", 304), 99: ("雷阵雨伴冰雹", 304),
}

# 蒲福风级上限（km/h）
_BEAUFORT = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117]


def _wind_scale_km_h(speed: float) -> str:
    level = sum(1 for b in _BEAUFORT if speed > b)
    return f"{max(level, 0)}级"


async def _reverse_geocode(latitude: float, longitude: float, client: httpx.AsyncClient) -> str:
    """经纬度 → 中文地名（区县级），BigDataCloud 优先，Nominatim 兜底。"""
    headers = {"User-Agent": "flower-guardian/1.0"}
    # BigDataCloud 免费客户端接口，无需 Key，支持中文
    try:
        resp = await client.get(
            "https://api.bigdatacloud.net/data/reverse-geocode-client",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "localityLanguage": "zh",
            },
            headers=headers,
            timeout=8,
        )
        if resp.status_code == 200:
            d = resp.json()
            city = d.get("city") or d.get("locality") or d.get("principalSubdivision")
            if city:
                return city
    except Exception as e:
        logger.warning(f"BigDataCloud 逆地理编码失败: {e}")

    # OpenStreetMap Nominatim 兜底
    try:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": latitude,
                "lon": longitude,
                "format": "json",
                "accept-language": "zh",
                "zoom": 10,
            },
            headers=headers,
            timeout=8,
        )
        if resp.status_code == 200:
            addr = resp.json().get("address") or {}
            city = addr.get("city") or addr.get("town") or addr.get("county") or addr.get("state")
            if city:
                return city
    except Exception as e:
        logger.warning(f"Nominatim 逆地理编码失败: {e}")

    return "当前位置"


async def _open_meteo_weather(latitude: float, longitude: float) -> Dict[str, Any]:
    """Open-Meteo 免费天气源（无需 Key），作为和风天气不可用时的降级方案。"""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,uv_index_max",
        "timezone": "Asia/Shanghai",
        "forecast_days": 1,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(OPEN_METEO_URL, params=params)
        if resp.status_code != 200:
            raise Exception("Open-Meteo 获取天气数据失败")
        data = resp.json()

        current = data.get("current", {})
        daily = data.get("daily") or {}

        code = int(current.get("weather_code", 0) or 0)
        text, icon = _WMO_MAP.get(code, ("未知", ""))
        uv_list = daily.get("uv_index_max") or []
        uv = int(float(uv_list[0])) if uv_list else 0

        def _daily_first(key: str) -> float:
            vals = daily.get(key) or []
            return float(vals[0]) if vals else 0.0

        # 逆向地理编码取真实地名（失败不影响主流程）
        location = "当前位置"
        try:
            location = await _reverse_geocode(latitude, longitude, client)
        except Exception as e:
            logger.warning(f"获取地名失败: {e}")

        info = {
            "temp": int(float(current.get("temperature_2m", 0) or 0)),
            "tempMax": int(_daily_first("temperature_2m_max")),
            "tempMin": int(_daily_first("temperature_2m_min")),
            "humidity": int(float(current.get("relative_humidity_2m", 0) or 0)),
            "condition": text,
            "conditionIcon": str(icon),
            "airQuality": "未知",
            "uvIndex": uv,
            "windSpeed": _wind_scale_km_h(float(current.get("wind_speed_10m", 0) or 0)),
            "location": location,
        }

        # 空气质量（可选，失败不影响主流程）
        try:
            air = await client.get(
                OPEN_METEO_AIR_URL,
                params={"latitude": latitude, "longitude": longitude, "current": "us_aqi"},
            )
            if air.status_code == 200:
                aqi = (air.json().get("current") or {}).get("us_aqi")
                if aqi is not None:
                    info["airQuality"] = str(int(float(aqi)))
        except Exception as e:
            logger.warning(f"Open-Meteo 空气质量获取失败: {e}")

        logger.info(f"获取天气数据成功(Open-Meteo): {info.get('condition')}")
        return info


async def get_weather_data(latitude: float, longitude: float) -> Dict[str, Any]:
    """
    获取天气数据

    Args:
        latitude: 纬度
        longitude: 经度

    Returns:
        天气数据字典
    """
    # 仅从数据库读取业务配置，不回退 .env
    from app.core.system_config import get_config_value
    api_key = get_config_value("weather", "api_key")
    base_url = get_config_value("weather", "base_url") or HEFENG_BASE

    if not api_key:
        raise ValueError("天气 API 未配置，请在后台「系统配置 - 天气 API」中填写 API Key")

    # 先尝试和风天气；2025 改版后新账号必须使用控制台分配的专属 API Host，
    # 旧域名会返回 Invalid Host(403)，此时自动降级到 Open-Meteo 免费源
    try:
        return await _qweather_weather(latitude, longitude, api_key, base_url)
    except Exception as e:
        logger.warning(f"和风天气不可用，降级 Open-Meteo: {e}")

    return await _open_meteo_weather(latitude, longitude)


async def _qweather_weather(latitude: float, longitude: float, api_key: str, base_url: str) -> Dict[str, Any]:
    """和风天气数据获取（保留原逻辑，供配置了专属 API Host 的账号使用）"""
    # 先调用地理编码API获取城市名称
    location_name = "未知"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo_url = "https://geoapi.qweather.com/v2/city/lookup"
            geo_params = {
                "location": f"{longitude},{latitude}",
                "key": api_key
            }
            geo_resp = await client.get(geo_url, params=geo_params)
            if geo_resp.status_code == 200:
                geo_json = geo_resp.json()
                if geo_json.get("code") == "200" and geo_json.get("location"):
                    location_name = geo_json["location"][0].get("name", "未知")
    except Exception as e:
        logger.warning(f"获取城市名称失败: {e}")

    async with httpx.AsyncClient(timeout=10.0) as client:
        weather_url = f"{base_url}/weather/now"
        weather_params = {
            "location": f"{longitude},{latitude}",
            "key": api_key
        }
        weather_resp = await client.get(weather_url, params=weather_params)

        if weather_resp.status_code != 200:
            raise Exception("获取天气数据失败")

        weather_json = weather_resp.json()
        now_data = weather_json.get("now", {})

        # 获取空气质量
        air_url = f"{base_url}/air/now"
        air_resp = await client.get(air_url, params=weather_params)
        air_data = air_resp.json().get("now", {}) if air_resp.status_code == 200 else {}

        # 获取每日预报（包含最高最低温度）
        daily_url = f"{base_url}/weather/7d"
        daily_resp = await client.get(daily_url, params=weather_params)
        daily_data = daily_resp.json().get("daily", [])[0] if daily_resp.status_code == 200 else {}

        # 构造天气数据
        weather_info = {
            "temp": int(now_data.get("temp", 0)),
            "tempMax": int(daily_data.get("tempMax", 0)),
            "tempMin": int(daily_data.get("tempMin", 0)),
            "humidity": int(now_data.get("humidity", 0)),
            "condition": now_data.get("text", "未知"),
            "conditionIcon": now_data.get("icon", ""),
            "airQuality": air_data.get("aqi", air_data.get("category", "未知")),
            "uvIndex": int(now_data.get("uvIndex", 0)),
            "windSpeed": now_data.get("windScale", "未知") + "级",
            "location": location_name
        }

        logger.info(f"获取天气数据成功: {weather_info.get('location')}")
        return weather_info
