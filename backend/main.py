import traceback
import sys
import io
import os
import tempfile
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydub import AudioSegment
from pydub import AudioSegment

# FORCIBLY set the path to FFmpeg
# Use forward slashes (/) even on Windows to avoid escape character issues
AudioSegment.converter = "C:/ffmpeg-2026-07-13-git-9c2aabaa34-full_build/bin/ffmpeg.exe"

# Import your model
from ml.model import VoiceDetector

# 1. Initialize App and Detector
app = FastAPI()
detector = VoiceDetector()

# 2. Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to ["http://localhost:5173"] for production
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. In-memory registry
_registry = {}

# --- API Endpoints ---

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    """
    Frontend alias for the prediction pipeline.
    """
    # Simply call the existing predict function
    return await predict(file)


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    print(f"--- Received request for: {file.filename} ---")
    try:
        # 1. Read bytes
        audio_data = await file.read()
        print(f"Read {len(audio_data)} bytes of audio.")

        # 2. Convert via Pydub
        audio = AudioSegment.from_file(io.BytesIO(audio_data))
        print("Pydub conversion successful.")

        # 3. Save temp file
        temp_path = "temp_processing.wav"
        audio.export(temp_path, format="wav")
        print(f"File exported to {temp_path}")

        # 4. Run Prediction
        print("Calling detector.predict()...")
        result = detector.predict(temp_path)
        print("Prediction returned successfully.")
        
        return result

    except Exception as e:
        print("--- CRITICAL FAILURE ---")
        traceback.print_exc()  # This will print the FULL file and line number
        print("------------------------")
        raise HTTPException(status_code=500, detail=str(e))


class ReportRequest(BaseModel):
    commitment_hash: Optional[str] = None
    identifier_hash: Optional[str] = None
    identifier_type: Optional[str] = None 

@app.post("/report")
async def report(body: ReportRequest):
    if body.identifier_hash:
        _registry[body.identifier_hash] = _registry.get(body.identifier_hash, 0) + 1
    return {"ok": True, "total_reports": sum(_registry.values())}


@app.get("/registry/check")
async def check_registry(hash: str, type: Optional[str] = None):
    count = _registry.get(hash, 0)
    return {"flagged": count > 0, "report_count": count}


@app.get("/stats")
async def stats():
    return {
        "total_reports": sum(_registry.values()),
        "unique_flagged_identifiers": len(_registry),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
def read_root():
    return {"message": "Midnight AI Scam Detector Backend is Online"}