export interface BackendMessage {
  type: 'transcription' | 'update' | 'info';
  messageId: number;
  message: string;
  translation?: string;
  audio?: string;
}

/** Callback type signature for handling inbound WebSocket messages. */
type MessageCallback = (data: BackendMessage) => void;

/** Callback type signature for handling WebSocket connection state changes. */
type StatusCallback = (isConnected: boolean) => void;

/**
 * Service to manage client-side WebSocket connections with the FastAPI backend.
 * Provides subscription mechanisms for incoming messages and connectivity status.
 */
class WebSocketService {
  private socket: WebSocket | null = null;
  private messageListeners: MessageCallback[] = [];
  private statusListeners: StatusCallback[] = [];
  
  private url: string = import.meta.env.VITE_WEBSOCKET_URL || `ws://${window.location.hostname}:8000/ws/transcription`;

  /**
   * Connects to the transcription WebSocket server and registers message handlers.
   * If a connection is already open or opening, this is a no-op.
   */
  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      console.log('WS Connected');
      this.notifyStatus(true);
    };

    socket.onclose = () => {
      console.log('WS Disconnected');
      // Only nullify if this socket is still the current one.
      // Prevents a stale socket's onclose from clobbering a newer connection
      // (critical under React StrictMode's mount-unmount-remount cycle).
      if (this.socket === socket) {
        this.notifyStatus(false);
        this.socket = null;
      }
    };

    socket.onerror = (error) => {
      console.error('WS Error:', error);
    };

    socket.onmessage = (event) => {
      try {
        const data: BackendMessage = JSON.parse(event.data);
        this.notifyMessage(data);
      } catch (e) {
        console.error('Failed to parse WS message:', event.data);
      }
    };
  }

  /**
   * Closes the active WebSocket connection if open.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Sends the target translation language configuration to the backend server.
   * @param lang - The target language code (e.g., 'en', 'nl').
   */
  setLanguage(lang: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'set_language', language: lang }));
    }
  }

  /**
   * Subscribes to backend transcription and status updates.
   * @param callback - Function invoked when a new BackendMessage is received.
   * @returns Unsubscribe clean-up function.
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Subscribes to changes in WebSocket connection status.
   * @param callback - Function invoked when the connection state updates.
   * @returns Unsubscribe clean-up function.
   */
  onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.push(callback);
    callback(this.socket?.readyState === WebSocket.OPEN);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyMessage(data: BackendMessage): void {
    this.messageListeners.forEach((cb) => cb(data));
  }

  private notifyStatus(isConnected: boolean): void {
    this.statusListeners.forEach((cb) => cb(isConnected));
  }
}

export const socketService = new WebSocketService();