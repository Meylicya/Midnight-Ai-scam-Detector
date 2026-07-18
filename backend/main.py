from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ml.classify import classify

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory registry — fast-path MVP for the 48-hour build. Swap for the
# Midnight registry ledger (see /contract/voiceguard.compact) once P4's
# contract is ready to accept real submissions.
_registry: dict[str, int] = {}


def _suffix_for(filename: Optional[str]) -> str:
    """Preserve the real upload's extension instead of forcing .wav on
    everything — the frontend sends recordings as .webm, not .wav."""
    if not filename or "." not in filename:
        return ".wav"
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext in {"wav", "webm", "mp3", "m4a", "ogg"}:
        return f".{ext}"
    return ".wav"


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    audio_bytes = await file.read()  # kept in memory, never written except
    # inside classify()'s short-lived temp file, which it deletes itself

    try:
        result = classify(audio_bytes, suffix=_suffix_for(file.filename))
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")

    return result


class ReportRequest(BaseModel):
    commitment_hash: Optional[str] = None
    identifier_hash: Optional[str] = None
    identifier_type: Optional[str] = None  # "phone" | "email" | "handle"


@app.post("/report")
async def report(body: ReportRequest):
    """
    Records a scam report. Only ever receives hashes — never a raw phone
    number, email, or handle.
    """
    if body.identifier_hash:
        _registry[body.identifier_hash] = _registry.get(body.identifier_hash, 0) + 1

    return {"ok": True, "total_reports": sum(_registry.values())}


@app.get("/registry/check")
async def check_registry(hash: str, type: Optional[str] = None):
    """Looks up an identifier_hash (client-computed) against the registry."""
    count = _registry.get(hash, 0)
    return {"flagged": count > 0, "report_count": count}


@app.get("/stats")
async def stats():
    """Aggregate, anonymous — no login required to read these."""
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