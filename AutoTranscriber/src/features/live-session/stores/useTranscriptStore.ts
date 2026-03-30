import { create } from 'zustand';

// ----------------------------------------------------------------------
// Cache the PROMISE of the translator, not just the resolved instance.
// This prevents concurrent initialization deadlocks when interim results
// fire dozens of times per second.
// ----------------------------------------------------------------------
let chromeTranslatorPromise: Promise<any> | null = null;
let chromeTranslatorLang: string | null = null;

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
  addTranscript: (id: number, text: string) => void;
  setInterimTranscript: (text: string) => void;
  reset: () => void;
}

export const useTranscriptStore = create<TranscriptState>()((set, get) => ({
  isConnected: false,
  transcripts: [],
  interimTranscript: '',
  interimTranslation: '', 
  // targetLang: 'nl',
  targetLang: 'en',

  setConnectionStatus: (status) => set({ isConnected: status }),

  setTargetLang: (lang) => set({ targetLang: lang }),

  addTranscript: (id, text) => {
    const { targetLang } = get();
    const MAX_ITEMS = 5000;

    set((state) => {
      const newEntry: TranscriptLine = { id, text, isFinal: true };
      const newTranscripts = [...state.transcripts, newEntry];

      if (newTranscripts.length > MAX_ITEMS) {
        return {
          transcripts: newTranscripts.slice(newTranscripts.length - MAX_ITEMS),
          interimTranscript: '',
          interimTranslation: '', // Clear translation on finalization
        };
      }
      return { 
        transcripts: newTranscripts, 
        interimTranscript: '',
        interimTranslation: ''    // Clear translation on finalization
      };
    });

    // Final text still uses the robust Google API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURI(text)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const translation = data[0][0][0];

        set((state) => ({
          transcripts: state.transcripts.map((item) =>
            item.id === id ? { ...item, translation } : item
          ),
        }));
      })
      .catch((err) => console.error('Translation error', err));
  },

  setInterimTranscript: async (text) => {
    // 1. Instantly update the UI with the original text
    set({ interimTranscript: text });

    if (!text.trim()) {
      set({ interimTranslation: '' });
      return;
    }

    // 2. Explicitly check if the NEW Global API exists
    if (!('Translator' in self)) {
      console.warn('Chrome Global Translator API not found. Did you enable the optimization-guide-on-device-model flag?');
      return;
    }

    try {
      const { targetLang } = get();

      // 3. Prevent concurrent initializations by caching the PROMISE
      if (!chromeTranslatorPromise || chromeTranslatorLang !== targetLang) {
        chromeTranslatorLang = targetLang;
        console.log(`Initializing local Chrome AI translator for pt -> ${targetLang}...`);
        
        // NEW SYNTAX: Use global Translator.create() instead of self.translation
        chromeTranslatorPromise = (self as any).Translator.create({
          sourceLanguage: 'pt',
          targetLanguage: targetLang,
        });
      }

      // Wait for the singleton translator to be ready 
      const translator = await chromeTranslatorPromise;

      // 4. Translate using local AI
      const translation = await translator.translate(text);
      // console.log('Interim translation success:', translation);

      // 5. Race condition check: Ensure the text hasn't changed
      if (get().interimTranscript === text) {
        set({ interimTranslation: translation });
      }
    } catch (error) {
      console.error('Local Chrome translation error:', error);
      // Reset the promise so the app can try to initialize again on the next update
      chromeTranslatorPromise = null; 
    }
  },

  reset: () => set({ 
    transcripts: [], 
    interimTranscript: '', 
    interimTranslation: '', 
    isConnected: false 
  }),
}));