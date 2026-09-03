from fastapi import FastAPI

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