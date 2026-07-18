"""
Human vs AI-generated voice classifier — stub.

Replace the body of classify() with a real pretrained model call
(e.g. a Hugging Face model fine-tuned on ASVspoof).
Output must match the shared data contract fields: verdict, confidence.
"""

import sys


def classify(audio_bytes: bytes) -> dict:
    """
    TODO: replace with real inference.
    1. load audio_bytes with librosa
    2. extract features (MFCCs / spectrogram) or feed to HF model directly
    3. run model, get probability
    4. threshold into verdict
    """
    return {
        "verdict": "human",       # or "ai_generated"
        "confidence": 0.5,        # placeholder
        "model_version": "v0-stub",
    }


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    if not path:
        print("Usage: python classify.py <audio_file>")
        sys.exit(1)

    with open(path, "rb") as f:
        audio_bytes = f.read()

    print(classify(audio_bytes))