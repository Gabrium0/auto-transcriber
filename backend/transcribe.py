import asyncio
import torch
import sys
from RealtimeSTT import AudioToTextRecorder
from connections import Connections

class Transcribe:
    def __init__(self, connection: Connections, global_loop: asyncio.AbstractEventLoop):
        self.connection = connection
        self.global_loop = global_loop
        self.message_id = 0
        self.recorder = None
        self.running = False

    def _broadcast_update(self, msg_type, text):
        if self.global_loop and self.global_loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.connection.broadcast(msg_type, self.message_id, text),
                self.global_loop
            )

    def process_text(self, text):

        print(f"- {text}")
        self._broadcast_update("transcription", text)
        self.message_id += 1

    def realtime_callback(self, text):

        self._broadcast_update("update", text)

    def start(self):
        print(f"CUDA Available: {torch.cuda.is_available()}")
        
        self.running = True
        
        self.recorder = AudioToTextRecorder(
            model="large-v3-turbo",
            language="pt",
            device="cuda" if torch.cuda.is_available() else "cpu",
            compute_type="int8_float32", 
            
            enable_realtime_transcription=True,
            realtime_model_type="medium", 
            
            input_device_index=0,
            spinner=False,

            initial_prompt="A seguir, uma conversa normal em Português. O texto deve ser fiel, claro e bem pontuado.",
            
            # Tuning parameters
            beam_size=1, 
            post_speech_silence_duration=0.3, 
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

    def stop(self):
        self.running = False
        if self.recorder:
            self.recorder.shutdown()
        print("Transcriber stopped.")