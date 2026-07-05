import { useEffect } from 'react';
import { socketService, type BackendMessage } from '../../../services/socket';
import { useTranscriptStore } from '../stores/useTranscriptStore';

/**
 * Custom React hook that coordinates WebSocket event subscriptions and state sync.
 * Handles automatic connection management, connectivity state indicators,
 * and dispatching incoming transcripts or live interim updates to the Zustand store.
 */
export const useLiveSocket = (): void => {
  const { 
    setConnectionStatus, 
    addTranscript, 
    setInterimTranscript 
  } = useTranscriptStore();

  useEffect(() => {
    // Establish connection to backend
    socketService.connect();

    // Subscribe to status updates (connected/disconnected)
    const unsubscribeStatus = socketService.onStatusChange((status) => {
      setConnectionStatus(status);
      if (status) {
        // Send the initial target language selection to synchronize translation on backend
        const currentLang = useTranscriptStore.getState().targetLang;
        socketService.setLanguage(currentLang);
      }
    });

    // Subscribe to transcription and information packets
    const unsubscribeMessages = socketService.onMessage((data: BackendMessage) => {
      if (data.type === 'update') {
        setInterimTranscript(data.message);
      } 
      else if (data.type === 'transcription') {
        addTranscript(data.messageId, data.message, data.translation, data.audio);
      }
      else if (data.type === 'info') {
        console.log('[Server Info]:', data.message);
      }
    });

    // Clean up connections on unmount
    return () => {
      unsubscribeStatus();
      unsubscribeMessages();
      socketService.disconnect();
    };
  }, []);
};

export default useLiveSocket;