 

import asyncio
import datetime
import json
import math
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Optional

# ── Console encoding guard ───────────────────────────────────────────────────
# Windows redirects (Docker logs, CI, Start-Process redirection) fall back to a
# cp1252 codepage where characters like ↳ ─ ═ crash every print() with
# UnicodeEncodeError. Force UTF-8 (with replacement) so diagnostics can never
# kill the server.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False
    Groq = None

import httpx
import numpy as np
import pymongo
try:
    import certifi
    HAS_CERTIFI = True
except ImportError:
    HAS_CERTIFI = False
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from utils.weather import get_live_weather


# Load .env from the parent directory
__dirname = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(os.path.dirname(__dirname), '.env'))
load_dotenv(os.path.join(__dirname, '.env'))

# Groq client initialization
GROQ_API_KEY = (os.getenv("GROQ_API_KEY") or "").strip()
groq_client = None
if HAS_GROQ and GROQ_API_KEY:
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception as _e:
        print(f"Warning: Failed to initialize Groq client: {_e}")

NODE_API_URL = os.getenv("NODE_API_URL", "http://localhost:5055/api")
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
# ══════════════════════════════════════════════════════════════════════════════
# ── STARTUP ENV DIAGNOSTICS (surfaced loudly in the uvicorn console) ──────────
# ══════════════════════════════════════════════════════════════════════════════

def _mask_secret(value: str) -> str:
    """Never print a full secret; show only its last 4 characters."""
    return f"****{value[-4:]}" if value else "(not set)"


def _log_key_startup_diagnostics() -> None:
    """Verify critical env vars exist at startup instead of failing silently later."""
    openweather_key = (os.getenv("OPENWEATHER_API_KEY") or "").strip()
    if not openweather_key:
        print("=" * 100)
        print("[CRITICAL][Startup] OPENWEATHER_API_KEY is MISSING/EMPTY in environment!")
        print(
            "  > Live OpenWeatherMap data is DISABLED — /predict-risk will answer "
            "MODERATE with no weather context."
        )
        print(
            "  > Fix: add OPENWEATHER_API_KEY=<your_key> to <project-root>/.env "
            "(free key: openweathermap.org), then restart uvicorn."
        )
        print("=" * 100)
    elif openweather_key.lower().startswith("your_") or openweather_key.lower().endswith("_here"):
        print("=" * 100)
        print(
            f"[CRITICAL][Startup] OPENWEATHER_API_KEY is still the PLACEHOLDER value "
            f"({_mask_secret(openweather_key)})."
        )
        print(
            "  ↳ Replace it with a real key from openweathermap.org in <project-root>/.env, "
            "then restart uvicorn."
        )
        print("=" * 100)
    else:
        print(
            f"[Startup] OPENWEATHER_API_KEY configured ({_mask_secret(openweather_key)}) "
            "— live weather ENABLED."
        )

    if not GROQ_API_KEY:
        print(
            "[WARNING][Startup] GROQ_API_KEY missing — predictive LLM disabled; "
            "deterministic fallback will be used."
        )
    elif GROQ_API_KEY.lower().startswith("your_") or GROQ_API_KEY.lower().endswith("_here"):
        print(
            f"[CRITICAL][Startup] GROQ_API_KEY is still the PLACEHOLDER value "
            f"({_mask_secret(GROQ_API_KEY)}) — replace it with a real key from "
            "console.groq.com in <project-root>/.env, then restart uvicorn."
        )
    else:
        print(
            f"[Startup] GROQ_API_KEY configured ({_mask_secret(GROQ_API_KEY)}) "
            "— predictive LLM ENABLED."
        )


_log_key_startup_diagnostics()


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SmartLogistics NER — AI Microservice",
    description="Deep Learning risk prediction, RAG assistant, A* routing, and agentic loop for SIH26002.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

 

NER_GRAPH: dict[str, dict] = {
    "guwahati":  {"coord": [26.1445, 91.7362], "edges": {"shillong": 1.0, "silchar": 1.2, "dibrugarh": 1.0}},
    "shillong":  {"coord": [25.5788, 91.8933], "edges": {"guwahati": 1.0, "silchar": 1.1, "imphal": 1.3}},
    "silchar":   {"coord": [24.8333, 92.7789], "edges": {"guwahati": 1.2, "shillong": 1.1, "agartala": 1.0, "aizawl": 1.2}},
    "agartala":  {"coord": [23.8315, 91.2868], "edges": {"silchar": 1.0}},
    "aizawl":    {"coord": [23.7271, 92.7176], "edges": {"silchar": 1.2, "imphal": 1.1}},
    "imphal":    {"coord": [24.817,  93.9368], "edges": {"shillong": 1.3, "aizawl": 1.1, "kohima": 1.0}},
    "kohima":    {"coord": [25.6751, 94.1086], "edges": {"imphal": 1.0, "itanagar": 1.4}},
    "itanagar":  {"coord": [27.0844, 93.6053], "edges": {"guwahati": 1.1, "kohima": 1.4, "dibrugarh": 1.2}},
    "dibrugarh": {"coord": [27.4728, 94.912],  "edges": {"guwahati": 1.0, "itanagar": 1.2}},
    "gangtok":   {"coord": [27.3389, 88.6065], "edges": {"guwahati": 1.3}},
}


def _haversine(a: list[float], b: list[float]) -> float:
    R = 6371.0
    lat1, lng1 = math.radians(a[0]), math.radians(a[1])
    lat2, lng2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _astar(start: str, goal: str, blocked: set[str] | None = None) -> dict | None:
    if start not in NER_GRAPH or goal not in NER_GRAPH:
        return None
    if start == goal:
        return {"path": [start], "total_km": 0.0}
    blocked = blocked or set()
    open_set: dict[str, dict] = {start: {"g": 0.0, "f": _haversine(NER_GRAPH[start]["coord"], NER_GRAPH[goal]["coord"]), "parent": None}}
    closed: dict[str, str | None] = {}
    while open_set:
        current = min(open_set, key=lambda k: open_set[k]["f"])
        if current == goal:
            path: list[str] = []
            node: str | None = current
            while node:
                path.insert(0, node)
                node = open_set.get(node, {}).get("parent") or closed.get(node)
            total_km = sum(_haversine(NER_GRAPH[path[i]]["coord"], NER_GRAPH[path[i + 1]]["coord"]) for i in range(len(path) - 1))
            return {"path": path, "total_km": round(total_km, 2)}
        state = open_set.pop(current)
        closed[current] = state["parent"]
        for neighbour, risk_mult in NER_GRAPH[current].get("edges", {}).items():
            if neighbour in closed or f"{current}:{neighbour}" in blocked:
                continue
            edge_km = _haversine(NER_GRAPH[current]["coord"], NER_GRAPH[neighbour]["coord"])
            tentative_g = state["g"] + edge_km * risk_mult
            existing = open_set.get(neighbour)
            if not existing or tentative_g < existing["g"]:
                open_set[neighbour] = {
                    "g": tentative_g,
                    "f": tentative_g + _haversine(NER_GRAPH[neighbour]["coord"], NER_GRAPH[goal]["coord"]),
                    "parent": current,
                }
    return None


def _nearest_node(lat: float, lng: float) -> str:
    return min(NER_GRAPH, key=lambda k: _haversine([lat, lng], NER_GRAPH[k]["coord"]))


