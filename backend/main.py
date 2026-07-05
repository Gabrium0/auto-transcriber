import asyncio
import threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager

from connections import Connections
from transcribe import Transcribe

# Global Instances
connection_manager = Connections()
transcriber_thread = None
transcriber_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI context manager to handle backend service initialization and termination.
    
    Spawns the RealtimeSTT transcription service on a background daemon thread
    and terminates it during server shutdown.
    """
    print("Starting up...")
    
    loop = asyncio.get_running_loop()
    
    global transcriber_service
    transcriber_service = Transcribe(connection_manager, loop)
    
    global transcriber_thread
    transcriber_thread = threading.Thread(
        target=transcriber_service.start, 
        daemon=True
    )
    transcriber_thread.start()
    
    yield  # The application runs here
    
    print("Shutting down...")
    if transcriber_service:
        transcriber_service.stop()
    if transcriber_thread:
        transcriber_thread.join(timeout=2.0)

app = FastAPI(lifespan=lifespan)

@app.websocket("/ws/transcription")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Manages full-duplex WebSocket connections for transcription streaming.
    
    Receives language configuration preferences from the client and broadcasts updates.
    """
    await connection_manager.connect(websocket)
    try:
        while True:
            try:
                data = await websocket.receive_json()
                if isinstance(data, dict) and data.get("type") == "set_language":
                    lang = data.get("language", "en")
                    await connection_manager.set_language(websocket, lang)
            except Exception:
                # If they send plain text or non-JSON, keep the loop alive by calling receive_text
                await websocket.receive_text()
            
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
        await connection_manager.broadcast("info", 0, "A user disconnected")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)