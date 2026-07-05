import { create } from 'zustand';
import { socketService } from '../../../services/socket';

// ----------------------------------------------------------------------
// Cache the PROMISE of the translator for live/interim text.
// ----------------------------------------------------------------------
let chromeTranslatorPromise: Promise<any> | null = null;
let chromeTranslatorLang: string | null = null;

// Track the current playing audio to allow pausing/stopping on mute
let activeAudio: HTMLAudioElement | null = null;

/**
 * Helper to ensure we only have one translator instance at a time
 * and re-initialize if the target language changes.
 * 
 * @param targetLang - The desired target language code.
 * @returns A promise resolving to the Chrome Translator instance.
 */
async function getChromeTranslator(targetLang: string) {
  if (!('Translator' in self)) {
    throw new Error('Chrome Global Translator API not found.');
  }

  if (!chromeTranslatorPromise || chromeTranslatorLang !== targetLang) {
    chromeTranslatorLang = targetLang;
    console.log(`Initializing local Chrome AI translator: pt -> ${targetLang}...`);
    
    chromeTranslatorPromise = (self as any).Translator.create({
      sourceLanguage: 'pt', // Assuming Portuguese source based on your logs
      targetLanguage: targetLang,
    });
  }
  return chromeTranslatorPromise;
}

/** Represents a single line in the transcription history feed. */
export interface TranscriptLine {
  id: number;
  text: string;
  translation?: string;
  isFinal: boolean;
}

/** State interface defining the transcription store's shape and reactive actions. */
interface TranscriptState {
  /** Tracks whether the WebSocket client is currently connected. */
  isConnected: boolean;
  /** Chronological history of finalized transcription lines. */
  transcripts: TranscriptLine[];
  /** Real-time, un-finalized transcription string. */
  interimTranscript: string;
  /** Real-time translation of the un-finalized transcription string. */
  interimTranslation: string; 
  /** Selected target language code. */
  targetLang: string;
  
  /** Queue storing Base64 MP3 Audio Data URLs waiting to be played. */
  audioQueue: string[];
  /** Tracks if a TTS audio clip is currently playing. */
  isPlayingAudio: boolean;
  /** Mute/Unmute state toggle for TTS audio autoplay. */
  isAudioEnabled: boolean;

  /** Updates the connection state. */
  setConnectionStatus: (status: boolean) => void;
  /** Sets the translation target language and pushes the updates to the server. */
  setTargetLang: (lang: string) => void;
  /** Appends a finalized transcription line and queues its TTS audio payload. */
  addTranscript: (id: number, text: string, translation?: string, audio?: string) => Promise<void>;
  /** Updates the interim transcript and schedules a client-side translation. */
  setInterimTranscript: (text: string) => Promise<void>;
  /** Resets the transcription store state, halts active playback, and flushes the audio queue. */
  reset: () => void;
  
  /** Appends a new audio URL to the playback queue. */
  addToAudioQueue: (audioUrl: string) => void;
  /** Sequentially plays the next audio URL in the queue. */
  playNextAudio: () => void;
  /** Mutes or unmutes the audio player. Halts active audio and flushes the queue when muting. */
  toggleAudioEnabled: () => void;
}

export const useTranscriptStore = create<TranscriptState>()((set, get) => ({
  isConnected: false,
  transcripts: [],
  interimTranscript: '',
  interimTranslation: '', 
  targetLang: 'en',
  
  audioQueue: [],
  isPlayingAudio: false,
  isAudioEnabled: true,

  setConnectionStatus: (status) => set({ isConnected: status }),

  setTargetLang: (lang) => {
    set({ targetLang: lang });
    socketService.setLanguage(lang);
  },

  addTranscript: async (id, text, translation, audio) => {
    const MAX_ITEMS = 5000;

    // 1. Immediately add the text to the transcript list and clear interim
    set((state) => {
      const finalTranslation = translation || text;
      const newEntry: TranscriptLine = { id, text, translation: finalTranslation, isFinal: true };
      let newTranscripts = [...state.transcripts, newEntry];

      if (newTranscripts.length > MAX_ITEMS) {
        newTranscripts = newTranscripts.slice(newTranscripts.length - MAX_ITEMS);
      }

      return { 
        transcripts: newTranscripts, 
        interimTranscript: '',
        interimTranslation: '' 
      };
    });

    // 2. Queue the TTS audio if available and audio is enabled
    if (audio && get().isAudioEnabled) {
      get().addToAudioQueue(audio);
    }
  },

  setInterimTranscript: async (text) => {
    set({ interimTranscript: text });

    if (!text.trim()) {
      set({ interimTranslation: '' });
      return;
    }

    try {
      const { targetLang } = get();
      const translator = await getChromeTranslator(targetLang);
      const translation = await translator.translate(text);

      // Race condition check: Ensure the user hasn't stopped speaking/changed text
      if (get().interimTranscript === text) {
        set({ interimTranslation: translation });
      }
    } catch (error) {
      console.error('Interim local translation error:', error);
      chromeTranslatorPromise = null; // Reset on failure to allow retry
    }
  },

  reset: () => {
    if (activeAudio) {
      try { activeAudio.pause(); } catch (e) {}
      activeAudio = null;
    }
    set({ 
      transcripts: [], 
      interimTranscript: '', 
      interimTranslation: '', 
      isConnected: false,
      audioQueue: [],
      isPlayingAudio: false
    });
  },

  addToAudioQueue: (audioUrl) => {
    set((state) => {
      const newQueue = [...state.audioQueue, audioUrl];
      // If not currently playing, schedule playback start
      if (!state.isPlayingAudio) {
        setTimeout(() => get().playNextAudio(), 0);
        return { audioQueue: newQueue, isPlayingAudio: true };
      }
      return { audioQueue: newQueue };
    });
  },

  playNextAudio: () => {
    const { audioQueue, isAudioEnabled } = get();
    if (audioQueue.length === 0 || !isAudioEnabled) {
      set({ isPlayingAudio: false });
      return;
    }

    if (activeAudio) {
      try { activeAudio.pause(); } catch (e) {}
      activeAudio = null;
    }

    const nextUrl = audioQueue[0];
    const audio = new Audio(nextUrl);
    activeAudio = audio;
    
    audio.onended = () => {
      activeAudio = null;
      set((state) => ({
        audioQueue: state.audioQueue.slice(1)
      }));
      get().playNextAudio();
    };

    audio.onerror = (e) => {
      console.error("Audio playback error:", e);
      activeAudio = null;
      set((state) => ({
        audioQueue: state.audioQueue.slice(1)
      }));
      get().playNextAudio();
    };

    audio.play().catch((err) => {
      console.error("Audio autoplay failed or was prevented:", err);
      // Skip this item so the queue doesn't get stuck
      activeAudio = null;
      set((state) => ({
        audioQueue: state.audioQueue.slice(1)
      }));
      get().playNextAudio();
    });
  },

  toggleAudioEnabled: () => set((state) => {
    const nextEnabled = !state.isAudioEnabled;
    if (!nextEnabled) {
      if (activeAudio) {
        try { activeAudio.pause(); } catch (e) {}
        activeAudio = null;
      }
      return { isAudioEnabled: nextEnabled, audioQueue: [], isPlayingAudio: false };
    }
    return { isAudioEnabled: nextEnabled };
  }),
}));