def _path_to_coords(path: list[str]) -> list[list[float]]:
    return [NER_GRAPH[k]["coord"] for k in path if k in NER_GRAPH]


# ══════════════════════════════════════════════════════════════════════════════
# ── DEEP LEARNING RISK MODEL ──────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

# Learned weights (NER monsoon calibration)
_W = np.array([
    0.031,   # windspeed
    0.018,   # precipitation
    0.008,   # weathercode
    -0.004,  # temperature (negative: heat reduces risk)
    0.005,   # relative humidity
    0.25,    # historical bias
], dtype=np.float64)

_BIAS = -2.1


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _compute_risk_score(weather: dict, hist_bias: float = 0.0) -> tuple[float, str]:
    """Returns (risk_score, risk_level)."""
    windspeed   = min(float(weather.get("windspeed", weather.get("wind_speed_10m", 0))) / 80.0, 1.0)
    precip      = min(float(weather.get("rain", weather.get("precipitation", 0))) / 200.0, 1.0)
    wcode       = min(float(weather.get("weathercode", weather.get("weather_code", 0))) / 100.0, 1.0)
    temperature = min(max(float(weather.get("temperature", weather.get("temperature_2m", 25))), 0.0) / 50.0, 1.0)
    humidity    = min(float(weather.get("relativehumidity_2m", weather.get("relative_humidity_2m", 60))) / 100.0, 1.0)
    h_bias      = min(float(hist_bias), 1.0)

    # Unnormalise for weight computation (mirrors JS service)
    features = np.array([
        windspeed * 80,
        precip * 200,
        wcode * 100,
        temperature * 50,
        humidity * 100,
        h_bias,
    ], dtype=np.float64)

    z = _BIAS + float(np.dot(_W, features))
    score = _sigmoid(z)

    if score >= 0.65:
        level = "high"
    elif score >= 0.35:
        level = "moderate"
    else:
        level = "low"

    return round(score, 4), level


_CONDITION_TO_WMO_CODE = {
    "clear": 0,
    "clouds": 2,
    "drizzle": 53,
    "rain": 63,
    "snow": 73,
    "thunderstorm": 95,
    "mist": 45,
    "fog": 45,
    "haze": 45,
    "smoke": 45,
    "dust": 45,
    "sand": 45,
    "ash": 45,
    "squall": 82,
    "tornado": 99,
}

# WMO weather interpretation codes (Open-Meteo `current_weather.weathercode`)
_WMO_CONDITIONS = {
    0: "Clear",
    1: "Mostly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime Fog",
    51: "Light Drizzle",
    53: "Drizzle",
    55: "Heavy Drizzle",
    61: "Light Rain",
    63: "Rain",
    65: "Heavy Rain",
    66: "Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Light Snow",
    73: "Snow",
    75: "Heavy Snow",
    77: "Snow Grains",
    80: "Rain Showers",
    81: "Heavy Rain Showers",
    82: "Violent Rain Showers",
    85: "Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Hail",
    99: "Heavy Thunderstorm with Hail",
}


def _normalize_openweather_for_model(weather: dict) -> dict:
    """Convert OpenWeatherMap fields into the existing numerical model field names."""
    condition = str(weather.get("weather_condition") or "").strip().lower()
    estimated_code = _CONDITION_TO_WMO_CODE.get(condition, 3 if condition else 0)
    return {
        "temperature": weather.get("current_temp") or 25,
        "relativehumidity_2m": weather.get("humidity") or 60,
        "precipitation": weather.get("rainfall_1h") or 0,
        "rain": weather.get("rainfall_1h") or 0,
        "windspeed": weather.get("wind_speed") or 0,
        "weathercode": estimated_code,
    }


def _normalize_client_weather(weather: Optional[dict]) -> dict[str, Any]:
    """
    Normalize third-party weather payloads (e.g. the Node.js proxy's Open-Meteo
    `current_weather`) into the OpenWeatherMap-shaped dict used by the prompt.

    Fixes the silent 'Live weather unavailable' bug: the Node proxy passes
    `{temperature, windspeed, weathercode, ...}` WITHOUT an `available` flag,
    which previously shadowed the server-side OpenWeatherMap fetch entirely
    (`req.weather or await get_live_weather(...)` — truthy dict wins).
    """
    if not isinstance(weather, dict) or not weather:
        return {}

    current_temp = weather.get("current_temp", weather.get("temperature"))
    if current_temp is None:
        return {}

    code = weather.get("weathercode")
    condition = (
        weather.get("weather_condition")
        or (_WMO_CONDITIONS.get(code) if code is not None else None)
        or "Unknown"
    )

    return {
        "source": weather.get("source") or "open-meteo (Node proxy)",
        "available": True,
        "current_temp": current_temp,
        "humidity": weather.get("humidity", weather.get("relative_humidity_2m")),
        "weather_condition": condition,
        "rainfall_1h": weather.get("rainfall_1h", weather.get("rain") or 0),
        "wind_speed": weather.get("wind_speed", weather.get("windspeed")),
        "location_name": weather.get("location_name"),
    }


def _format_live_weather(weather: dict) -> str:
    """Format live weather data for compact LLM prompt injection."""
    if not weather.get("available"):
        return f"Live weather unavailable ({weather.get('error', 'unknown error')})."

    humidity = weather.get("humidity")
    humidity_text = f"{humidity}%" if humidity is not None else "n/a"
    wind = weather.get("wind_speed")
    wind_text = f"{wind} m/s" if wind is not None else "n/a"

    return (
        f"Temperature: {weather.get('current_temp')}°C; "
        f"Humidity / soil-moisture proxy: {humidity_text}; "
        f"Condition: {weather.get('weather_condition')}; "
        f"Rainfall last 1 hour: {weather.get('rainfall_1h', 0)} mm; "
        f"Wind speed: {wind_text}; "
        f"Nearest station/name: {weather.get('location_name') or 'unknown'}."
    )


def _build_predictive_prompt(historical_rag_data: str, live_weather_data: str) -> str:
    return (
        "You are an AI Predictive Analytics Engine for Disaster Management. "
        "Based on the historical vulnerability of this region: "
        f"{historical_rag_data} "
        "AND the LIVE weather conditions: "
        f"{live_weather_data}, "
        "predict the current risk level (Low, Moderate, High) for floods/landslides. "
        "Provide a brief 2-sentence justification. "
        "Return ONLY valid JSON in this schema: "
        '{"risk_level":"LOW|MODERATE|HIGH","justification":"two concise sentences"}.'
    )


def _parse_risk_prediction(text: str) -> dict[str, str]:
    """Parse LLM output into a stable risk payload."""
    cleaned = (text or "").strip()
    if not cleaned:
        return {}

    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.MULTILINE).strip()

    try:
        parsed = json.loads(cleaned)
        risk_level = str(parsed.get("risk_level") or parsed.get("riskLevel") or "").upper()
        justification = str(parsed.get("justification") or parsed.get("reason") or "").strip()
        if risk_level in {"LOW", "MODERATE", "HIGH"} and justification:
            return {"risk_level": risk_level, "justification": justification}
    except Exception:
        pass

    level_match = re.search(r"\b(high|moderate|medium|low)\b", cleaned, flags=re.IGNORECASE)
    risk_level = level_match.group(1).upper() if level_match else "MODERATE"
    if risk_level == "MEDIUM":
        risk_level = "MODERATE"
    return {"risk_level": risk_level, "justification": cleaned[:600]}


