import torch

from transformers import (
    AutoFeatureExtractor,
    AutoModelForAudioClassification
)

from config import MODEL_ID, SAMPLE_RATE, HIGH_CONFIDENCE
from preprocess import load_audio


class VoiceDetector:

    def __init__(self):

        print("Loading voice detection model...")


        self.feature_extractor = (
            AutoFeatureExtractor.from_pretrained(
                MODEL_ID
            )
        )


        self.model = (
            AutoModelForAudioClassification
            .from_pretrained(MODEL_ID)
        )


        self.model.eval()


        print("Model loaded!")


    def predict(self, audio_path):

        audio, sample_rate = load_audio(
            audio_path
        )


        inputs = self.feature_extractor(
            audio,
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt"
        )


        with torch.no_grad():

            outputs = self.model(
                **inputs
            )


        probabilities = torch.nn.functional.softmax(
            outputs.logits,
            dim=1
        )


        confidence, prediction = torch.max(
            probabilities,
            dim=1
        )


        label = self.model.config.id2label[
            prediction.item()
        ]


        return interpret_result(
            label,
            confidence.item()
        )

def interpret_result(label, confidence):

    confidence_percent = round(
        confidence * 100
    )


    if label == "real":

        if confidence_percent >= HIGH_CONFIDENCE:
            risk = "LOW"
        else:
            risk = "UNCERTAIN"


        verdict = "Human voice detected"


    else:

        if confidence_percent >= 80:
            risk = "HIGH"
        else:
            risk = "UNCERTAIN"


        verdict = "AI-generated voice detected"


    return {
        "verdict": verdict,
        "risk_level": risk,
        "confidence_display": f"{confidence_percent}%",
        "confidence": confidence,
        "technical_label": label
        }