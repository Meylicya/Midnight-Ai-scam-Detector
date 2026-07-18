import librosa
import io
import os

def load_audio(audio_input):
    # If the input is a string (a file path), load it directly
    if isinstance(audio_input, str):
        return librosa.load(audio_input, sr=16000)
    
    # If the input is bytes, wrap it in BytesIO and load
    elif isinstance(audio_input, bytes):
        buffer = io.BytesIO(audio_input)
        return librosa.load(buffer, sr=16000)
        
    else:
        raise ValueError("Unsupported input format provided to load_audio")