async def _call_predictive_llm(system_prompt: str) -> dict[str, str]:
    """Call Groq/Qwen for predictive analytics; return parsed risk payload."""
    groq_key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not groq_key:
        raise RuntimeError("GROQ_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {groq_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "qwen/qwen3.8-27b",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Evaluate the current disaster risk for these coordinates now."},
        ],
        "temperature": 0.2,
        "max_tokens": 220,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    parsed = _parse_risk_prediction(content)
    if not parsed:
        raise RuntimeError("LLM response could not be parsed")
    return parsed


def _fallback_predictive_response(
    weather: dict,
    historical_context: str,
    historical_bias: float = 0.7,
    city_label: str = "Silchar",
) -> dict[str, Any]:
    """Deterministic fallback when LLM/API keys are unavailable."""
    if weather.get("available"):
        print(
            "[Fallback] LLM unavailable — deterministic weather+RAG scoring WITH live weather data "
            f"({weather.get('source')}, {weather.get('weather_condition')})."
        )
    else:
        print("[Fallback][WARNING] " + "=" * 60)
        print(
            "[Fallback][WARNING] LLM unavailable AND live weather UNAVAILABLE — "
            "scoring with DEFAULTS (temp=25°C, humidity=60%)."
        )
        print(f"[Fallback][WARNING] Weather error was: {weather.get('error', 'unknown')}")
        print(
            "[Fallback][WARNING] Fix the [Weather] errors above to restore accurate live scoring."
        )
        print("[Fallback][WARNING] " + "=" * 60)

    normalized_weather = _normalize_openweather_for_model(weather)
    score, level = _compute_risk_score(normalized_weather, historical_bias)

    condition = str(weather.get("weather_condition") or "unknown").lower()
    rainfall = float(weather.get("rainfall_1h") or 0)
    humidity = float(weather.get("humidity") or 0)
    context_lower = historical_context.lower()

    if rainfall >= 10 or "rain" in condition or (humidity >= 88 and "flood" in context_lower):
        level = "high"
        score = max(score, 0.72)
    elif rainfall >= 2.5 or humidity >= 80:
        level = "moderate" if level == "low" else level
        score = max(score, 0.45)

    if "itanagar" in city_label.lower() or "papum" in context_lower:
        hazard_notes = (
            f"Local {city_label} records identify repeated monsoon landslides on "
            "NH-415 (Karsingsa), Jollang Road, and Dikrong/Pachin floodplain overflow, "
            "so response teams should monitor slope-adjacent and river-bank routes."
        )
    else:
        hazard_notes = (
            "Historical Silchar/Barak Valley records identify repeated flooding, "
            "embankment breach, and corridor disruption patterns, so response teams "
            "should monitor vulnerable low-lying and slope-adjacent routes."
        )

    level_upper = level.upper()
    if weather.get("available"):
        justification = (
            f"The current live weather shows {weather.get('weather_condition', 'unknown conditions')} with "
            f"{rainfall} mm rainfall in the last hour and {humidity}% humidity, which increases flood/landslide sensitivity. "
            f"{hazard_notes}"
        )
    else:
        justification = (
            "Live weather data is currently unavailable "
            f"({weather.get('error', 'OpenWeatherMap fetch failed — see server console')}), "
            "so this assessment relies on historical Silchar/Barak Valley vulnerability records only. "
            f"{hazard_notes} "
            "Restore OPENWEATHER_API_KEY in .env to re-enable live meteorological input."
        )
    return {"risk_level": level_upper, "justification": justification, "risk_score": round(score, 4)}


# ══════════════════════════════════════════════════════════════════════════════
# ── RAG PIPELINE & KNOWLEDGE BASE ─────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SILCHAR_HISTORY_FILE = os.path.join(DATA_DIR, "silchar_history.txt")

NER_LOC_COORDS: dict[str, tuple[float, float]] = {
    "jatinga": (25.1320, 93.0310),
    "lampur": (25.1320, 93.0310),
    "dima hasao": (25.1320, 93.0310),
    "lumding": (25.7500, 93.1700),
    "badarpur": (24.9000, 92.6000),
    "dihaku": (25.2910, 93.1820),
    "mupa": (25.2910, 93.1820),
    "jamira": (24.3120, 92.6510),
    "bairabi": (24.1870, 92.5360),
    "katakhal": (24.7800, 92.7300),
    "berenga": (24.8120, 92.7910),
    "betukandi": (24.8120, 92.7910),
    "silchar": (24.8333, 92.7789),
    "guwahati": (26.1445, 91.7362),
    "shillong": (25.5788, 91.8933),
    "imphal": (24.8170, 93.9368),
    "aizawl": (23.7271, 92.7176),
    "agartala": (23.8315, 91.2868),
    "kohima": (25.6751, 94.1086),
    "itanagar": (27.0844, 93.6053),
    "dibrugarh": (27.4728, 94.9120),
    "gangtok": (27.3389, 88.6065),
}


def _resolve_loc_coords(loc_text: str) -> tuple[float, float]:
    lt = str(loc_text).lower()
    for key, coords in NER_LOC_COORDS.items():
        if key in lt:
            return coords
    return (24.8333, 92.7789)


def _get_mongo_db():
    uri = (os.getenv("MONGODB_URI") or "").strip()
    if not uri:
        return None
    client_kwargs = {
        "serverSelectionTimeoutMS": 15000,
        "connectTimeoutMS": 15000,
    }
    if HAS_CERTIFI:
        try:
            client_kwargs["tlsCAFile"] = certifi.where()
        except Exception as e:
            print(f"Warning: Failed to set certifi tlsCAFile: {e}")
    try:
        client = pymongo.MongoClient(uri, **client_kwargs)
        try:
            return client.get_database()
        except Exception:
            return client["disaster-management"]
    except Exception as exc:
        print(f"Error connecting to MongoDB: {exc}")
        return None


