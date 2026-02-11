import { create } from 'zustand';

interface AutoScrollState {
    isAutoScrollEnabled: boolean;
    setAutoScroll: (enabled: boolean) => void;
    toggleAutoScroll: () => void;
}

export const useAutoScrollStore = create<AutoScrollState>((set) => ({
    isAutoScrollEnabled: true,
    setAutoScroll: (enabled) => set({ isAutoScrollEnabled: enabled }),
    toggleAutoScroll: () => set((state) => ({ isAutoScrollEnabled: !state.isAutoScrollEnabled })),
}));