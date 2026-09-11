import logging
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

# ── Strict visibility logging ────────────────────────────────────────────────
# Guarantees OpenWeatherMap failures are VISIBLE in the uvicorn console
# instead of being silently swallowed and passed as None to the LLM prompt.
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )
logger = logging.getLogger("fastapi.weather")

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"

# Remediation hints per OpenWeatherMap HTTP status code
_STATUS_REMEDIATION = {
    400: "bad request — verify lat/lon parameters",
    401: "API key is INVALID or not yet activated (new keys take ~10-60 minutes) — "
    "put the real key in <project-root>/.env as OPENWEATHER_API_KEY=<key>",
    404: "resource/city not found — verify coordinates and the endpoint URL",
    429: "rate limit exceeded (free tier: 60 calls/minute) — add caching or slow down calls",
}


def _mask_key(key: str) -> str:
    """Never print the full API key; show only the last 4 characters."""
    return f"****{key[-4:]}" if key else "(not set)"


def _unavailable_payload(error: str) -> dict[str, Any]:
    """Standard 'weather unavailable' payload (always logged by the caller path)."""
    return {
        "source": "openweathermap",
        "available": False,
        "error": error,
        "current_temp": None,
        "humidity": None,
        "weather_condition": "Unavailable",
        "rainfall_1h": 0.0,
    }


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
        logger.error(
            "[Weather] OPENWEATHER_API_KEY is NOT CONFIGURED — live weather DISABLED. "
            "The LLM will receive 'Live weather unavailable' and the engine defaults to MODERATE. "
            "Fix: add OPENWEATHER_API_KEY=<your_key> to <project-root>/.env, then restart uvicorn."
        )
        return _unavailable_payload("OPENWEATHER_API_KEY is not configured.")

    params = {
        "lat": lat,
        "lon": lng,
        "appid": api_key,
        "units": "metric",
    }

    logger.info(
        "[Weather] Requesting OpenWeatherMap: GET %s | appid=%s | lat=%s | lon=%s | units=metric",
        OPENWEATHER_URL,
        _mask_key(api_key),
        lat,
        lng,
    )

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(OPENWEATHER_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        body_snippet = (exc.response.text or "").strip()[:300]
        remediation = _STATUS_REMEDIATION.get(
            status, "see https://openweathermap.org/faq for this status code"
        )
        logger.error(
            "[Weather] OpenWeatherMap API FAILURE — HTTP %s for (lat=%s, lon=%s) | "
            "response body: %s | remediation: %s",
            status,
            lat,
            lng,
            body_snippet,
            remediation,
        )
        return _unavailable_payload(
            f"OpenWeatherMap returned HTTP {status}. ({remediation})"
        )
    except Exception as exc:
        logger.error(
            "[Weather] OpenWeatherMap request FAILED (%s: %s) for (lat=%s, lon=%s) — "
            "likely network/DNS/timeout. Live weather disabled.",
            type(exc).__name__,
            exc,
            lat,
            lng,
        )
        return _unavailable_payload(f"OpenWeatherMap request failed: {exc}")

    main = data.get("main") or {}
    weather_items = data.get("weather") or []
    weather_condition = (
        weather_items[0].get("main")
        if weather_items and isinstance(weather_items[0], dict)
        else "Unknown"
    )

    payload = {
        "source": "openweathermap",
        "available": True,
        "current_temp": main.get("temp"),
        "humidity": main.get("humidity"),
        "weather_condition": weather_condition,
        "rainfall_1h": (data.get("rain") or {}).get("1h", 0.0),
        "wind_speed": (data.get("wind") or {}).get("speed"),
        "location_name": data.get("name"),
    }

    logger.info(
        "[Weather] OpenWeatherMap OK — HTTP 200 | temp=%s°C humidity=%s%% condition=%s "
        "rain_1h=%smm wind=%s m/s | station=%s",
        payload["current_temp"],
        payload["humidity"],
        payload["weather_condition"],
        payload["rainfall_1h"],
        payload["wind_speed"],
        payload["location_name"],
    )
    return payload