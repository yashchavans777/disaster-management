"""
Smart Logistics Platform — FastAPI AI Microservice
===================================================
Provides five AI/data endpoints for the SIH26002 prototype:

  POST /predict-risk      — Deep Learning sigmoid risk predictor
  POST /rag-query         — RAG-powered admin assistant (retrieves incidents, generates answer)
  POST /graph-route       — A* pathfinding over the NER city graph
  POST /agentic-loop      — Full autonomous pipeline: incident → DL → route → broadcast payload
  GET  /api/weather/silchar — Live weather + 2-day forecast for Silchar, Assam (Open-Meteo, no key)

All endpoints degrade gracefully if upstream services (Open-Meteo, Node.js API) are unavailable.
"""

import asyncio
import math
import os
import time
from pathlib import Path
from typing import Any, Optional

import google.generativeai as genai
import httpx
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load .env from the parent directory
__dirname = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(os.path.dirname(__dirname), '.env'))
load_dotenv(os.path.join(__dirname, '.env'))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as _e:
        print(f"Warning: Failed to configure Google Generative AI SDK: {_e}")

NODE_API_URL = os.getenv("NODE_API_URL", "http://localhost:5055/api")
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SmartLogistics NER — AI Microservice",
    description="Deep Learning risk prediction, RAG assistant, A* routing, and agentic loop for SIH26002.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5055"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# ── NER GRAPH (mirrors gis.service.js) ────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════════════════════════════
# ── RAG PIPELINE & KNOWLEDGE BASE ─────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SILCHAR_HISTORY_FILE = os.path.join(DATA_DIR, "silchar_history.txt")


