import { useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Volume2, VolumeX } from 'lucide-react';
import useLiveSocket from '../hooks/useLiveSocket';
import { useTranscriptStore } from '../stores/useTranscriptStore';
import TranscriptItem from './TranscriptItem';
import useAutoScroll from '../hooks/useAutoScroll';

export default function TranscriptList() {
    useLiveSocket();

    const transcripts = useTranscriptStore((state) => state.transcripts);
    const interimTranscript = useTranscriptStore((state) => state.interimTranscript);

    const interimTranslation = useTranscriptStore((state) => state.interimTranslation); // 1. Add this
    
    const isConnected = useTranscriptStore((state) => state.isConnected);

    const targetLang = useTranscriptStore((state) => state.targetLang);
    const setTargetLang = useTranscriptStore((state) => state.setTargetLang);
    const isAudioEnabled = useTranscriptStore((state) => state.isAudioEnabled);
    const toggleAudioEnabled = useTranscriptStore((state) => state.toggleAudioEnabled);

    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const scrollTrigger = `${transcripts.length}-${interimTranscript}`;

    const {
        isAutoScrollEnabled,
        handleToggle,
        handleAtBottomStateChange,
    } = useAutoScroll(virtuosoRef, scrollTrigger);

    return (
        <div className="transcript-container flex flex-col h-full w-full relative">
            <div className="status-bar p-4 border-b flex justify-between items-center bg-gray-100 flex-shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold">Live Session</h2>
                    <button
                        onClick={handleToggle}
                        className={`text-xs px-3 py-1 border rounded transition-colors flex items-center gap-2 ${isAutoScrollEnabled
                            ? 'bg-blue-100 border-blue-300 text-blue-700 font-semibold'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        {isAutoScrollEnabled ? '↓ Auto-Scroll: ON' : 'Auto-Scroll: OFF'}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleAudioEnabled}
                        className={`p-1.5 border rounded hover:bg-gray-50 transition-colors flex items-center justify-center ${
                            isAudioEnabled 
                                ? 'bg-blue-50 border-blue-200 text-blue-600' 
                                : 'bg-gray-50 border-gray-300 text-gray-400'
                        }`}
                        title={isAudioEnabled ? "Mute TTS Audio" : "Unmute TTS Audio"}
                    >
                        {isAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>

                    <label className="text-xs text-gray-500 font-medium">Translate to:</label>
                    <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="text-sm p-1 border rounded bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="nl">Dutch (NL)</option>
                        <option value="en">English (EN)</option>
                        <option value="es">Spanish (ES)</option>
                        <option value="fr">French (FR)</option>
                        <option value="de">German (DE)</option>
                        <option value="it">Italian (IT)</option>
                        <option value="pt">Portuguese (PT)</option>
                    </select>

                    <span className={`ml-2 text-xs px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {isConnected ? '●' : '○'}
                    </span>
                </div>
            </div>

            <div className="list-content flex-1 bg-gray-100 overflow-hidden relative ">
                <Virtuoso
                    ref={virtuosoRef}
                    className="h-full"
                    data={transcripts}
                    followOutput={isAutoScrollEnabled ? 'smooth' : false}
                    atBottomStateChange={handleAtBottomStateChange}
                    itemContent={(_, item) => (
                        <div className="px-4 py-2">
                            <TranscriptItem
                                text={item.text}
                                translation={item.translation}
                                isFinal={true}
                            />
                        </div>
                    )}
                    components={{
                        Footer: () => (
                            interimTranscript ? (
                                <div className="px-4 py-2 pb-4">
                                    <TranscriptItem
                                        text={`${interimTranscript}...`}
                                        translation={interimTranslation} // 2. Pass it here
                                        isFinal={false}
                                    />
                                </div>
                            ) : null
                        )
                    }}
                />
            </div>
        </div>
    );
}