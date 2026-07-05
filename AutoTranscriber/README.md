# 💻 Auto-Transcriber Frontend

This is the Vite-based React + TypeScript frontend web application for the Auto-Transcriber project. It establishes a WebSocket connection with the backend translation server, renders transcription lines in real-time, and manages sequential audio playback queueing.

## Key Features
- **Live Text Feed**: Displays live updates for interim speech (italicized) and translates final speech blocks instantly.
- **Auto-Scroll Toggle**: Toggle automatic vertical scroll following the transcription feed.
- **Audio Queue & Autoplay**: Autoplays synthesized TTS voice segments consecutively.
- **Audio Volume Switch**: Mute/unmute button directly in the header (pauses active audio and clears queue).
- **Target Language Select**: Dynamically choose target translation languages (Dutch, English, Spanish, French, German, Italian, or Portuguese).

## Setup & Running Locally

Ensure you have [Bun](https://bun.sh/) or [Node.js](https://nodejs.org/) installed.

1. Install dependencies:
   ```bash
   bun install
   # or
   npm install
   ```

2. Run the dev server:
   ```bash
   bun run dev
   # or
   npm run dev
   ```

3. Build for production:
   ```bash
   bun run build
   # or
   npm run build
   ```

## Key Modules
- `src/features/live-session/stores/useTranscriptStore.ts`: Zustand store managing state (transcripts, target language, audio queue, and playback scheduling).
- `src/features/live-session/components/TranscriptList.tsx`: Main component layout rendering the virtualized feed list, status bar, and selection toolbar.
- `src/services/socket.ts`: WebSocket client wrapper sending events (like `set_language`) and receiving messages from FastAPI.

