import asyncio
import torch
import sys
from RealtimeSTT import AudioToTextRecorder
from connections import Connections

class Transcribe:
    """Manages the microphone audio-to-text recording service using RealtimeSTT."""

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

    def start(self) -> None:
        """Initializes the AudioToTextRecorder and begins the active recording listen loop."""
        print(f"CUDA Available: {torch.cuda.is_available()}")
        
        self.running = True
        
        self.recorder = AudioToTextRecorder(
            model="large-v3-turbo",
            language="pt",
            device="cuda" if torch.cuda.is_available() else "cpu",
            compute_type="int8_float16", 
            
            enable_realtime_transcription=True,
            realtime_model_type="medium", 
            
            input_device_index=0,
            spinner=False,

            initial_prompt="Uma mensagem bíblica e cristã sobre Deus, Jesus Cristo, o Espírito Santo, a Bíblia Sagrada e a fé. Passagens dos apóstolos Paulo, Pedro, João, Tiago e profetas Moisés, Isaías, Davi. Amém.",
            
            # Tuning parameters for accuracy over latency
            beam_size=5, 
            post_speech_silence_duration=0.8,
            min_length_of_recording=0.4,
            silero_sensitivity=0.4,
            webrtc_sensitivity=1,
            
            on_realtime_transcription_update=self.realtime_callback, 
        )

        print("Microphone (Index 0) is live. Ready for WebSocket connections.")

        try:
            while self.running:
                self.recorder.text(self.process_text)
        except KeyboardInterrupt:
            self.stop()

    def stop(self) -> None:
        """Stops the recording loop and cleanly shuts down the AudioToTextRecorder device."""
        self.running = False
        if self.recorder:
            self.recorder.shutdown()
        print("Transcriber stopped.")