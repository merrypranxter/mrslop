import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Volume2, Copy, FileText, File, Download } from 'lucide-react';
import { readAloud, stopReading } from '../services/audioService';
import { exportMessageToPDF, exportMessageToTXT } from '../services/exportService';

interface MessageActionsProps {
  content: string;
  onExportWhole?: (type: 'txt' | 'pdf') => void;
}

const MessageActions: React.FC<MessageActionsProps> = ({ content, onExportWhole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showExportSub, setShowExportSub] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowExportSub(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRead = (tiktokMode: boolean) => {
    if (isReading) {
      stopReading();
      setIsReading(false);
    } else {
      setIsReading(true);
      readAloud(content, tiktokMode, undefined, () => setIsReading(false));
    }
    setIsOpen(false);
  };

  const handleAudioMouseDown = () => {
    audioTimerRef.current = setTimeout(() => {
      handleRead(true); // TikTok mode
    }, 2000);
  };

  const handleAudioMouseUp = () => {
    if (audioTimerRef.current) {
      clearTimeout(audioTimerRef.current);
      audioTimerRef.current = null;
      // If we haven't triggered long press yet, trigger normal read
      if (!isReading) handleRead(false); 
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsOpen(false);
  };

  const handleExport = (type: 'txt' | 'pdf') => {
    if (type === 'txt') exportMessageToTXT(content);
    else exportMessageToPDF(content);
    setIsOpen(false);
    setShowExportSub(false);
  };

  return (
    <div className="relative inline-block ml-2 align-top" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-green-700 hover:text-green-400 transition-colors p-2 -m-1"
      >
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-black border border-green-600 shadow-[0_0_15px_rgba(0,255,0,0.2)] z-50 text-xs font-mono">
          <ul className="py-1 text-green-400">
            
            {/* Read Aloud */}
            <li 
              onMouseDown={handleAudioMouseDown}
              onMouseUp={handleAudioMouseUp}
              onMouseLeave={() => { if(audioTimerRef.current) clearTimeout(audioTimerRef.current); }}
              className="px-4 py-2 hover:bg-green-900/30 cursor-pointer flex items-center gap-2 select-none"
              title="Hold 2s for TikTok Mode"
            >
              <Volume2 size={12} className={isReading ? "animate-pulse text-yellow-500" : ""} />
              {isReading ? "STOP AUDIO" : "READ ALOUD"}
            </li>

            {/* Copy */}
            <li 
              onClick={handleCopy}
              className="px-4 py-2 hover:bg-green-900/30 cursor-pointer flex items-center gap-2"
            >
              <Copy size={12} />
              COPY
            </li>

            {/* Export Submenu Trigger */}
            <li 
              className="relative px-4 py-2 hover:bg-green-900/30 cursor-pointer flex items-center justify-between group"
              onMouseEnter={() => setShowExportSub(true)}
              onClick={(e) => { e.stopPropagation(); setShowExportSub(!showExportSub); }}
            >
              <div className="flex items-center gap-2">
                <FileText size={12} />
                EXPORT
              </div>
              <ChevronDown size={10} className="-rotate-90" />
              
              {/* Submenu */}
              {showExportSub && (
                <div className="absolute right-full top-0 mr-1 w-32 bg-black border border-green-600 shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                  <ul>
                    <li 
                      onClick={(e) => { e.stopPropagation(); handleExport('txt'); }}
                      className="px-4 py-2 hover:bg-green-900/30 cursor-pointer flex items-center gap-2"
                    >
                      <FileText size={12} /> TXT
                    </li>
                    <li 
                      onClick={(e) => { e.stopPropagation(); handleExport('pdf'); }}
                      className="px-4 py-2 hover:bg-green-900/30 cursor-pointer flex items-center gap-2"
                    >
                      <File size={12} /> PDF
                    </li>
                  </ul>
                </div>
              )}
            </li>

            {/* Export Whole Conversation */}
            {onExportWhole && (
              <li 
                onClick={(e) => { e.stopPropagation(); onExportWhole('pdf'); setIsOpen(false); }}
                className="px-4 py-2 hover:bg-green-900/30 cursor-pointer flex items-center gap-2 border-t border-green-900/30 mt-1 pt-2 text-[10px] text-yellow-500"
              >
                <Download size={12} /> EXPORT_ALL (PDF)
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MessageActions;