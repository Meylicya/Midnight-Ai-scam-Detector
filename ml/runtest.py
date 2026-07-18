from detector import VoiceDetector


detector = VoiceDetector()


result = detector.predict(
    "data/test_voice.wav"
)


print(result)