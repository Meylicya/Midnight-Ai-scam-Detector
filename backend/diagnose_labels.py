"""
Diagnostic: prints RAW per-class probabilities (not just the top-1 label)
so we can see directly whether the model's id2label mapping matches what
it actually learned — independent of any code logic in model.py/classify.py.

Usage (from backend/, with venv active and PYTHONPATH=".."):
    python diagnose_labels.py path/to/known_human_clip.wav
    python diagnose_labels.py path/to/known_ai_clip.wav
"""
import sys
import torch
from ml.model import VoiceDetector
from ml.preprocess import load_audio
from ml.config import SAMPLE_RATE

def diagnose(audio_path, expected_label):
    detector = VoiceDetector()
    audio, sr = load_audio(audio_path)
    inputs = detector.feature_extractor(audio, sampling_rate=SAMPLE_RATE, return_tensors="pt")

    with torch.no_grad():
        outputs = detector.model(**inputs)

    probs = torch.nn.functional.softmax(outputs.logits, dim=1)[0]
    id2label = detector.model.config.id2label

    print(f"\n--- {audio_path} (you told me this is: {expected_label}) ---")
    print(f"id2label mapping: {id2label}")
    for idx, p in enumerate(probs):
        print(f"  class {idx} ({id2label[idx]!r}): {p.item()*100:.2f}%")
    top_idx = int(torch.argmax(probs).item())
    print(f"Model's top pick: class {top_idx} -> {id2label[top_idx]!r}")

if __name__ == "__main__":
    path = sys.argv[1]
    expected = sys.argv[2] if len(sys.argv) > 2 else "unknown"
    diagnose(path, expected)
