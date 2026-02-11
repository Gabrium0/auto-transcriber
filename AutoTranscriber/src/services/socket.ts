export interface BackendMessage {
  type: 'transcription' | 'update' | 'info';
  messageId: number;
  message: string;
}

type MessageCallback = (data: BackendMessage) => void;
type StatusCallback = (isConnected: boolean) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageListeners: MessageCallback[] = [];
  private statusListeners: StatusCallback[] = [];
  
  private url: string = import.meta.env.VITE_WEBSOCKET_URL || `ws://${window.location.hostname}:8000/ws/transcription`;

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log('WS Connected');
      this.notifyStatus(true);
    };

    this.socket.onclose = () => {
      console.log('WS Disconnected');
      this.notifyStatus(false);
      this.socket = null;
    };

    this.socket.onerror = (error) => {
      console.error('WS Error:', error);
    };

    this.socket.onmessage = (event) => {
      try {
        const data: BackendMessage = JSON.parse(event.data);
        this.notifyMessage(data);
      } catch (e) {
        console.error('Failed to parse WS message:', event.data);
      }
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  onMessage(callback: MessageCallback) {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((cb) => cb !== callback);
    };
  }

  onStatusChange(callback: StatusCallback) {
    this.statusListeners.push(callback);
    callback(this.socket?.readyState === WebSocket.OPEN);
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyMessage(data: BackendMessage) {
    this.messageListeners.forEach((cb) => cb(data));
  }

  private notifyStatus(isConnected: boolean) {
    this.statusListeners.forEach((cb) => cb(isConnected));
  }
}

export const socketService = new WebSocketService();