def _load_silchar_history() -> str:
    """Reads the hyper-local historical disaster knowledge base for Silchar and NER."""
    if os.path.exists(SILCHAR_HISTORY_FILE):
        try:
            with open(SILCHAR_HISTORY_FILE, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception as e:
            print(f"Error reading silchar_history.txt: {e}")
    return ""


def _answer_from_silchar_context(question: str, context: str) -> str:
    """Accurately answers queries using the Silchar historical knowledge base."""
    q = question.lower()
    matches = []

    if any(w in q for w in ["jatinga", "lampur", "dima hasao", "lumding", "badarpur", "boulder"]):
        matches.append("• June-July 2025: Massive landslides at Jatinga Lampur Area (Dima Hasao) blocked the Lumding-Badarpur hill section with large boulders.")

    if any(w in q for w in ["dihaku", "mupa", "51/2", "kilometer 51", "cut off", "tripura", "mizoram rail"]):
        matches.append("• July 2025: Landslide between Dihaku and Mupa Stations (Kilometer 51/2-3) cut off Silchar, Tripura, and Mizoram.")

    if any(w in q for w in ["jamira", "bairabi", "katakhal", "washout", "soil erosion"]):
        matches.append("• September 2026: Soil erosion and track washout occurred on the Jamira (Assam) to Bairabi (Mizoram) section (Katakhal-Bairabi stretch) due to heavy rain.")

    if any(w in q for w in ["flood", "barak", "embankment", "breach", "berenga", "betukandi", "epicenter"]):
        matches.append("• 2022-2024 (Recurring): Major floods in Silchar are caused by Barak River embankment breaches, specifically at the Berenga Betukandi Area (The Epicenter).")

    if any(w in q for w in ["highway", "drainage", "flyover", "urban flood", "4-lane", "construction", "water flow"]):
        matches.append("• 2026 Status: National Highway cross-drainage blockages due to 4-lane highway and flyover construction have stopped natural water flow, causing prolonged urban flooding near highways.")

    if any(w in q for w in ["landslide", "landslides", "hills"]):
        if not any("Jatinga" in m for m in matches):
            matches.append("• June-July 2025: Massive landslides at Jatinga Lampur Area (Dima Hasao) blocked the Lumding-Badarpur hill section with large boulders.")
        if not any("Dihaku" in m for m in matches):
            matches.append("• July 2025: Landslide between Dihaku and Mupa Stations (Kilometer 51/2-3) cut off Silchar, Tripura, and Mizoram.")

    if matches:
        return (
            "Here is what the historical disaster records show regarding your query:\n\n"
            + "\n\n".join(matches)
            + "\n\n💡 Logistics Advisory: If routing relief shipments through these sectors, make sure to verify bridge and rail clearances with local control rooms, as heavy rainfall can trigger rapid reactivation of these vulnerabilities."
        )

    if any(w in q for w in ["silchar", "history", "disaster", "past", "historical", "overview", "what happened"]):
        return (
            "Hello! Here is a summary of the major recorded disaster incidents and critical logistical bottlenecks in Silchar and the NER region:\n\n"
            + context
            + "\n\n💡 Operations Tip: These corridors are particularly vulnerable during the monsoon season (May to September). Continuous weather monitoring and alternate route planning are strongly recommended."
        )

    if any(w in q for w in ["hi", "hello", "hey", "who are you", "what can you do"]):
        return (
            "Hello! I am Logi-Assistant, your intelligent AI companion for the North East Region Disaster Management & Smart Logistics platform. "
            "I can assist you with real-time route risk assessments, historical flood & landslide analyses across Silchar and the NER, vehicle dispatch tracking, and emergency logistics planning. How can I help you today?"
        )

    if any(w in q for w in ["useful", "why", "platform", "purpose", "features"]):
        return (
            "This Smart Logistics & Disaster Management platform (SIH26002) is designed to ensure uninterrupted relief supplies across the challenging terrain of North East India. "
            "It combines real-time IoT vehicle tracking, A* terrain routing, AI-driven weather and flood risk prediction, and hyper-local city boundary monitoring to keep drivers and rescue teams safe."
        )

    return ""


def _build_rag_answer(question: str, incidents: list[dict], context: str) -> str:
    """Rule-based RAG answer generator. Mirrors ai.controller.js local fallback."""
    q = question.lower()
    total = len(incidents)

    if total == 0:
        return "No recent incidents found in the database to answer your question."

    by_type: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for inc in incidents:
        by_type[inc.get("type", "other")] = by_type.get(inc.get("type", "other"), 0) + 1
        by_severity[inc.get("severity", "medium")] = by_severity.get(inc.get("severity", "medium"), 0) + 1
        by_status[inc.get("status", "reported")] = by_status.get(inc.get("status", "reported"), 0) + 1

    if "roadblock" in q or "road block" in q or "block" in q:
        count = by_type.get("roadblock", 0)
        return (f"There are {count} roadblock incident(s) in the last {total} reports. "
                + ("Affected routes should be flagged for rerouting." if count > 0 else "No active roadblocks detected."))

    if "flood" in q:
        count = by_type.get("flood", 0) + by_type.get("flooding", 0)
        return (f"{count} flooding incident(s) reported recently. "
                + ("Critical: Multiple flood zones detected. Rerouting recommended." if count > 2 else "Situation appears manageable."))

    if "landslide" in q:
        count = by_type.get("landslide", 0)
        return (f"{count} landslide incident(s) in recent data. "
                "Landslides are highest risk for Guwahati–Shillong and Kohima corridors during monsoon.")

    if any(k in q for k in ["high", "critical", "severe", "urgent"]):
        high = by_severity.get("high", 0) + by_severity.get("critical", 0)
        return (f"{high} high/critical severity incidents in the last {total} reports. "
                f"Breakdown — High: {by_severity.get('high', 0)}, Critical: {by_severity.get('critical', 0)}, "
                f"Medium: {by_severity.get('medium', 0)}.")

    if any(k in q for k in ["status", "unresolved", "active", "open"]):
        unresolved = by_status.get("active", 0) + by_status.get("reported", 0) + by_status.get("verified", 0)
        return (f"{unresolved} of the last {total} incidents remain unresolved. "
                f"{by_status.get('resolved', 0)} resolved.")

    # Generic summary
    top_type = max(by_type, key=by_type.get) if by_type else "unknown"
    return (
        f"Summary of last {total} incidents: Most common type is '{top_type}' ({by_type.get(top_type, 0)} reports). "
        f"Severity — High: {by_severity.get('high', 0)}, Medium: {by_severity.get('medium', 0)}, "
        f"Low: {by_severity.get('low', 0)}, Critical: {by_severity.get('critical', 0)}. "
        f"Status — Active: {by_status.get('active', 0)}, Reported: {by_status.get('reported', 0)}, "
        f"Resolved: {by_status.get('resolved', 0)}."
    )


# ══════════════════════════════════════════════════════════════════════════════
# ── REQUEST / RESPONSE MODELS ─────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class PredictRiskRequest(BaseModel):
    lat: float
    lng: float
    weather: Optional[dict] = None
    historical_bias: float = Field(default=0.0, ge=0.0, le=1.0)


class RagQueryRequest(BaseModel):
    question: str
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
    Deep Learning sigmoid risk predictor.
    Fetches live weather from Open-Meteo if not supplied in the request body.
    """
    weather = req.weather or {}

    if not weather:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    OPEN_METEO_URL,
                    params={
                        "latitude": req.lat,
                        "longitude": req.lng,
                        "current_weather": "true",
                        "hourly": "relativehumidity_2m,precipitation",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                weather = data.get("current_weather", {})
                # Attach first hourly values
                hourly = data.get("hourly", {})
                weather["relativehumidity_2m"] = (hourly.get("relativehumidity_2m") or [60])[0]
                weather["precipitation"] = (hourly.get("precipitation") or [0])[0]
        except Exception as exc:
            weather = {}  # degrade gracefully

    risk_score, risk_level = _compute_risk_score(weather, req.historical_bias)

    return {
        "lat": req.lat,
        "lng": req.lng,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "weather_used": weather,
        "model": "DL-sigmoid-v2",
        "weights": _W.tolist(),
    }


@app.post("/rag-query")
async def rag_query(req: RagQueryRequest):
    """
    RAG-powered admin assistant powered by Google Gemini SDK.
    Reads data/silchar_history.txt as context, queries Google Gemini (gemini-1.5-flash),
    and falls back gracefully to deterministic local synthesis if GEMINI_API_KEY is unset.
    """
    user_query = req.question.strip()
    if not user_query or len(user_query) < 3:
        raise HTTPException(status_code=400, detail="question must be at least 3 characters")

    # Read context from data/silchar_history.txt
    silchar_history = _load_silchar_history()

    # Construct highly flexible conversational prompt:
    prompt = (
        "You are 'Logi-Assistant', a helpful and intelligent AI companion for a Logistics & Disaster Management platform in the North East Region (NER).\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. You must answer EVERY question the user asks intelligently and conversationally.\n"
        f"2. If the user's question is about historical floods or landslides in Silchar, incorporate this specific context: {silchar_history}\n"
        "3. If the user asks about ANYTHING ELSE (e.g., weather, general knowledge, why this platform is useful, greetings, or random questions), use your vast general knowledge to provide a highly relevant, helpful, and friendly answer.\n"
        "4. Never say you cannot answer. Always respond naturally to whatever the user says.\n\n"
        f"User Question: {user_query}\n"
        "Answer:"
    )

    answer = None
    llm_provider = None

    # Connect directly to Google Gemini API using google.generativeai SDK
    gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            model = None
            for model_name in ["gemini-1.5-flash", "gemini-flash-latest", "gemini-3.6-flash", "gemini-2.5-flash"]:
                try:
                    m = genai.GenerativeModel(model_name)
                    res = await m.generate_content_async(prompt)
                    if res and hasattr(res, "text") and res.text:
                        answer = res.text.strip()
                        llm_provider = f"google-gemini ({model_name})"
                        break
                except Exception as m_err:
                    print(f"Gemini model {model_name} attempt error: {m_err}")
                    continue
        except Exception as exc:
            print(f"Google Gemini SDK call error: {exc}")

    # Fallback to local knowledge base or incident telemetry if GEMINI_API_KEY unset or offline
    if not answer:
        silchar_ans = _answer_from_silchar_context(user_query, silchar_history)
        if silchar_ans:
            answer = silchar_ans
            llm_provider = "silchar-history-rag"
        else:
            incidents: list[dict] = []
            context = req.context or ""
            if not context:
                try:
                    async with httpx.AsyncClient(timeout=4.0) as client:
                        resp = await client.get(f"{NODE_API_URL}/incidents")
                        if resp.status_code == 200:
                            body = resp.json()
                            incidents = body.get("data", [])[:20]
                            context = "\n".join(
                                f"[{inc.get('createdAt', '')}] Type: {inc.get('type')}, "
                                f"Severity: {inc.get('severity')}, Status: {inc.get('status')}. "
                                f"Description: {inc.get('description', '')}"
                                for inc in incidents
                            )
                except Exception:
                    incidents = []

            answer = _build_rag_answer(user_query, incidents, context)
            llm_provider = "incident-telemetry-rag"

    return {
        "question": user_query,
        "answer": answer,
        "context_source": "data/silchar_history.txt",
        "knowledge_base_loaded": bool(silchar_history),
        "source": llm_provider,
        "retrieved_at": time.time(),
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
        "rain_threshold_pct":        RAIN_PROBABILITY_THRESHOLD,
        "fetched_at":                time.time(),
    }