import React, { memo } from 'react';

interface TranscriptItemProps {
  text: string;
  translation?: string;
  isFinal: boolean;
}

const TranscriptItem: React.FC<TranscriptItemProps> = ({ 
  text, 
  translation, 
  isFinal 
}) => {
  return (
    <div
      className={`p-2 rounded-[12px] border break-words shadow-md transition-all duration-200 ${
        isFinal
          ? 'bg-white border-gray-200 text-gray-800'
          : 'bg-gray-50 border-gray-100 text-gray-400 italic' // Slightly lighter text for interim
      }`}
    >
      <p className="text-2xl font-medium">{text}</p>

      {/* Remove "isFinal &&" to allow interim translations to show */}
      {translation && (
        <p className={`text-m mt-1 border-t pt-1 border-gray-100 animate-in fade-in duration-300 italic ${
            isFinal ? 'text-gray-500' : 'text-gray-400'
        }`}>
          {translation}
        </p>
      )}
    </div>
  );
};

export default memo(TranscriptItem);