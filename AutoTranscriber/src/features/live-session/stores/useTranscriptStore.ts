import { create } from 'zustand';

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
  targetLang: 'nl',

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
        };
      }
      return { transcripts: newTranscripts, interimTranscript: '' };
    });

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

  setInterimTranscript: (text) => set({ interimTranscript: text }),

  reset: () => set({ transcripts: [], interimTranscript: '', isConnected: false }),
}));