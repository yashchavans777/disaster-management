from fastapi import FastAPI
from pydantic import BaseModel


class RouteRiskRequest(BaseModel):
    precipitation: float = 0
    wind_speed: float = 0

app = FastAPI(
    title="Smart Logistics Platform AI Service",
    description="FastAPI service for AI-assisted logistics and route intelligence.",
    version="1.0.0",
)


@app.get("/")
def health_check():
    return {
        "service": "Smart Logistics Platform FastAPI server",
        "status": "running",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/route-risk")
def calculate_route_risk(payload: RouteRiskRequest):
    if payload.wind_speed > 30 or payload.precipitation > 50:
        risk_level = "high"
    elif payload.wind_speed > 20 or payload.precipitation > 20:
        risk_level = "moderate"
    else:
        risk_level = "low"

    return {
        "risk_level": risk_level,
        "precipitation": payload.precipitation,
        "wind_speed": payload.wind_speed,
    }