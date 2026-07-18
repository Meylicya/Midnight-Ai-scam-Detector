from fastapi import FastAPI, UploadFile
from datetime import datetime, timezone

app = FastAPI()


@app.post("/analyze")
async def analyze(file: UploadFile):
    """
    Day-1 stub: returns a fake response matching the shared data contract.
    Audio is read but never persisted or logged — replace this body with:
      1. read audio bytes into memory
      2. call ml.classify(audio_bytes)
      3. hash the result
      4. submit hash to Midnight contract (see /contract)
      5. return real verdict + confidence + proof reference
    """
    _ = await file.read()  # read but discard — no persistence

    return {
        "session_id": "hashed-session-id-placeholder",
        "verdict": "human",
        "confidence": 0.92,
        "model_version": "v0-stub",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"message": "Scam detector backend is running!"}