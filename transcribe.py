from RealtimeSTT import AudioToTextRecorder
import torch
import sys
import pyaudio

last_draft_lines = 0

def process_text(text):
    global last_draft_lines

    if last_draft_lines > 0:
        for _ in range(last_draft_lines):
            sys.stdout.write("\033[F")
            sys.stdout.write("\033[K")
    
    last_draft_lines = 0

    print(f"- {text}")

def realtime_callback(text):
    global last_draft_lines
    
    prefix = ">> "
    wrap_limit = 200
    
    full_text = prefix + text
    
    if last_draft_lines > 0:
        for _ in range(last_draft_lines):
            sys.stdout.write("\033[F")
            sys.stdout.write("\033[K")
            
    lines = []
    while len(full_text) > wrap_limit:
        lines.append(full_text[:wrap_limit])
        full_text = full_text[wrap_limit:]
    lines.append(full_text)
    
    for line in lines:
        sys.stdout.write(line + "\n")
        
    sys.stdout.flush()
    
    last_draft_lines = len(lines)

def select_audio_input_device():
    p = pyaudio.PyAudio()
    available_devices = []
    
    print("\nAudio Input")
    for i in range(p.get_device_count()):
        dev_info = p.get_device_info_by_index(i)
        if dev_info.get('maxInputChannels') > 0:
            name = dev_info.get('name')
            available_devices.append(i)
            print(f"Index {i}: {name}")

    p.terminate()

    if not available_devices:
        print("No input")
        sys.exit(1)

    while True:
        try:
            selection = input("\nEnter the Index of the microphone to use: ")
            index = int(selection)
            if index in available_devices:
                return index
        except ValueError:
            pass

if __name__ == '__main__':
    print(f"PyTorch: {torch.version} | CUDA: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    user_mic_index = select_audio_input_device()

    print("\nInitializing models...")
    print("  Main Model: large-v3-turbo (Finalizing)")
    print("  Live Model: medium (Real-time Feedback)")

    recorder = AudioToTextRecorder(
        model="large-v3-turbo",
        language="pt",
        device="cuda",
        compute_type="int8_float32", 
        
        enable_realtime_transcription=True,
        realtime_model_type="medium", 
        
        input_device_index=user_mic_index,
        spinner=False,

        initial_prompt="A seguir, uma conversa normal em Português. O texto deve ser fiel, claro e bem pontuado.",

        beam_size=1, 
        
        post_speech_silence_duration=0.3, 
        
        min_length_of_recording=0.4,
        
        silero_sensitivity=0.4,
        webrtc_sensitivity=1,
        min_gap_between_recordings=0,
        
        on_realtime_transcription_update=realtime_callback, 
    )

    print("\nListening... (Speak now)\n")
    print("-" * 50)

    while True:
        try:
            recorder.text(process_text)
        except KeyboardInterrupt:
            print("\nStopping...")
            recorder.shutdown()
            sys.exit(0)