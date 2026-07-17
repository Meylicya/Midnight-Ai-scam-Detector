# ML (P3)

Human vs AI-generated voice classifier.

## Setup
```bash
pip install -r requirements.txt
python classify.py path/to/test_clip.wav
```

## TODO
- [ ] Find pretrained ASVspoof-based model on Hugging Face
- [ ] Test on real short clips (<5 sec inference target)
- [ ] Wrap as `classify(audio_bytes) -> dict`
- [ ] Hand off function signature to P2 for backend integration
- [ ] (Stretch) fine-tune / tune thresholds if time allows
