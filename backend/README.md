# ⚙️ Auto-Transcriber Backend

This is the Python-based backend server for the Auto-Transcriber. It is built on **FastAPI** and uses **WebSockets** to communicate with clients in real-time. It runs a local Whisper model to transcribe microphone inputs, translates finished sentences into the user's preferred language, applies Christian terminology mappings, and streams synthesized Text-to-Speech (TTS) audio back to the clients.

---

## 🏗️ Architecture & Modules

The backend consists of three primary Python modules:

### 1. `main.py`
- Sets up the FastAPI ASGI application.
- Configures the server lifespan: initializes the transcription service and starts it on a background daemon thread during startup, and shuts it down cleanly during termination.
- Exposes the `/ws/transcription` WebSocket endpoint to handle client handshakes, register connection preference updates (such as language switching), and keep client sessions alive.

### 2. `transcribe.py`
- Operates the `AudioToTextRecorder` from `RealtimeSTT`.
- Configured to run the Whisper `large-v3-turbo` model for high-accuracy speech recognition.
- Uses `initial_prompt` to seed the acoustic model with Portuguese Christian names and proper spellings (*Deus, Jesus Cristo, o Espírito Santo, a Bíblia Sagrada, Paulo, Pedro, João, Tiago, Moisés, Isaías, Davi, Amém*).
- Uses `beam_size=5` to increase search space and prioritize transcription accuracy over speed.

### 3. `connections.py`
- Manages the active WebSocket registry.
- Maps socket connections to user-specific configuration metadata (e.g. `{websocket: {"language": "en"}}`).
- Performs backend translation via `deep-translator` (Google Translate free web API).
- Runs post-translation proper name adjustments (`_correct_christian_terms`) using `CHRISTIAN_MAPPINGS` to correct biblical translations (e.g. mapping *Tiago* to *James* in English and *Jakobus* in Dutch).
- Converts translated strings into speech audio using `gTTS`.
- Base64-encodes the MP3 audio into a Data URL (`data:audio/mp3;base64,...`) and sends it alongside translations to clients over the WebSocket.
- Offloads translation and TTS execution to a thread-pool executor (`loop.run_in_executor`) to prevent blocking FastAPI's async event loop.

---

## 🚀 Installation & Setup

Ensure you have Python 3.10+ installed.

### 1. Virtual Environment Setup
```bash
python -m venv venv
```

Activate the environment:
- **Windows:**
  ```powershell
  .\venv\Scripts\activate
  ```
- **Mac/Linux:**
  ```bash
  source venv/bin/activate
  ```

### 2. Install PyTorch (CUDA vs CPU)
If you have an NVIDIA GPU, install PyTorch with CUDA 12.1 support for faster Whisper transcription:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```
For Mac or CPU-only setups, run:
```bash
pip install torch torchvision torchaudio
```

### 3. Install Requirements
```bash
pip install -r requirements.txt
```

---

## 🏃 Running the Server

Start the application using:
```bash
python main.py
```
The server will run on `http://localhost:8000`. WebSocket clients should connect to `ws://localhost:8000/ws/transcription`.

---

## 📖 Christian Translation Filtering

To maintain high translation standards for biblical proper names, the server employs case-insensitive word-boundary filtering on translated strings. The supported languages and mappings include:
- **English (`en`)**: Maps Portuguese biblical characters to English standards (e.g. *Tiago* $\rightarrow$ *James*, *João* $\rightarrow$ *John*, *Moisés* $\rightarrow$ *Moses*).
- **Dutch (`nl`)**: Maps characters to Dutch standards (e.g. *Tiago* $\rightarrow$ *Jakobus*, *João* $\rightarrow$ *Johannes*, *Moisés* $\rightarrow$ *Mozes*).
- **Spanish (`es`)**, **French (`fr`)**, **German (`de`)**, **Italian (`it`)**: Language-specific biblical name mappings.
