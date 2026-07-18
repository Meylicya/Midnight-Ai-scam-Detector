import librosa

from .config import SAMPLE_RATE


def load_audio(audio_path):
    """
    Load audio file and convert
    it to required format.
    """

    audio, sample_rate = librosa.load(
        audio_path,
        sr=SAMPLE_RATE
    )

    return audio, sample_rate