def _read_slichar_file() -> tuple[str, str]:
    """Locates and reads the slichar.txt file. Returns (raw_content, resolved_path)."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(base_dir)
    possible_paths = [
        os.path.join(base_dir, "slichar.txt"),
        os.path.join(base_dir, "data", "slichar.txt"),
        os.path.join(root_dir, "slichar.txt"),
        os.path.join(base_dir, "data", "silchar_history.txt"),
        os.path.join(base_dir, "silchar.txt"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        return content, p
            except Exception as e:
                print(f"Error reading {p}: {e}")
    return "", ""


def _fallback_parse_slichar(text: str) -> list[dict]:
    """Deterministic fallback parser for slichar.txt incidents."""
    incidents = []
    lines = [line.strip().lstrip("-•* ") for line in text.split("\n") if line.strip()]
    for line in lines:
        if "historical disaster data" in line.lower():
            continue
        inc_type = "other"
        l_lower = line.lower()
        if "landslide" in l_lower:
            inc_type = "landslide"
        elif "flood" in l_lower or "embankment" in l_lower or "breach" in l_lower:
            inc_type = "flood"
        elif "erosion" in l_lower or "washout" in l_lower or "track" in l_lower:
            inc_type = "roadblock"
        elif "drainage" in l_lower or "blockage" in l_lower:
            inc_type = "flooding"

        severity = "high"
        if "critical" in l_lower or "cut off" in l_lower or "epicenter" in l_lower:
            severity = "critical"
        elif "moderate" in l_lower or "minor" in l_lower:
            severity = "medium"

        if ":" in line:
            parts = line.split(":", 1)
            date_str = parts[0].strip()
            desc = parts[1].strip()
        else:
            date_str = "Recent"
            desc = line

        loc = "Silchar, Assam"
        if "jatinga" in l_lower or "lampur" in l_lower or "dima hasao" in l_lower:
            loc = "Jatinga Lampur Area, Dima Hasao"
        elif "dihaku" in l_lower or "mupa" in l_lower:
            loc = "Dihaku and Mupa Stations, KM 51/2-3"
        elif "jamira" in l_lower or "bairabi" in l_lower:
            loc = "Jamira (Assam) to Bairabi (Mizoram) Section"
        elif "berenga" in l_lower or "betukandi" in l_lower:
            loc = "Berenga Betukandi Area, Silchar"
        elif "highway" in l_lower or "flyover" in l_lower:
            loc = "National Highway 4-lane Corridor, Silchar"

        incidents.append({
            "type": inc_type,
            "location": loc,
            "severity": severity,
            "date": date_str,
            "description": desc,
        })
    return incidents


def _load_silchar_history() -> str:
    """Reads the hyper-local historical disaster knowledge base for Silchar and NER."""
    content, _ = _read_slichar_file()
    if content:
        return content
    if os.path.exists(SILCHAR_HISTORY_FILE):
        try:
            with open(SILCHAR_HISTORY_FILE, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception as e:
            pass
    return ""
    return ""


# ── City-Aware Knowledge Base Loading (Itanagar / Silchar / etc.) ─────────────
# Loads per-city disaster text files (e.g. ITANAGAR.TXT, Itanagar_disaster.txt)
# into the RAG context window, searching both the `data/` and `db/` folders
# case-insensitively. Falls back to the legacy Silchar corpus if none found.


def _find_city_history_files(city: str) -> list[str]:
    """Return absolute paths of per-city text files for the given city."""
    city_key = (city or "").lower()
    base_dir = os.path.dirname(os.path.abspath(__file__))
    search_dirs = [
        DATA_DIR,
        os.path.join(base_dir, "db"),
        os.path.join(base_dir, "data"),
    ]
    found: list[str] = []
    seen: set[str] = set()
    for d in dict.fromkeys(search_dirs):  # dedupe while preserving order
        if not os.path.isdir(d):
            continue
        try:
            for name in sorted(os.listdir(d)):
                lower = name.lower()
                if lower.endswith(".txt") and city_key in lower:
                    path = os.path.join(d, name)
                    if path not in seen:
                        seen.add(path)
                        found.append(path)
        except Exception as e:
            print(f"Error scanning knowledge dir {d}: {e}")
    return found


def _load_city_history(city: str) -> str:
    """Load and concatenate all per-city disaster text files into one context."""
    files = _find_city_history_files(city)
    if files:
        parts = []
        for f in files:
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    content = fh.read().strip()
                    if content:
                        parts.append(
                            f"===== {os.path.basename(f)} =====\n{content}"
                        )
            except Exception as e:
                print(f"Error reading city history {f}: {e}")
        if parts:
            return "\n\n".join(parts)
    # No city-specific file found → fall back to the legacy Silchar corpus.
    return _load_silchar_history()


def _resolve_city_for_coords(lat: float, lng: float) -> str:
    """Return the nearest known city key for the given coordinates."""
    best_key = "silchar"
    best_dist = float("inf")
    for key, (clat, clng) in NER_LOC_COORDS.items():
        dist = math.hypot(lat - clat, lng - clng)
        if dist < best_dist:
            best_dist = dist
            best_key = key
    return best_key


def _context_confidence_score(context: str, city: str, lat: float, lng: float) -> float:
    """Heuristic confidence that local RAG context is sufficient (0.0 - 1.0)."""
    if not context:
        return 0.0
    lower = context.lower()
    score = 0.0

    # City name mentioned in the local context.
    city_tokens = [t for t in re.split(r"[^a-z]+", city.lower()) if t]
    if city_tokens and any(tok in lower for tok in city_tokens):
        score += 0.4

    # Hazard-relevant keywords present.
    hazard_kws = [
        "landslide", "flood", "floodplain", "hazard", "monsoon",
        "landslip", "river", "mudslide", "inundation",
    ]
    hits = sum(1 for kw in hazard_kws if kw in lower)
    score += min(0.4, hits * 0.1)

    # Coordinate proximity mentioned.
    if f"{float(lat):.2f}" in lower or f"{float(lng):.2f}" in lower:
        score += 0.2

    # Length signal: a very short context is weak.
    if len(context) < 300:
        score -= 0.2

    return min(max(score, 0.0), 1.0)
    return min(max(score, 0.0), 1.0)


# ── Web Search Fallback (official government sources) ─────────────────────────
# If the local Itanagar .txt context is too thin, augment the LLM prompt with
# snippets from an official-source web search (DuckDuckGo HTML results parsed
# with BeautifulSoup when available, else a lightweight regex fallback).


def _strip_html(text: str) -> str:
    """Remove HTML tags/entities from a raw snippet string (regex fallback)."""
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"&[a-zA-Z#0-9]+;", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _duckduckgo_search(query: str, max_results: int = 5) -> list[dict]:
    """Lightweight DuckDuckGo HTML search. Returns [{"title","snippet","url"}]."""
    results: list[dict] = []
    try:
        response = httpx.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; NERDisasterManagement/1.0; "
                    "+http://localhost)"
                )
            },
            timeout=12.0,
            follow_redirects=True,
        )
        response.raise_for_status()
        html = response.text
    except Exception as exc:
        print(f"[WebFallback] DuckDuckGo search error: {exc}")
        return results

    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        for result in soup.select("div.result")[:max_results]:
            title_el = result.select_one("a.result__a")
            snippet_el = result.select_one("a.result__snippet")
            url_el = result.select_one(".result__url")
            title = _strip_html(title_el.get_text()) if title_el else ""
            snippet = _strip_html(snippet_el.get_text()) if snippet_el else ""
            url = url_el.get_text(strip=True) if url_el else None
            if title or snippet:
                results.append(
                    {"title": title, "snippet": snippet, "url": url}
                )
    except ImportError:
        # Regex fallback when BeautifulSoup is unavailable.
        titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', html)[:max_results]
        snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', html)[:max_results]
        for title_m, snip_m in zip(titles, snippets):
            results.append(
                {
                    "title": _strip_html(title_m),
                    "snippet": _strip_html(snip_m),
                    "url": None,
                }
            )

    return results


def _official_source_search(city: str) -> tuple[bool, str]:
    """Search official government sources for hazard zones. Returns (found, text)."""
    query = (
        f"{city} official government landslide hazard zones "
        "NDMA ASDMA Arunachal Pradesh flood"
    )
    try:
        results = _duckduckgo_search(query, max_results=5)
    except Exception as exc:
        print(f"[WebFallback] search raised: {exc}")
        return False, ""

    if not results:
        return False, ""

    lines = ["[WEB SEARCH FALLBACK — OFFICIAL GOVERNMENT SOURCES]"]
    for r in results:
        title = r.get("title") or ""
        snippet = r.get("snippet") or ""
        url = r.get("url") or ""
        combined = f"- {title}: {snippet}"
        if url:
            combined += f" ({url})"
        lines.append(combined.strip())
    return True, "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# ── REQUEST / RESPONSE MODELS ─────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class PredictRiskRequest(BaseModel):
    lat: float
    lng: float
    city: Optional[str] = None
    weather: Optional[dict] = None
    historical_bias: float = Field(default=0.7, ge=0.0, le=1.0)


class RagQueryRequest(BaseModel):
    question: Optional[str] = None
    query: Optional[str] = None
    context: Optional[str] = None
    incident_count: int = 0


class GraphRouteRequest(BaseModel):
    origin: str
    destination: str
    blocked_edges: list[str] = []


class AgenticLoopRequest(BaseModel):
    incident: dict
    fetch_weather: bool = True


# ══════════════════════════════════════════════════════════════════════════════
# ── ENDPOINTS ─────────────────────────────────════════════════════════════════
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"service": "SmartLogistics NER FastAPI AI Service", "status": "running", "version": "2.0.0"}


@app.get("/health")
def health():
    return {"status": "ok", "ts": time.time()}


@app.post("/predict-risk")
async def predict_risk(req: PredictRiskRequest):
    """
    AI/ML predictive analytics endpoint.
    Combines live OpenWeatherMap data with a city-aware historical RAG context
    (e.g. Itanagar / Silchar .txt knowledge base) and Groq/Qwen prompt
    engineering to predict flood/landslide risk. When the local context is too
    thin, it augments the LLM with an official government web-search fallback.
    """
    # ── Weather resolution ────────────────────────────────────────────────────
    # Prefer client-injected weather ONLY when it carries real metrics.
    # Fixes the shadow bug: the Node.js proxy passes Open-Meteo payloads without
    # an `available` flag, which previously made this endpoint skip the live
    # OpenWeatherMap fetch entirely and report 'Live weather unavailable'.
    client_weather = _normalize_client_weather(req.weather)
    if client_weather:
        live_weather = client_weather
        print(
            f"[predict-risk] Using client-injected weather payload "
            f"(source: {live_weather.get('source')}, temp: {live_weather.get('current_temp')}°C, "
            f"condition: {live_weather.get('weather_condition')})."
        )
    else:
        if req.weather:
            print(
                "[predict-risk] Client weather payload had NO usable metrics — "
                "fetching fresh OpenWeatherMap data server-side."
            )
        live_weather = await get_live_weather(req.lat, req.lng)

    # 1. Resolve which city knowledge base to use (explicit city → nearest coords).
    raw_city = (req.city or "").strip().lower()
    city = raw_city or _resolve_city_for_coords(req.lat, req.lng)
    city_label = city.replace("_", " ").title()

    raw_history = _load_city_history(city)

    # 2. Heuristic confidence in the local Itanagar .txt context.
    confidence = _context_confidence_score(raw_history, city, req.lat, req.lng)

    # 3. If local context is insufficient, fall back to official government web search.
    web_fallback_used = False
    web_sources: list[str] = []
    if confidence < 0.5:
        found, web_text = _official_source_search(city_label)
        if found:
            web_fallback_used = True
            raw_history = f"{raw_history}\n\n{web_text}"
            # Capture just the source URLs for transparency in the response.
            web_sources = [
                line for line in web_text.splitlines()
                if "(" in line and "http" in line
            ]

    retrieval_query = (
        f"{city_label} landslide flood hazard zones monsoon "
        "Dikrong Papum Pare NDMA ASDMA"
    )
    historical_context = _retrieve_top_chunks(
        raw_history,
        retrieval_query,
        top_k=4,
        max_chars=9000,
    )
    live_weather_text = _format_live_weather(live_weather)
    system_prompt = _build_predictive_prompt(historical_context, live_weather_text)

    # ── DEBUG: verify live weather data actually reached the LLM prompt ──────
    weather_available = bool(live_weather.get("available"))
    weather_in_prompt = live_weather_text in system_prompt
    print("-" * 100)
    print(
        f"[predict-risk] coords=({req.lat}, {req.lng}) | "
        f"weather_available={weather_available} | source={live_weather.get('source')}"
    )
    print(f"[predict-risk] live_weather_text -> {live_weather_text}")
    print(
        f"[predict-risk] weather string present in final prompt: {weather_in_prompt} "
        f"| prompt length: {len(system_prompt)} chars"
    )
    print("[predict-risk] FINAL LLM PROMPT:")
    print(system_prompt)
    print("-" * 100)
    if not weather_available:
        print(
            "[WARNING][predict-risk] NO live weather data in the prompt — the engine will "
            "default to MODERATE. Fix the [Weather] errors logged above."
        )

    prediction_source = "groq-qwen-live-weather-rag"
    risk_score = None

    try:
        prediction = await _call_predictive_llm(system_prompt)
    except Exception as exc:
        print(
            f"[predict-risk][WARNING] LLM call failed ({exc}) — deterministic fallback engaged "
            f"(weather_available={weather_available})."
        )
        prediction = _fallback_predictive_response(
            live_weather,
            historical_context,
            historical_bias=req.historical_bias or 0.7,
            city_label=city_label,
        )
        prediction_source = "deterministic-weather-rag-fallback"
        risk_score = prediction.get("risk_score")

    risk_level = str(prediction.get("risk_level", "MODERATE")).upper()
    if risk_level == "MEDIUM":
        risk_level = "MODERATE"
    if risk_level not in {"LOW", "MODERATE", "HIGH"}:
        risk_level = "MODERATE"

    return {
        "lat": req.lat,
        "lng": req.lng,
        "city": city_label,
        "risk_level": risk_level,
        "riskLevel": risk_level.lower(),
        "justification": prediction.get("justification", "Risk evaluated using live weather and historical vulnerability context."),
        "weather_used": live_weather,
        "historical_context_preview": historical_context[:700],
        "prompt_preview": system_prompt[:1200],
        "risk_score": risk_score,
        "model": prediction_source,
        "context_confidence": round(confidence, 3),
        "web_fallback_used": web_fallback_used,
        "web_sources": web_sources,
    }


@app.post("/evaluate-risk")
async def evaluate_risk(req: PredictRiskRequest):
    """Compatibility endpoint for clients that call POST /evaluate-risk."""
    return await predict_risk(req)


def _retrieve_top_chunks(full_text: str, query: str, top_k: int = 3, max_chars: int = 10000) -> str:
    """Clamps RAG retrieval to top 2-3 most relevant chunks and ensures <= max_chars."""
    if not full_text:
        return ""
    if len(full_text) <= max_chars:
        return full_text

    # Split into sections by date or double newline
    chunks = [c.strip() for c in re.split(r'\n(?=Date:|\d{4}-\d{2}-\d{2}|\b[A-Z][a-z]+ \d{1,2}, \d{4})|\n\n+', full_text) if c.strip()]
    if not chunks:
        return full_text[:max_chars]

    query_words = set(re.findall(r'\w+', query.lower())) - {"the", "a", "an", "is", "in", "at", "to", "for", "of", "and", "or"}
    scored = []
    for idx, c in enumerate(chunks):
        c_words = set(re.findall(r'\w+', c.lower()))
        score = len(query_words.intersection(c_words))
        scored.append((score, idx, c))

    # Sort primarily by keyword matches, secondarily preserving most recent chunks
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    top_chunks = [c for _, _, c in scored[:top_k]]
    combined = "\n\n---\n\n".join(top_chunks)
    if len(combined) > max_chars:
        combined = combined[:max_chars] + "\n\n[Context truncated to fit token limits]"
    return combined


@app.post("/rag-query")
async def rag_query(req: RagQueryRequest):
    """
    RAG-powered logistics & disaster management assistant with True Streaming (SSE / Chunked).
    Reads context from slichar.txt, queries Groq with stream=True,
    and returns token-by-token chunks using FastAPI's StreamingResponse.
    """
    user_query = (req.question or req.query or "").strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="question or query cannot be empty")

    # 1. Inspect & Clamp RAG Document Retrieval (top 2-3 chunks maximum, <= 10000 chars)
    # Blend the Itanagar knowledge base with the legacy Silchar corpus so the
    # assistant can answer about the newly-supported capital city too.
    if req.context:
        raw_content = req.context
    else:
        itanagar_context = _load_city_history("itanagar")
        silchar_context = _load_silchar_history()
        raw_content = "\n\n".join(
            part for part in (itanagar_context, silchar_context) if part
        ) or ""
    file_content = _retrieve_top_chunks(raw_content, user_query, top_k=3, max_chars=10000)

    system_prompt = (
        "You are 'Logi-Assistant', a highly advanced, professional, and empathetic Logistics & Disaster Management AI "
        "for the North East Region (NER).\n\n"
        f"LOCAL KNOWLEDGE BASE (Your primary source of truth):\n{file_content}\n\n"
        "CRITICAL INSTRUCTIONS FOR YOUR BEHAVIOR:\n"
        "1. Act as the intelligent bridge between the user and the regional disaster data.\n"
        "2. ANALYZE AND LEARN: Read the Local Knowledge Base deeply. Look for specific metrics, patterns, limits "
        "(e.g., 85% rainfall thresholds, 19.83m river danger levels, specific blocked highways like NH-6, landslides at Jatinga Lampur, breaches at Berenga Betukandi).\n"
        "3. BLEND KNOWLEDGE: Extract exact facts from the Local Knowledge Base, and combine those facts with your general "
        "logistics knowledge to give a rich, complete, and conversational answer.\n"
        "4. CONVERSATIONAL TONE: Never say 'According to the file' or 'The text says'. Speak like an experienced emergency operations controller.\n"
        "5. GENERAL QUERIES: If the user says 'Hi' or asks general logistics questions, answer naturally and professionally.\n"
        "6. NO CODE: Never output raw code blocks or JSON unless specifically requested. Use beautiful Markdown formatting with bullet points and bold highlights."
    )

    # 2. Hard Character Clamping on system_prompt (staying under ~3,500 tokens / 14,000 chars)
    MAX_CONTEXT_CHARS = 14000
    if len(system_prompt) > MAX_CONTEXT_CHARS:
        system_prompt = system_prompt[:MAX_CONTEXT_CHARS] + "\n\n[Context truncated to fit token limits]"

    # 3. Add Token Length Debugging
    estimated_tokens = (len(system_prompt) + len(user_query)) // 4
    print(f"DEBUG-INPUT-SIZE: ~{estimated_tokens} tokens ({len(system_prompt)} chars)")

    groq_key = (os.getenv("GROQ_API_KEY") or "").strip()

    async def token_generator():
        print("DEBUG: Generator started")
        if not groq_key:
            print("DEBUG-TOKEN: [MISSING GROQ_API_KEY]")
            yield "⚠️ **Groq API Key Missing:** Please add `GROQ_API_KEY=your_key_here` to your `.env` file to enable ultra-fast streaming."
            return

        headers = {
            "Authorization": f"Bearer {groq_key}",
            "Content-Type": "application/json",
        }
        # 4. Ensure Output Limit (800 tokens max, well below 1000 limit)
        payload = {
            "model": "qwen/qwen3.8-27b",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query},
            ],
            "temperature": 0.3,
            "max_tokens": 800,
            "stream": True,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                ) as resp:
                    if resp.status_code != 200:
                        error_bytes = await resp.aread()
                        error_text = error_bytes.decode("utf-8", errors="replace")
                        print(f"DEBUG-GROQ-ERROR: {error_text}")
                        yield f"⚠️ **Groq API Error ({resp.status_code}):** {error_text}"
                        return

                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            raw_data = line[6:].strip()
                            if raw_data == "[DONE]":
                                break
                            try:
                                chunk_json = json.loads(raw_data)
                                delta = chunk_json.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if delta:
                                    print(f"DEBUG-TOKEN: '{delta}'")
                                    yield delta
                            except Exception as parse_err:
                                pass
        except Exception as e:
            print(f"DEBUG-FATAL-CRASH: {str(e)}")
            yield f"\n\n⚠️ **Groq Streaming Error:** {str(e)}"

    return StreamingResponse(
        token_generator(),
        media_type="text/plain; charset=utf-8",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.post("/sync-data-to-db")
async def sync_data_to_db():
    """
    Reads slichar.txt, uses Google Gemini (genai.GenerativeModel) to parse unstructured incident logs
    into a strict JSON array of incidents (fields: type, location, severity, date, description),
    and synchronises them into MongoDB 'incidents' collection (and 'incidentreports' collection
    so the frontend dashboard incident counter updates automatically).
    """
    raw_text, file_path = _read_slichar_file()
    if not raw_text:
        raise HTTPException(
            status_code=404,
            detail="slichar.txt file could not be found or is empty."
        )

    parsed_incidents: list[dict] = []
    llm_parser_used = None

    parse_prompt = (
        "You are an expert disaster data extraction engine.\n"
        "Parse the following unstructured disaster incident records and convert them into a strict JSON array of objects.\n"
        "Each incident object in the array MUST contain EXACTLY these fields:\n"
        "- type: string, must be one of ['landslide', 'flood', 'flooding', 'roadblock', 'other']\n"
        "- location: string, the specific location, area, corridor, or station mentioned\n"
        "- severity: string, one of ['low', 'medium', 'high', 'critical']\n"
        "- date: string, the date, month, or year of the incident\n"
        "- description: string, clear summary of what occurred\n\n"
        "CRITICAL: Return ONLY the raw JSON array. Do not wrap in markdown code blocks, backticks, or add any commentary.\n\n"
        f"UNSTRUCTURED TEXT:\n{raw_text}"
    )

    gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            for model_name in ["gemini-3.6-flash", "gemini-flash-latest", "gemini-1.5-flash"]:
                try:
                    m = genai.GenerativeModel(model_name)
                    res = await m.generate_content_async(parse_prompt)
                    if res and hasattr(res, "text") and res.text:
                        text_res = res.text.strip()
                        if text_res.startswith("```"):
                            lines = text_res.split("\n")
                            if lines[0].startswith("```"):
                                lines = lines[1:]
                            if lines and lines[-1].startswith("```"):
                                lines = lines[:-1]
                            text_res = "\n".join(lines).strip()
                        data = json.loads(text_res)
                        if isinstance(data, list) and len(data) > 0:
                            parsed_incidents = data
                            llm_parser_used = f"google-gemini ({model_name})"
                            break
                except Exception as m_err:
                    print(f"Gemini parsing attempt ({model_name}) error: {m_err}")
                    continue
        except Exception as exc:
            print(f"Gemini configuration error during sync: {exc}")

    if not parsed_incidents:
        parsed_incidents = _fallback_parse_slichar(raw_text)
        llm_parser_used = "deterministic-rule-parser"

    # Connect to MongoDB
    db = _get_mongo_db()
    if db is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to connect to MongoDB. Please check MONGODB_URI."
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    synced_count = 0

    valid_types = {"landslide", "flood", "flooding", "roadblock", "other"}
    valid_severities = {"low", "medium", "high", "critical"}

    for inc in parsed_incidents:
        raw_type = str(inc.get("type", "other")).lower().strip()
        itype = raw_type if raw_type in valid_types else "other"

        raw_sev = str(inc.get("severity", "medium")).lower().strip()
        isev = raw_sev if raw_sev in valid_severities else "medium"

        raw_loc = inc.get("location", "Silchar, Assam")
        loc_str = raw_loc if isinstance(raw_loc, str) else str(raw_loc.get("address", "Silchar, Assam"))
        lat, lng = _resolve_loc_coords(loc_str)

        description = str(inc.get("description", "")).strip()
        date_str = str(inc.get("date", "")).strip()

        # Document for 'incidents' collection (Phase 2 primary requirement)
        incident_doc = {
            "type": itype,
            "location": loc_str,
            "severity": isev,
            "date": date_str,
            "description": description,
            "status": "active",
            "updatedAt": now,
        }

        # Document for 'incidentreports' collection (Mongoose model queried by /api/dashboard/stats and /api/incidents)
        report_doc = {
            "type": itype,
            "title": f"{itype.capitalize()} at {loc_str}",
            "description": description,
            "severity": isev,
            "location": {
                "lat": lat,
                "lng": lng,
                "address": loc_str,
            },
            "status": "active",
            "updatedAt": now,
        }

        filter_q = {"description": description} if description else {"location": loc_str, "date": date_str}

        # 1. Update/insert in 'incidents' collection
        db["incidents"].update_one(
            filter_q,
            {"$set": incident_doc, "$setOnInsert": {"createdAt": now}},
            upsert=True
        )

        # 2. Update/insert in 'incidentreports' collection
        db["incidentreports"].update_one(
            filter_q,
            {"$set": report_doc, "$setOnInsert": {"createdAt": now, "reportedBy": None}},
            upsert=True
        )

        synced_count += 1

    return {
        "status": "success",
        "message": f"Successfully parsed and synced {synced_count} incidents to MongoDB.",
        "incidents_added": synced_count,
        "count": synced_count,
        "collection": "incidents",
        "source_file": os.path.basename(file_path),
        "parser": llm_parser_used,
        "incidents": parsed_incidents,
        "timestamp": time.time(),
    }


@app.post("/graph-route")
def graph_route(req: GraphRouteRequest):
    """
    A* pathfinding over the NER city graph.
    """
    origin = req.origin.lower().strip()
    destination = req.destination.lower().strip()
    blocked = set(req.blocked_edges)

    result = _astar(origin, destination, blocked)
    if not result:
        raise HTTPException(status_code=404, detail=f"No route found between '{origin}' and '{destination}'")

    return {
        "origin": origin,
        "destination": destination,
        "path": result["path"],
        "total_km": result["total_km"],
        "coordinates": _path_to_coords(result["path"]),
        "algorithm": "A*",
    }


@app.post("/agentic-loop")
async def agentic_loop(req: AgenticLoopRequest):
    """
    Full autonomous pipeline:
      Incident data → Live weather fetch → DL risk score → A* alternate route → Broadcast payload
    """
    incident = req.incident
    lat: float | None = incident.get("location", {}).get("lat")
    lng: float | None = incident.get("location", {}).get("lng")

    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="incident.location.lat and .lng are required")

    # Step 1: Weather
    weather: dict = {}
    if req.fetch_weather:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(OPEN_METEO_URL, params={"latitude": lat, "longitude": lng, "current_weather": "true"})
                resp.raise_for_status()
                weather = resp.json().get("current_weather", {})
        except Exception:
            pass

    # Step 2: DL risk prediction
    risk_score, risk_level = _compute_risk_score(weather)

    # Step 3: A* alternate route
    nearest = _nearest_node(lat, lng)
    route_result = _astar(nearest, "guwahati")
    alt_coords = _path_to_coords(route_result["path"]) if route_result else []
    alt_km = route_result["total_km"] if route_result else None

    # Step 4: Bilingual alert messages
    inc_type = incident.get("type", "hazard")
    type_hindi = {
        "landslide": "भूस्खलन", "flood": "बाढ़", "flooding": "बाढ़",
        "roadblock": "सड़क अवरोध"
    }.get(inc_type, "आपदा")

    msg_en = (
        f"⚠️ {risk_level.upper()} RISK ALERT: {inc_type.capitalize()} reported near "
        f"({lat:.4f}, {lng:.4f}). Please follow alternate route immediately."
    )
    msg_hi = f"⚠️ {type_hindi} की सूचना मिली है। कृपया तुरंत वैकल्पिक मार्ग अपनाएं।"

    return {
        "incident_id": incident.get("_id"),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "weather_used": weather,
        "nearest_node": nearest,
        "alternate_route": {
            "path": route_result["path"] if route_result else [],
            "coordinates": alt_coords,
            "total_km": alt_km,
        },
        "broadcast_payload": {
            "riskLevel": risk_level,
            "riskScore": risk_score,
            "incidentType": inc_type,
            "message": msg_en,
            "messageHindi": msg_hi,
            "alternateRouteCoordinates": alt_coords,
            "alternateRouteKm": alt_km,
            "triggeredAt": time.time(),
        },
        "pipeline": "agentic-loop-v2",
    }


# ══════════════════════════════════════════════════════════════════════════════
# ── SILCHAR LIVE WEATHER + 2-DAY FORECAST  ────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

SILCHAR_LAT = 24.82
SILCHAR_LON = 92.80
RAIN_PROBABILITY_THRESHOLD = 50  # %

# WMO Weather Interpretation Codes → human-readable label + emoji
# https://open-meteo.com/en/docs#weathervariables
_WMO_LABELS: dict[int, tuple[str, str]] = {
    0:  ("Clear Sky",              "☀️"),
    1:  ("Mainly Clear",           "🌤️"),
    2:  ("Partly Cloudy",          "⛅"),
    3:  ("Overcast",               "☁️"),
    45: ("Fog",                    "🌫️"),
    48: ("Icy Fog",                "🌫️"),
    51: ("Light Drizzle",          "🌦️"),
    53: ("Moderate Drizzle",       "🌦️"),
    55: ("Heavy Drizzle",          "🌧️"),
    61: ("Slight Rain",            "🌧️"),
    63: ("Moderate Rain",          "🌧️"),
    65: ("Heavy Rain",             "🌧️"),
    66: ("Freezing Rain",          "🌨️"),
    67: ("Heavy Freezing Rain",    "🌨️"),
    71: ("Slight Snowfall",        "❄️"),
    73: ("Moderate Snowfall",      "❄️"),
    75: ("Heavy Snowfall",         "❄️"),
    77: ("Snow Grains",            "❄️"),
    80: ("Slight Rain Showers",    "🌦️"),
    81: ("Moderate Rain Showers",  "🌧️"),
    82: ("Heavy Rain Showers",     "⛈️"),
    85: ("Slight Snow Showers",    "🌨️"),
    86: ("Heavy Snow Showers",     "🌨️"),
    95: ("Thunderstorm",           "⛈️"),
    96: ("Thunderstorm + Hail",    "⛈️"),
    99: ("Thunderstorm + Heavy Hail", "⛈️"),
}


def _wmo_info(code: int) -> tuple[str, str]:
    """Return (label, emoji) for a WMO weather code, with a safe fallback."""
    return _WMO_LABELS.get(code, ("Unknown", "🌡️"))


def _is_rainy_code(code: int) -> bool:
    """Return True if the WMO code represents any rain/storm condition."""
    return code in {
        51, 53, 55, 61, 63, 65, 66, 67,
        80, 81, 82, 95, 96, 99,
    }


@app.get("/api/weather/silchar")
async def get_silchar_weather():
    """
    Fetches live weather + 2-day forecast for Silchar, Assam from Open-Meteo.

    Returns:
        - current: temperature_2m, weather_code, condition label, emoji
        - forecast: list of next 2 days with date, max precipitation probability,
                    daily weather code, condition, emoji
        - rain_expected_in_next_48h: True if any day in next 2 has precip_prob > 50 %
                                     OR current WMO code is a rain code
        - risk_advisory: human-readable flood risk message
        - fetched_at: Unix timestamp
    """
    open_meteo_url = (
        f"{OPEN_METEO_URL}"
        f"?latitude={SILCHAR_LAT}"
        f"&longitude={SILCHAR_LON}"
        f"&current=temperature_2m,weather_code"
        f"&daily=precipitation_probability_max,weather_code,temperature_2m_max,temperature_2m_min"
        f"&timezone=auto"
        f"&forecast_days=3"
    )

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(open_meteo_url)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Open-Meteo API timed out. Please retry.")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Open-Meteo returned HTTP {exc.response.status_code}",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Weather fetch failed: {str(exc)}")

    # ── Parse current conditions ──────────────────────────────────────────────
    current_raw   = data.get("current", {})
    current_temp  = current_raw.get("temperature_2m")
    current_code  = current_raw.get("weather_code", 0)
    current_label, current_emoji = _wmo_info(current_code)

    # ── Parse daily forecast (skip index 0 = today) ───────────────────────────
    daily       = data.get("daily", {})
    dates       = daily.get("time", [])
    precip_probs = daily.get("precipitation_probability_max", [])
    daily_codes  = daily.get("weather_code", [])
    max_temps    = daily.get("temperature_2m_max", [])
    min_temps    = daily.get("temperature_2m_min", [])

    forecast: list[dict] = []
    rain_days: list[str] = []

    # Indices 1 and 2 = Day 1 and Day 2 (index 0 = today, already covered by current)
    for i in range(1, min(3, len(dates))):
        prob  = precip_probs[i] if i < len(precip_probs) else 0
        code  = daily_codes[i]  if i < len(daily_codes)  else 0
        label, emoji = _wmo_info(code)
        t_max = max_temps[i] if i < len(max_temps) else None
        t_min = min_temps[i] if i < len(min_temps) else None
        rain_risk = prob > RAIN_PROBABILITY_THRESHOLD or _is_rainy_code(code)

        entry = {
            "date":                    dates[i],
            "day_label":               f"Day {i}",
            "weather_code":            code,
            "condition":               label,
            "emoji":                   emoji,
            "precipitation_probability": prob,
            "rain_risk":               rain_risk,
            "temp_max_c":              t_max,
            "temp_min_c":              t_min,
        }
        forecast.append(entry)
        if rain_risk:
            rain_days.append(dates[i])

    # ── Aggregate flag ────────────────────────────────────────────────────────
    current_is_rainy = _is_rainy_code(current_code)
    rain_expected_in_next_48h = bool(rain_days) or current_is_rainy

    # ── Risk advisory message ─────────────────────────────────────────────────
    if current_is_rainy and rain_days:
        advisory = (
            "Active rainfall NOW + rain forecast ahead. "
            "HIGH FLOOD RISK on Silchar corridors. Reroute all NER shipments immediately."
        )
    elif current_is_rainy:
        advisory = (
            "Active rainfall in Silchar. Monitor closely — "
            "short-term flood risk elevated on surrounding routes."
        )
    elif rain_days:
        days_str = " and ".join(rain_days)
        advisory = (
            f"Rain forecast on {days_str} (>{RAIN_PROBABILITY_THRESHOLD}% probability). "
            "Pre-emptively review routes via Silchar. Flood risk elevated."
        )
    else:
        advisory = (
            "No significant rain expected in the next 48 hours. "
            "Silchar corridors currently safe for operations."
        )

    return {
        "location": {
            "city":      "Silchar",
            "state":     "Assam",
            "country":   "India",
            "latitude":  SILCHAR_LAT,
            "longitude": SILCHAR_LON,
        },
        "current": {
            "temperature_c":  current_temp,
            "weather_code":   current_code,
            "condition":      current_label,
            "emoji":          current_emoji,
            "is_raining_now": current_is_rainy,
        },
        "forecast":                  forecast,
        "rain_expected_in_next_48h": rain_expected_in_next_48h,
        "rain_days":                 rain_days,
        "risk_advisory":             advisory,
        "fetched_at":                time.time(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ── HAZARD ZONES (FLOOD & LANDSLIDE HIGH-RISK AREAS) ───────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

HAZARD_ZONES_FILE = os.path.join(DATA_DIR, "hazard_zones.json")


def _load_hazard_zones_data() -> dict:
    if os.path.exists(HAZARD_ZONES_FILE):
        try:
            with open(HAZARD_ZONES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading hazard_zones.json: {e}")
    return {}


@app.get("/api/hazard-zones/{city_name}")
def get_city_hazard_zones(city_name: str):
    """
    Returns government-designated high-risk areas (flood/landslide) with polygon coordinates
    for the requested city: Silchar, Aizawl, Itanagar, or Guwahati.
    """
    data = _load_hazard_zones_data()
    # Normalize city_name (e.g. "Silchar, Assam" -> "silchar")
    normalized = city_name.strip().lower().split(",")[0].strip()

    if normalized not in data:
        # Check partial match
        matched_key = next((k for k in data if k in normalized or normalized in k), None)
        if matched_key:
            normalized = matched_key

    if normalized not in data:
        raise HTTPException(
            status_code=404,
            detail=f"Hazard zones not found for '{city_name}'. Available cities: {', '.join(data.keys())}",
        )

    city_data = data[normalized]
    return {
        "status": "success",
        "city": city_data.get("city", normalized.capitalize()),
        "state": city_data.get("state", "NER"),
        "center": city_data.get("center"),
        "zoom": city_data.get("zoom", 13),
        "hazard_zones": city_data.get("hazard_zones", []),
        "zones": city_data.get("hazard_zones", []),
    }


@app.get("/api/hazard-zones")
def get_all_hazard_zones():
    """Returns hazard zones dictionary for all supported cities."""
    return _load_hazard_zones_data()
if __name__ == "__main__":
    import os
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
