import React, { useState } from 'react';
import { Session } from '../types';
import { Trash2, Plus, Search, Terminal, Download, FileText } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  sessions: Session[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onExportSession: (id: string, type: 'txt' | 'pdf') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewChat, 
  onDeleteSession,
  onExportSession
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Added safety checks (?. and ||) to prevent crashes on malformed data
  const filteredSessions = sessions.filter(s => {
    const title = s.title || '';
    const messages = s.messages || [];
    const term = searchTerm.toLowerCase();
    
    return title.toLowerCase().includes(term) || 
           messages.some(m => (m.content || '').toLowerCase().includes(term));
  }).sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

  if (!isOpen) return null;

  return (
    <div className="w-64 border-r-2 border-green-900/50 bg-black/95 flex flex-col h-full absolute md:relative z-20 shadow-xl transition-all">
      {/* Header */}
      <div className="p-4 border-b border-green-800 bg-green-950/20">
        <h2 className="text-green-500 font-bold mb-4 flex items-center gap-2">
            <Terminal size={16} /> GHOST_ARCHIVE
        </h2>
        
        <button 
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-green-900/30 hover:bg-green-500 hover:text-black border border-green-600 text-green-400 py-2 px-4 transition-all text-xs font-bold"
        >
          <Plus size={14} /> NEW_OPERATION
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-green-900/50">
        <div className="relative">
            <input 
                type="text" 
                placeholder="DEEP_SEARCH..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black border border-green-800 text-green-500 text-sm p-2.5 pl-9 focus:border-green-500 outline-none placeholder-green-800"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
            />
            <Search size={14} className="absolute left-3 top-3 text-green-700" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredSessions.map(session => (
            <div 
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group p-4 border border-transparent hover:border-green-700 cursor-pointer transition-all ${session.id === currentSessionId ? 'bg-green-900/30 border-green-600' : 'opacity-70 hover:opacity-100'}`}
            >
                <div className="flex justify-between items-start mb-1">
                    <span className="text-green-400 text-xs font-bold truncate flex-1">{session.title || 'UNKNOWN_OP'}</span>
                    <span className="text-[10px] text-green-800">{new Date(session.lastModified || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="text-[10px] text-green-600/70 truncate font-mono">
                    {session.messages && session.messages.length > 0 
                      ? session.messages[session.messages.length - 1]?.content.substring(0, 40) 
                      : "EMPTY_LOG"}
                </div>
                
                {/* Actions */}
                <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onExportSession(session.id, 'txt'); }}
                        className="text-green-600 hover:text-green-300" 
                        title="EXPORT TXT"
                    >
                        <FileText size={12} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onExportSession(session.id, 'pdf'); }}
                        className="text-green-600 hover:text-green-300" 
                        title="EXPORT PDF"
                    >
                        <Download size={12} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                        className="text-red-900 hover:text-red-500" 
                        title="PURGE"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        ))}
        {filteredSessions.length === 0 && (
            <div className="text-center text-green-900 text-xs mt-4">NO_ARCHIVES_FOUND</div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-green-900/50 text-[10px] text-green-800 text-center">
        STORAGE: ENCRYPTED
      </div>
    </div>
  );
};

export default Sidebar;