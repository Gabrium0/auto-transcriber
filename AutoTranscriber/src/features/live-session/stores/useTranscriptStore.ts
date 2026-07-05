import { create } from 'zustand';

// ----------------------------------------------------------------------
// Cache the PROMISE of the translator.
// ----------------------------------------------------------------------
let chromeTranslatorPromise: Promise<any> | null = null;
let chromeTranslatorLang: string | null = null;

/**
 * Helper to ensure we only have one translator instance at a time
 * and re-initialize if the target language changes.
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

export interface TranscriptLine {
  id: number;
  text: string;
  translation?: string;
  isFinal: boolean;
}

interface TranscriptState {
  isConnected: boolean;
  transcripts: TranscriptLine[];
  interimTranscript: string;
  interimTranslation: string; 
  targetLang: string;

  setConnectionStatus: (status: boolean) => void;
  setTargetLang: (lang: string) => void;
  addTranscript: (id: number, text: string) => Promise<void>;
  setInterimTranscript: (text: string) => Promise<void>;
  reset: () => void;
}

export const useTranscriptStore = create<TranscriptState>()((set, get) => ({
  isConnected: false,
  transcripts: [],
  interimTranscript: '',
  interimTranslation: '', 
  targetLang: 'en',

  setConnectionStatus: (status) => set({ isConnected: status }),

  setTargetLang: (lang) => set({ targetLang: lang }),

  addTranscript: async (id, text) => {
    const { targetLang } = get();
    const MAX_ITEMS = 5000;

    // 1. Immediately add the text to the transcript list and clear interim
    set((state) => {
      const newEntry: TranscriptLine = { id, text, isFinal: true };
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

    // 2. Translate using Local Chrome AI
    try {
      const translator = await getChromeTranslator(targetLang);
      const translation = await translator.translate(text);

      set((state) => ({
        transcripts: state.transcripts.map((item) =>
          item.id === id ? { ...item, translation } : item
        ),
      }));
    } catch (err) {
      console.error('Final translation error (Local AI):', err);
      // Optional: Fallback to Google API here if local fails
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

  reset: () => set({ 
    transcripts: [], 
    interimTranscript: '', 
    interimTranslation: '', 
    isConnected: false 
  }),
}));