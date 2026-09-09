import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


CURRENT_DIR = Path(__file__).resolve().parent
FASTAPI_DIR = CURRENT_DIR.parent
PROJECT_ROOT = FASTAPI_DIR.parent

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(FASTAPI_DIR / ".env")

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"


async def get_live_weather(lat: float, lng: float) -> dict[str, Any]:
    """
    Fetch live weather metrics from OpenWeatherMap for AI disaster-risk prediction.

    Returns normalized fields used by the predictive engine:
    - current_temp: Celsius
    - humidity: percentage, used as a soil-moisture proxy
    - weather_condition: e.g. Rain, Clear, Clouds
    - rainfall_1h: millimeters in the last hour, if reported
    """
    api_key = (os.getenv("OPENWEATHER_API_KEY") or "").strip()
    if not api_key:
        return {
            "source": "openweathermap",
            "available": False,
            "error": "OPENWEATHER_API_KEY is not configured.",
            "current_temp": None,
            "humidity": None,
            "weather_condition": "Unavailable",
            "rainfall_1h": 0.0,
        }

    params = {
        "lat": lat,
        "lon": lng,
        "appid": api_key,
        "units": "metric",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(OPENWEATHER_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        return {
            "source": "openweathermap",
            "available": False,
            "error": f"OpenWeatherMap returned HTTP {exc.response.status_code}.",
            "current_temp": None,
            "humidity": None,
            "weather_condition": "Unavailable",
            "rainfall_1h": 0.0,
        }
    except Exception as exc:
        return {
            "source": "openweathermap",
            "available": False,
            "error": f"OpenWeatherMap request failed: {exc}",
            "current_temp": None,
            "humidity": None,
            "weather_condition": "Unavailable",
            "rainfall_1h": 0.0,
        }

    main = data.get("main") or {}
    weather_items = data.get("weather") or []
    weather_condition = (
        weather_items[0].get("main")
        if weather_items and isinstance(weather_items[0], dict)
        else "Unknown"
    )

    return {
        "source": "openweathermap",
        "available": True,
        "current_temp": main.get("temp"),
        "humidity": main.get("humidity"),
        "weather_condition": weather_condition,
        "rainfall_1h": (data.get("rain") or {}).get("1h", 0.0),
        "wind_speed": (data.get("wind") or {}).get("speed"),
        "location_name": data.get("name"),
    }