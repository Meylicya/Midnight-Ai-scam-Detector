import tempfile
import os
import hashlib
import json
from datetime import datetime, timezone

from .model import VoiceDetector

MODEL_VERSION = "wav2vec2-asvspoof-v1"

# These are the EXACT strings model.py's interpret_result() produces —
# verified directly against model.py, not guessed. Do NOT swap this for a
# check against result["technical_label"] (e.g. == "real"): that value
# comes from self.model.config.id2label, which depends on the specific
# Hugging Face checkpoint and is not guaranteed to be "real" — that
# mismatch was the source of a real bug here before this fix.
VERDICT_MAP = {
    "Human voice detected": "human",
    "AI-generated voice detected": "ai_generated",
}

detector = VoiceDetector()


def classify(audio_bytes: bytes, suffix: str = ".wav") -> dict:
    """
    Analyze audio bytes and return the shared data contract.

    Audio is written to a short-lived temp file only because
    VoiceDetector.predict() currently requires a file path (via
    preprocess.load_audio) — it is deleted immediately after, in a
    `finally` block, even if prediction raises.
    """
    temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        temp_file.write(audio_bytes)
        temp_file.close()

        result = detector.predict(temp_file.name)

        normalized_verdict = VERDICT_MAP.get(result["verdict"])
        if normalized_verdict is None:
            # Fail loudly instead of silently defaulting to "human" or
            # "ai_generated" — for a scam detector, a silently wrong
            # verdict (esp. AI shown as human) is worse than a visible
            # error. If this ever fires, model.py's label set changed
            # and VERDICT_MAP needs updating.
            raise ValueError(f"Unrecognized verdict from model: {result['verdict']!r}")

        confidence = float(result["confidence"])

        # commitment_hash covers the RESULT (verdict + confidence + model
        # version), not the raw audio. This is what gets submitted to the
        # local Proof Server / Compact contract for the ZK proof. Hashing
        # raw audio instead would fingerprint the specific clip, which is
        # not what the proof is meant to attest to.
        commitment_payload = json.dumps(
            {
                "verdict": normalized_verdict,
                "confidence": round(confidence, 6),
                "model_version": MODEL_VERSION,
            },
            sort_keys=True,
        )
        commitment_hash = hashlib.sha256(commitment_payload.encode()).hexdigest()

        return {
            "session_id": commitment_hash[:16],
            "verdict": normalized_verdict,
            "confidence": confidence,
            "risk_level": result.get("risk_level"),
            "model_version": MODEL_VERSION,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "commitment_hash": commitment_hash,
        }
    finally:
        os.remove(temp_file.name)


if __name__ == "__main__":
    import sys

    with open(sys.argv[1], "rb") as f:
        audio = f.read()

    print(classify(audio))