import { useEffect } from 'react';
import { socketService, type BackendMessage } from '../../../services/socket';
import { useTranscriptStore } from '../stores/useTranscriptStore';

export const useLiveSocket = () => {
  const { 
    setConnectionStatus, 
    addTranscript, 
    setInterimTranscript 
  } = useTranscriptStore();

  useEffect(() => {
    socketService.connect();

    const unsubscribeStatus = socketService.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubscribeMessages = socketService.onMessage((data: BackendMessage) => {
      if (data.type === 'update') {
        setInterimTranscript(data.message);
      } 
      else if (data.type === 'transcription') {
        addTranscript(data.messageId, data.message);
      }
      else if (data.type === 'info') {
        console.log('[Server Info]:', data.message);
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeMessages();
      socketService.disconnect();
    };
  }, []);
};

export default useLiveSocket;