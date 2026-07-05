import asyncio
import os
import platform
import torch
import time
from RealtimeSTT import AudioToTextRecorder
from connections import Connections

INITIAL_PROMPT = (
    "Uma mensagem bíblica e cristã sobre Deus, Jesus Cristo, o Espírito Santo, "
    "a Bíblia Sagrada e a fé. Passagens dos apóstolos Paulo, Pedro, João, "
    "Tiago e profetas Moisés, Isaías, Davi. Amém."
)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


class Transcribe:
    """Manages the microphone audio-to-text recording service."""

    def __init__(self, connection: Connections, global_loop: asyncio.AbstractEventLoop) -> None:
        """Initializes the transcriber with WebSocket manager and the main event loop reference."""
        self.connection = connection
        self.global_loop = global_loop
        self.message_id = 0
        self.recorder = None
        self.running = False

    def _broadcast_update(self, msg_type: str, text: str) -> None:
        """Schedules a message broadcast onto the running asyncio event loop thread-safely."""
        if self.global_loop and self.global_loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.connection.broadcast(msg_type, self.message_id, text),
                self.global_loop
            )

    def process_text(self, text: str) -> None:
        """Processes finalized transcription blocks and triggers translation/TTS broadcasting."""
        print(f"- {text}")
        self._broadcast_update("transcription", text)
        self.message_id += 1

    def realtime_callback(self, text: str) -> None:
        """Callback triggered on real-time interim transcription token updates."""
        self._broadcast_update("update", text)

    def _select_backend(self) -> str:
        requested_backend = os.getenv("TRANSCRIBE_BACKEND", "auto").lower()
        supported_backends = {"auto", "realtimestt", "whisper_mps"}
        if requested_backend not in supported_backends:
            raise ValueError(
                "TRANSCRIBE_BACKEND must be one of: auto, realtimestt, whisper_mps"
            )

        if requested_backend != "auto":
            return requested_backend

        if torch.cuda.is_available():
            return "realtimestt"

        if (
            platform.system() == "Darwin"
            and hasattr(torch.backends, "mps")
            and torch.backends.mps.is_available()
        ):
            return "whisper_mps"

        return "realtimestt"

    def start(self) -> None:
        """Initializes the AudioToTextRecorder and begins the active recording listen loop."""
        self.running = True

        backend = self._select_backend()
        print(f"CUDA Available: {torch.cuda.is_available()}")
        print(
            "MPS Available: "
            f"{hasattr(torch.backends, 'mps') and torch.backends.mps.is_available()}"
        )
        print(f"Selected transcription backend: {backend}")

        if backend == "whisper_mps":
            self._start_whisper_mps()
            return

        self._start_realtimestt()

    def _start_realtimestt(self) -> None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "int8_float16" if device == "cuda" else "int8"
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", compute_type)
        input_device_index = _env_int("MIC_INPUT_DEVICE_INDEX", 0)

        self.recorder = AudioToTextRecorder(
            model=os.getenv("WHISPER_MODEL", "large-v3-turbo"),
            language="pt",
            device=device,
            compute_type=compute_type,

            enable_realtime_transcription=True,
            realtime_model_type=os.getenv("WHISPER_REALTIME_MODEL", "medium"),

            input_device_index=input_device_index,
            spinner=False,

            initial_prompt=INITIAL_PROMPT,

            # Tuning parameters for accuracy over latency
            beam_size=_env_int("WHISPER_BEAM_SIZE", 5),
            post_speech_silence_duration=0.8,
            min_length_of_recording=0.4,
            silero_sensitivity=0.4,
            webrtc_sensitivity=1,
            
            on_realtime_transcription_update=self.realtime_callback, 
        )

        print(
            f"Microphone (Index {input_device_index}) is live. "
            "Ready for WebSocket connections."
        )

        try:
            while self.running:
                self.recorder.text(self.process_text)
        except KeyboardInterrupt:
            self.stop()

    def _start_whisper_mps(self) -> None:
        """Runs an accuracy-first Whisper loop on Apple Silicon via PyTorch MPS."""
        try:
            import numpy as np
            import pyaudio
            import whisper
        except ImportError as exc:
            raise RuntimeError(
                "The Apple MPS backend requires openai-whisper, numpy, and PyAudio. "
                "Install backend requirements after running `brew install portaudio ffmpeg`."
            ) from exc

        if not (
            hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        ):
            raise RuntimeError(
                "TRANSCRIBE_BACKEND=whisper_mps was selected, but PyTorch MPS is not available. "
                "Use native arm64 Python on an Apple Silicon Mac and install the standard PyTorch wheels."
            )

        model_name = os.getenv("WHISPER_MODEL", "large-v3")
        beam_size = _env_int("WHISPER_BEAM_SIZE", 5)
        input_device_index = _env_int("MIC_INPUT_DEVICE_INDEX", 0)
        sample_rate = _env_int("MIC_SAMPLE_RATE", 16000)
        chunk_duration = _env_float("MIC_CHUNK_DURATION", 0.25)
        silence_duration = _env_float("SPEECH_SILENCE_DURATION", 1.0)
        min_recording_duration = _env_float("MIN_RECORDING_DURATION", 0.7)
        max_recording_duration = _env_float("MAX_RECORDING_DURATION", 30.0)
        speech_threshold = _env_float("SPEECH_RMS_THRESHOLD", 0.008)
        chunk_frames = int(sample_rate * chunk_duration)
        silence_chunks = max(1, int(silence_duration / chunk_duration))
        min_chunks = max(1, int(min_recording_duration / chunk_duration))
        max_chunks = max(min_chunks, int(max_recording_duration / chunk_duration))

        print(f"Loading Whisper model '{model_name}' on Apple MPS...")
        model = whisper.load_model(model_name, device="mps")
        audio_interface = pyaudio.PyAudio()

        stream = audio_interface.open(
            format=pyaudio.paFloat32,
            channels=1,
            rate=sample_rate,
            input=True,
            input_device_index=input_device_index,
            frames_per_buffer=chunk_frames,
        )

        self.recorder = stream
        print(
            f"Microphone (Index {input_device_index}) is live on Apple MPS. "
            "Ready for WebSocket connections."
        )

        frames = []
        silent_chunks = 0
        in_speech = False

        try:
            while self.running:
                raw = stream.read(chunk_frames, exception_on_overflow=False)
                chunk = np.frombuffer(raw, dtype=np.float32)
                rms = float(np.sqrt(np.mean(np.square(chunk)))) if chunk.size else 0.0
                has_speech = rms >= speech_threshold

                if has_speech:
                    if not in_speech:
                        self.realtime_callback("Listening...")
                    in_speech = True
                    silent_chunks = 0

                if in_speech:
                    frames.append(chunk.copy())
                    if not has_speech:
                        silent_chunks += 1

                should_transcribe = (
                    in_speech
                    and len(frames) >= min_chunks
                    and (silent_chunks >= silence_chunks or len(frames) >= max_chunks)
                )

                if not should_transcribe:
                    continue

                audio = np.concatenate(frames).astype(np.float32)
                frames = []
                silent_chunks = 0
                in_speech = False

                started_at = time.perf_counter()
                result = model.transcribe(
                    audio,
                    language="pt",
                    task="transcribe",
                    beam_size=beam_size,
                    best_of=beam_size,
                    temperature=0,
                    fp16=False,
                    initial_prompt=INITIAL_PROMPT,
                )
                text = result.get("text", "").strip()
                elapsed = time.perf_counter() - started_at
                print(f"MPS transcription completed in {elapsed:.2f}s")

                if text:
                    self.process_text(text)
        except KeyboardInterrupt:
            self.stop()
        finally:
            stream.stop_stream()
            stream.close()
            audio_interface.terminate()

    def stop(self) -> None:
        """Stops the recording loop and cleanly shuts down the AudioToTextRecorder device."""
        self.running = False
        if self.recorder and hasattr(self.recorder, "shutdown"):
            self.recorder.shutdown()
        print("Transcriber stopped.")
