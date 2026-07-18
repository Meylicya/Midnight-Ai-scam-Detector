import tempfile
import os
from datetime import datetime, timezone

from model import VoiceDetector


MODEL_VERSION = "wav2vec2-asvspoof-v1"


detector = VoiceDetector()


def classify(audio_bytes: bytes) -> dict:
    """
    Analyze audio bytes and return shared data contract.
    """

    temp_file = tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False
    )

    try:

        temp_file.write(audio_bytes)
        temp_file.close()


        result = detector.predict(
            temp_file.name
        )


        return {
            "session_id": "",
            "verdict": (
                "human"
                if result["technical_label"] == "real"
                else "ai_generated"
            ),
            "confidence": 
                float(
                    result["confidence"]
            ),
            "model_version": MODEL_VERSION,
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat()
        }


    finally:

        os.remove(
            temp_file.name
        )

if __name__ == "__main__":

    import sys

    with open(sys.argv[1], "rb") as f:
        audio = f.read()

    print(
        classify(audio)
    )
