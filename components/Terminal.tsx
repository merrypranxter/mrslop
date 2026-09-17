import React, { useState, useEffect, useRef } from 'react';
import { Message, Role, Attachment, Session } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { processFile } from '../services/fileService';
import { readAloud, stopReading } from '../services/audioService';
import { startListening, stopListening, isSpeechSupported } from '../services/speechService';
import { encryptText, decryptText, generateSessionId, generateId } from '../services/cryptoService';
import { INITIAL_BOOT_SEQUENCE } from '../constants';
import ParsedMessage from './ParsedMessage';
import MessageActions from './MessageActions';
import Sidebar from './Sidebar';
import { exportConversationToPDF, exportConversationToTXT } from '../services/exportService';
import { Send, Terminal as TerminalIcon, Power, Activity, Database, FolderUp, Image, X, Paperclip, Menu, Mic, MicOff, RefreshCw, Square, Plus, Download, ChevronDown, FileText } from 'lucide-react';
import localforage from 'localforage';

const MediaPreview: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (attachment.fileHandle) {
            const objectUrl = URL.createObjectURL(attachment.fileHandle);
            setUrl(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        } else if (attachment.isInlineData && attachment.data && !attachment.data.startsWith('[')) {
            setUrl(`data:${attachment.mimeType};base64,${attachment.data}`);
        }
    }, [attachment]);

    if (!url) return <div className="text-[10px] opacity-50 italic">DATA_BUFFERED</div>;

    if (attachment.mimeType.startsWith('video/')) {
        return (
            <div className="mt-2 relative">
                <video 
                    src={url} 
                    className="max-w-full md:max-w-md h-auto border-2 border-green-500/30 rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.2)] bg-black/80" 
                    controls 
                    playsInline
                />
                <div className="absolute top-1 right-1 bg-black/60 px-1 text-[8px] text-green-500 font-bold border border-green-500/30">
                    GHOST_VISION_FEED
                </div>
            </div>
        );
    }

    if (attachment.mimeType.startsWith('image/')) {
        return (
            <div className="mt-2 relative">
                <img 
                    src={url} 
                    alt={attachment.name} 
                    className="max-w-full md:max-w-md h-auto border-2 border-green-500/30 rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.2)] bg-black/80" 
                />
                <div className="absolute top-1 right-1 bg-black/60 px-1 text-[8px] text-green-500 font-bold border border-green-500/30">
                    SCAN_CAPTURE
                </div>
            </div>
        );
    }

    return null;
};

const Terminal: React.FC = () => {
  // Session State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  
  // Terminal State
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bootSequence, setBootSequence] = useState<string[]>([]);
  const [isBooted, setIsBooted] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  // Speech State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Enhancement States
  const [roleMask, setRoleMask] = useState(false);
  
  // Auto-Recon / Daemon State
  const [autoReconActive, setAutoReconActive] = useState(false);
  const [autoReconEndTime, setAutoReconEndTime] = useState<number | null>(null);
  const [autoReconStepCount, setAutoReconStepCount] = useState(0);
  const MAX_RECON_STEPS = 15; // Safety limit per session
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const autoReconTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalExportRef = useRef<HTMLDivElement>(null);
  const lastProcessedMsgIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Initialization & Session Management ---

  // Load Sessions from Storage (Migrate LS -> IndexedDB)
  useEffect(() => {
    const initSessionStorage = async () => {
        try {
            // 1. Try IndexedDB (LocalForage)
            let loaded: Session[] | null = await localforage.getItem<Session[]>('ghost_sessions');

            // 2. Fallback/Migrate from LocalStorage
            if (!loaded) {
                const ls = localStorage.getItem('ghost_sessions');
                if (ls) {
                    try {
                        loaded = JSON.parse(ls);
                        // Migrate
                        if (loaded) await localforage.setItem('ghost_sessions', loaded);
                    } catch (e) {
                        console.warn("Migration failed", e);
                    }
                }
            }

            if (loaded && Array.isArray(loaded)) {
                // --- CRITICAL REPAIR: deduplicate IDs if any collisions exist from legacy generation ---
                const sessionMap = new Map<string, Session>();
                const sanitized = loaded.map(s => {
                    // Ensure session ID is unique
                    let sId = s.id || generateSessionId();
                    while(sessionMap.has(sId)) {
                        sId = generateSessionId();
                    }
                    
                    const msgMap = new Set<string>();
                    const sanitizedMessages = (s.messages || []).map(m => {
                        let mId = m.id || generateId();
                        // If ID exists or is a plain timestamp that might collide
                        if (msgMap.has(mId) || /^\d+$/.test(mId)) {
                            mId = generateId();
                        }
                        msgMap.add(mId);

                        // Also sanitize attachment IDs
                        const sanitizedAttachments = (m.attachments || []).map(a => {
                           if (!a.id || /^\d+$/.test(a.id)) return { ...a, id: generateId() };
                           return a;
                        });

                        return { ...m, id: mId, attachments: sanitizedAttachments };
                    });

                    const finalSession = { ...s, id: sId, messages: sanitizedMessages };
                    sessionMap.set(sId, finalSession);
                    return finalSession;
                });

                if (sanitized.length > 0) {
                    setSessions(sanitized);
                    const recent = [...sanitized].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))[0];
                    setCurrentSessionId(recent.id);
                    setHistory(recent.messages);
                } else {
                    createNewSession();
                }
            } else {
                createNewSession();
            }
        } catch (err) {
            console.error("Storage Error:", err);
            createNewSession();
        }
        
        setSpeechSupported(isSpeechSupported());
        startBootSequence();
    };

    initSessionStorage();
  }, []);

  // Save Sessions to LocalStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
        const saveSessions = async () => {
            try {
                // OPTIMIZATION: Sanitize sessions before saving.
                // We strip large base64 data from attachments in the history to save space.
                const sanitizedSessions = sessions.map(s => ({
                    ...s,
                    messages: s.messages.map(m => ({
                        ...m,
                        attachments: m.attachments?.map(a => ({
                            ...a,
                            // If inline data (base64 image/audio), remove it to save space.
                            // Keep text data (code files, logs).
                            data: a.isInlineData ? '[DATA_PURGED_FOR_PERSISTENCE]' : a.data
                        }))
                    }))
                }));
                
                await localforage.setItem('ghost_sessions', sanitizedSessions);
            } catch (e) {
                console.error("Session save failed:", e);
                // We do NOT use a destructive fallback here anymore.
                // If save fails, we log it, but we don't overwrite history with a partial save.
            }
        };
        saveSessions();
    }
  }, [sessions, currentSessionId]);

  // Sync current history to current session
  useEffect(() => {
    if (!currentSessionId) return;
    
    setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
            return {
                ...s,
                messages: history,
                lastModified: Date.now(),
                // Update title based on first user message if still default
                title: (s.title === 'NEW_OPERATION' && history.length > 0) 
                    ? history.find(m => m.role === Role.USER)?.content.substring(0, 30).toUpperCase() || 'NEW_OPERATION'
                    : s.title
            };
        }
        return s;
    }));
  }, [history, currentSessionId]);

  // --- DAEMON LOOP: Recursive Auto-Recon ---
  useEffect(() => {
    if (!autoReconActive) {
        if (autoReconTimeoutRef.current) {
            clearTimeout(autoReconTimeoutRef.current);
            autoReconTimeoutRef.current = null;
        }
        return;
    }

    // Check if time expired
    if (autoReconEndTime && Date.now() > autoReconEndTime) {
        setAutoReconActive(false);
        addSystemMessage(">>> AUTO_RECON: TIMER EXPIRED. DAEMON THREAD TERMINATED.");
        return;
    }

    // Check if step limit reached
    if (autoReconStepCount >= MAX_RECON_STEPS) {
        setAutoReconActive(false);
        addSystemMessage(">>> AUTO_RECON: MAXIMUM RECURSION DEPTH REACHED. DAEMON TERMINATED FOR SAFETY.");
        return;
    }

    const lastMsg = history[history.length - 1];
    
    // If the MODEL just spoke, check for [NEXT_STEP] tag
    // CRITICAL: We must only process each message ONCE to avoid infinite loops and API spam
    if (lastMsg && lastMsg.role === Role.MODEL && !isProcessing && lastMsg.id !== lastProcessedMsgIdRef.current) {
        const nextStepMatch = lastMsg.content.match(/\[NEXT_STEP:(.*?)\]/);
        
        if (nextStepMatch && nextStepMatch[1]) {
            const nextQuery = nextStepMatch[1].trim();
            
            // Mark as processed immediately to prevent duplicate triggers from state updates
            lastProcessedMsgIdRef.current = lastMsg.id;
            
            // Artificial delay to simulate "thinking" and prevent API spam
            // Increased to 8s for better stability
            autoReconTimeoutRef.current = setTimeout(() => {
                setAutoReconStepCount(prev => prev + 1);
                handleSendInternal(`[DAEMON_TRIGGER] EXECUTING RECURSIVE STEP: ${nextQuery}`, []);
            }, 8000); 
        } else {
            // No next step found, or explicitly stopped
            setAutoReconActive(false);
            addSystemMessage(">>> AUTO_RECON: NO FURTHER VECTORS IDENTIFIED. THREAD IDLE.");
        }
    }

    return () => {
        if (autoReconTimeoutRef.current) {
            clearTimeout(autoReconTimeoutRef.current);
            autoReconTimeoutRef.current = null;
        }
    };
  }, [history, autoReconActive, isProcessing, autoReconEndTime]);

  // Close global export on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (globalExportRef.current && !globalExportRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGlobalExport = (type: 'txt' | 'pdf') => {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      const title = currentSession?.title || 'CONVO_EXPORT';
      if (type === 'txt') exportConversationToTXT(history, title);
      else exportConversationToPDF(history, title);
      setIsExportOpen(false);
  };

  const startBootSequence = () => {
    let delay = 0;
    setBootSequence([]);
    INITIAL_BOOT_SEQUENCE.forEach((line, index) => {
      delay += Math.random() * 400 + 200; 
      setTimeout(() => {
        setBootSequence(prev => [...prev, line]);
        if (index === INITIAL_BOOT_SEQUENCE.length - 1) {
           setTimeout(() => setIsBooted(true), 600);
        }
      }, delay);
    });
  };

  const createNewSession = () => {
    const newId = generateSessionId();
    const newSession: Session = {
        id: newId,
        title: 'NEW_OPERATION',
        messages: [],
        createdAt: Date.now(),
        lastModified: Date.now()
    };
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newId);
    setHistory([]);
    setAttachments([]);
    setRoleMask(false);
    setAutoReconActive(false);
    if (window.innerWidth < 768) setIsSidebarOpen(false); // Close sidebar on mobile
  };

  const switchSession = (id: string) => {
      const session = sessions.find(s => s.id === id);
      if (session) {
          setCurrentSessionId(id);
          setHistory(session.messages);
          setAttachments([]);
          setRoleMask(false); 
          setAutoReconActive(false);
          if (window.innerWidth < 768) setIsSidebarOpen(false);
      }
  };

  const deleteSession = (id: string) => {
      const remaining = sessions.filter(s => s.id !== id);
      setSessions(remaining);
      if (currentSessionId === id) {
          if (remaining.length > 0) {
              switchSession(remaining[0].id);
          } else {
              createNewSession();
          }
      }
  };

  // --- Terminal Logic ---

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, bootSequence, isProcessing, attachments]);

  const executeInterfaceCommand = (cmd: string, content: string) => {
    console.log("EXECUTING PROTOCOL:", cmd);
    switch (cmd) {
      case 'READ_ALOUD':
        readAloud(content, false, () => setIsSpeaking(true), () => setIsSpeaking(false));
        break;
      case 'READ_ALOUD_GLITCH':
        readAloud(content, true, () => setIsSpeaking(true), () => setIsSpeaking(false));
        break;
      case 'EXPORT_PDF':
        exportConversationToPDF(history); 
        break;
      case 'EXPORT_TXT':
        exportConversationToTXT(history);
        break;
      case 'UPLOAD_DIALOG':
        setTimeout(() => fileInputRef.current?.click(), 100);
        break;
      default:
        break;
    }
  };

  const handleSystemCommands = (rawInput: string): boolean => {
    const cleanInput = rawInput.trim();
    
    // --- AUTO RECON ---
    // Matches > system.auto_recon("topic", 30)
    if (cleanInput.startsWith('> system.auto_recon')) {
        const matches = cleanInput.match(/> system\.auto_recon\("(.*?)",\s*(\d+)\)/);
        if (matches) {
            const topic = matches[1];
            const minutes = parseInt(matches[2]);
            const durationMs = minutes * 60 * 1000;
            
            setAutoReconEndTime(Date.now() + durationMs);
            setAutoReconStepCount(0); // Reset counter
            setAutoReconActive(true);
            
            // Trigger the first message to start the loop
            handleSendInternal(
                `[SYSTEM_OVERRIDE] INITIATE AUTONOMOUS RECON DAEMON.\nTARGET: "${topic}"\nDURATION: ${minutes} MINUTES.\nPROTOCOL: Generate [NEXT_STEP] tags recursively.`, 
                []
            );
            return true;
        }
        addSystemMessage(">>> SYNTAX ERROR. USAGE: > system.auto_recon(\"topic\", minutes)");
        return true;
    }

    if (cleanInput === '> system.mask_on()') {
        setRoleMask(true);
        addSystemMessage(">>> ROLE_MASK: ACTIVE. PUBLIC PERSONA ENGAGED.");
        return true;
    }
    if (cleanInput === '> system.mask_off()') {
        setRoleMask(false);
        addSystemMessage(">>> ROLE_MASK: DISABLED. GHOST PROTOCOL RESUMED.");
        return true;
    }
    if (cleanInput.startsWith('> system.encrypt("')) {
        const text = cleanInput.match(/> system\.encrypt\("(.*)"\)/)?.[1];
        if (text) {
            const encrypted = encryptText(text);
            addSystemMessage(`[ENCRYPTION_RESULT]\n${encrypted}`);
            return true;
        }
    }
    if (cleanInput.startsWith('> system.decrypt("')) {
        const text = cleanInput.match(/> system\.decrypt\("(.*)"\)/)?.[1];
        if (text) {
            const decrypted = decryptText(text);
            addSystemMessage(`[DECRYPTION_RESULT]\n${decrypted}`);
            return true;
        }
    }
    if (cleanInput.startsWith('> system.deep_search("')) {
        const query = cleanInput.match(/> system\.deep_search\("(.*)"\)/)?.[1]?.toLowerCase();
        if (query) {
            const results: string[] = [];
            sessions.forEach(s => {
                const matches = s.messages.filter(m => m.content.toLowerCase().includes(query));
                if (matches.length > 0) {
                    results.push(`SESSION: ${s.title} (${s.id})`);
                    matches.forEach(m => results.push(`  - [${new Date(m.timestamp).toLocaleTimeString()}]: ${m.content.substring(0, 60)}...`));
                }
            });
            const report = results.length > 0 
                ? `[DEEP_SEARCH_REPORT]\nQUERY: "${query}"\n\n${results.join('\n')}`
                : `[DEEP_SEARCH_REPORT]\nQUERY: "${query}"\n>>> NO_MATCHES_FOUND.`;
            addSystemMessage(report);
            return true;
        }
    }
    if (cleanInput === '> system.generate_link()') {
        addSystemMessage(`[REMOTE_ACCESS_PROTOCOL]\nGENERATING SECURE UPLINK...\nLINK: https://ghost-fragment.net/uplink/${generateSessionId().toLowerCase()}\nEXPIRES: 24h`);
        return true;
    }
    return false;
  };

  const addSystemMessage = (content: string) => {
      setHistory(prev => [...prev, {
          id: generateId(),
          role: Role.SYSTEM,
          content: content,
          timestamp: Date.now()
      }]);
  };

  const checkForCrossSessionRefs = (files: Attachment[]): string => {
      let notes = "";
      files.forEach(file => {
          const refs: string[] = [];
          sessions.forEach(s => {
             if (s.id !== currentSessionId) {
                 const found = s.messages.some(m => m.content.includes(file.name));
                 if (found) refs.push(s.title);
             }
          });
          if (refs.length > 0) {
              notes += `[SYSTEM_NOTE: File '${file.name}' was previously referenced in sessions: ${refs.join(', ')}. Compare findings.]\n`;
          }
      });
      return notes;
  };

  const handleStop = () => {
      stopReading();
      setIsSpeaking(false);
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setIsProcessing(false);
  };

  // Separation of concern: The actual API call logic
  const handleSendInternal = async (msgContent: string, msgAttachments: Attachment[]) => {
    setIsProcessing(true);
    stopReading();
    setIsSpeaking(false);
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // MEMORY OPTIMIZATION:
    // We create a "light" version of attachments for history/state (no massive base64)
    // and keep the "heavy" version only for the direct API call.
    const historyAttachments = msgAttachments.map(a => ({
        ...a,
        data: a.isInlineData ? '[DATA_ACTIVE_IN_BUFFER]' : a.data
    }));
    
    // Add user message to state (with light attachments)
    const userMsg: Message = {
      id: generateId(),
      role: Role.USER,
      content: msgContent,
      timestamp: Date.now(),
      attachments: historyAttachments 
    };

    // Optimistically update history
    setHistory(prev => [...prev, userMsg]);

    const systemNotes = checkForCrossSessionRefs(msgAttachments);

    // Call API with CURRENT history (plus the new message we just created)
    // and the RAW attachments (with data)
    const historyPayload = [...history, userMsg];

    try {
      const responseTextRaw = await sendMessageToGemini(
          historyPayload, 
          msgContent, 
          msgAttachments, // RAW DATA HERE
          roleMask,
          systemNotes,
          signal
      );
      
      // Cleanup: Finalize history state by replacing placeholder with final note
      setHistory(prev => prev.map(msg => {
          if (msg.id === userMsg.id && msg.attachments) {
              return {
                  ...msg,
                  attachments: msg.attachments.map(a => ({ 
                      ...a, 
                      data: a.isInlineData ? '[ANALYSIS_COMPLETE]' : a.data 
                  }))
              };
          }
          return msg;
      }));

      // Handle Network Instability caused by AutoRecon spam
      if (responseTextRaw.includes("CONNECTION UNSTABLE") || responseTextRaw.includes("CRITICAL ERROR") || responseTextRaw.includes("429_RESOURCE_EXHAUSTED")) {
          if (autoReconActive) {
              setAutoReconActive(false);
              setTimeout(() => {
                  addSystemMessage(">>> SYSTEM_ALERT: NETWORK INSTABILITY DETECTED. AUTO_RECON PAUSED TO PRESERVE INTEGRITY.");
              }, 500);
          }
      }

      const commandRegex = /\[\[EXECUTE:(\w+)\]\]/g;
      let finalContent = responseTextRaw;
      let detectedCommand: string | null = null;

      const match = commandRegex.exec(responseTextRaw);
      if (match) {
          detectedCommand = match[1];
          finalContent = responseTextRaw.replace(match[0], '').trim();
      }

      const botMsg: Message = {
        id: generateId(),
        role: Role.MODEL,
        content: finalContent,
        timestamp: Date.now()
      };

      setHistory(prev => [...prev, botMsg]);

      if (detectedCommand) {
          if (detectedCommand.includes('EXPORT')) {
               const currentSession = sessions.find(s => s.id === currentSessionId);
               const fullHistoryForExport = [...historyPayload, botMsg];
               const title = currentSession?.title || 'CONVO_EXPORT';
               
               if (detectedCommand === 'EXPORT_PDF') exportConversationToPDF(fullHistoryForExport, title);
               if (detectedCommand === 'EXPORT_TXT') exportConversationToTXT(fullHistoryForExport, title);
          } else {
              executeInterfaceCommand(detectedCommand, finalContent);
          }
      }
    } catch (err: any) {
        console.error("Transmission Error:", err);
        addSystemMessage(`>>> CRITICAL_FAILURE: TRANSMISSION_TIMEOUT_OR_OVERLOAD.\n>>> ERROR: ${err.message || 'UNKNOWN'}\n>>> ADVISORY: IF YOU UPLOADED A LARGE VIDEO, THE MOBILE BROWSER MAY HAVE KILLED THE PROCESS. TRY A SHORTER CLIP.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isProcessing) return;

    if (isListening) toggleListening(); 

    if (handleSystemCommands(input)) {
        setInput('');
        return;
    }
    
    let displayContent = input;
    if (attachments.length > 0) {
      const fileNames = attachments.map(a => `[FILE: ${a.name}]`).join(' ');
      displayContent = `${fileNames}\n${input}`;
    }

    // Trigger internal send logic
    handleSendInternal(displayContent, attachments);

    // Clear Inputs
    setInput('');
    setAttachments([]); 
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Updated Safety Check: Support larger files but warn about potential instability
      const MAX_SIZE_MB = 300;
      const fileSizeMB = file.size / (1024 * 1024);
      
      if (fileSizeMB > MAX_SIZE_MB) {
        addSystemMessage(`>>> ERROR: FILE_UPLINK_CRITICAL_OVERLOAD.\n>>> FILE: "${file.name}" [${fileSizeMB.toFixed(1)}MB]\n>>> STATUS: BLOCKED.\n>>> ADVISORY: THIS COMPONENT SUPPORTS RECON FOR FILES < ${MAX_SIZE_MB}MB. FOR MASSIVE DATASTREAMS, TRY A SHORTER CLIP.`);
        e.target.value = '';
        return;
      }

      try {
        const processed = await processFile(file);
        setAttachments(prev => [...prev, processed]);
      } catch (err) {
        addSystemMessage(`>>> ERROR: UPLOAD FAILED FOR ${file.name}. DATA_STREAM_CORRUPTED.`);
      }
      e.target.value = ''; 
    }
  };

  // --- Speech Logic ---
  const toggleListening = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      setIsListening(true);
      startListening(
        (text, isFinal) => {
            if (isFinal) {
                setInput(prev => (prev + ' ' + text).trim());
            }
        },
        () => setIsListening(false)
      );
    }
  };

  return (
    <div className="flex h-[100dvh] w-full max-w-6xl mx-auto md:border-x-2 border-green-900/50 bg-black/90 relative z-10 shadow-[0_0_50px_rgba(0,255,0,0.1)] overflow-hidden safe-top safe-bottom safe-left safe-right">
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out shadow-[5px_0_25px_rgba(0,0,0,0.5)]`}>
          <Sidebar 
            isOpen={true} 
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={(id) => { switchSession(id); setIsSidebarOpen(false); }}
            onNewChat={createNewSession}
            onDeleteSession={deleteSession}
            onExportSession={(id, type) => {
                const s = sessions.find(sess => sess.id === id);
                if(s) {
                    if (type === 'txt') exportConversationToTXT(s.messages, s.title);
                    else exportConversationToPDF(s.messages, s.title);
                }
            }}
          />
      </div>

      {/* Main Terminal Area - Added min-w-0 to prevent flex blowout */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
          
          {/* Header */}
          <header className="flex-shrink-0 border-b-2 border-green-600 p-2 md:p-4 flex items-center justify-between bg-green-950/20 relative overflow-hidden">
            <div className="flex items-center gap-1 md:gap-2 min-w-0">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="text-green-500 hover:text-green-300 flex-shrink-0 p-2 -ml-1 transition-transform active:scale-90"
                title="TOGGLE ARCHIVE"
              >
                <Menu size={20} className="md:w-6 md:h-6" />
              </button>
              <TerminalIcon className="text-green-500 flex-shrink-0 w-4 h-4 md:w-5 md:h-5" />
              <div className="flex flex-col min-w-0">
                <h1 className="text-green-400 font-bold tracking-[0.1em] sm:tracking-[0.2em] text-sm md:text-lg text-glow leading-none truncate">
                  PERSISTENCE NODE 2.0
                </h1>
                <span className="text-[9px] md:text-[10px] text-green-700 tracking-widest font-mono truncate">
                    SESSION: {currentSessionId.substring(0, 8)}... {roleMask ? '[MASK]' : ''}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 text-xs font-mono text-green-600 flex-shrink-0 ml-2">
              
              <button 
                onClick={createNewSession}
                className="p-2 text-green-500 hover:text-green-300 transition-colors"
                title="NEW OPERATION"
              >
                <Plus size={20} />
              </button>

              {/* Global Export Dropdown */}
              <div className="relative" ref={globalExportRef}>
                <button 
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  className="flex items-center gap-1 p-2 bg-green-950/30 border border-green-800 text-green-600 hover:bg-green-500 hover:text-black hover:border-green-500 transition-all font-mono font-bold text-[10px] sm:text-xs"
                  title="EXPORT WHOLE CONVERSATION"
                >
                  <Download size={14} className="hidden sm:block" /> 
                  <span className="hidden sm:inline">EXPORT</span>
                  <ChevronDown size={14} className={`transition-transform ${isExportOpen ? 'rotate-180' : ''}`} />
                </button>

                {isExportOpen && (
                  <div className="absolute right-0 top-full mt-2 w-40 bg-black border-2 border-green-600 shadow-[0_0_20px_rgba(0,255,0,0.3)] z-50">
                    <ul className="py-1 text-green-400 font-mono text-xs">
                      <li 
                        onClick={() => handleGlobalExport('txt')}
                        className="px-4 py-3 hover:bg-green-900/40 cursor-pointer flex items-center gap-2 border-b border-green-900/30"
                      >
                        <FileText size={14} /> LOG_AS_TEXT
                      </li>
                      <li 
                        onClick={() => handleGlobalExport('pdf')}
                        className="px-4 py-3 hover:bg-green-900/40 cursor-pointer flex items-center gap-2"
                      >
                        <FolderUp size={14} /> LOG_AS_PDF
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Auto Recon Indicator */}
              {autoReconActive && (
                  <div className="flex items-center gap-2 bg-red-950/50 px-2 py-1 rounded border border-red-800 animate-pulse">
                      <RefreshCw size={12} className="animate-spin text-red-500" />
                      <span className="text-red-400 font-bold hidden sm:inline">DAEMON_RUNNING</span>
                      <button onClick={() => setAutoReconActive(false)} className="hover:text-white text-red-500">
                          <Square size={10} fill="currentColor" />
                      </button>
                  </div>
              )}

              <div className="hidden md:flex items-center gap-1">
                 <Database size={14} className="text-green-800" />
                 <span className="text-green-800">MEM: {sessions.length} BLOCKS</span>
              </div>
              <div className="hidden md:flex items-center gap-1">
                 <Activity size={14} className={isProcessing ? "animate-spin text-yellow-500" : "text-green-600"} />
                 <span className={isProcessing ? "text-yellow-500" : ""}>{isProcessing ? "COMPUTING..." : "IDLE"}</span>
              </div>
              <div className="flex items-center gap-1 text-green-500 text-glow">
                 <Power size={14} />
                 <span>ONLINE</span>
              </div>
            </div>
          </header>

          {/* Main Output */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-2 md:p-4 font-mono text-sm md:text-base space-y-3 md:space-y-4"
          >
            {/* Boot Sequence */}
            <div className="text-green-700/60 mb-8 space-y-1 font-bold text-xs">
              {bootSequence.map((line, i) => (
                 <div key={`${i}-${line.substring(0, 10)}`} className="flex gap-2">
                   <span className="opacity-50">[{i.toString().padStart(2, '0')}]</span>
                   <span>{line}</span>
                 </div>
              ))}
            </div>

            {/* Messages */}
            {isBooted && history.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === Role.USER ? 'items-end' : 'items-start'} max-w-full`}>
                <div className={`max-w-[95%] md:max-w-[90%] ${msg.role === Role.USER ? 'text-right' : 'text-left'}`}>
                  
                  <div className={`text-xs mb-1 opacity-50 font-bold flex items-center gap-2 ${msg.role === Role.USER ? 'justify-end text-yellow-500' : 'text-green-500'}`}>
                    {msg.role === Role.USER ? (msg.content.includes('[DAEMON_TRIGGER]') ? 'SYSTEM_DAEMON' : 'OPERATIVE') : 'NODE_771'}
                    <span className="font-normal opacity-50 font-mono">[{new Date(msg.timestamp).toLocaleTimeString([], {hour12: false})}]</span>
                  </div>

                  <div className={`relative group ${msg.role === Role.USER ? 'text-yellow-100' : msg.role === Role.SYSTEM ? 'text-red-500 font-bold' : 'text-green-400 text-glow'}`}>
                    {msg.role === Role.USER ? (
                       <div className="flex flex-col gap-2">
                           <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                           {msg.attachments && msg.attachments.length > 0 && (
                               <div className="flex flex-col gap-2 mt-2 items-end">
                                   {msg.attachments.map((a) => (
                                       <div key={a.id || a.name} className="flex flex-col items-end">
                                           <div className="text-[10px] bg-yellow-900/40 border border-yellow-700/50 px-2 py-0.5 rounded flex items-center gap-1 mb-1">
                                               <Paperclip size={8} /> {a.name}
                                           </div>
                                           <MediaPreview attachment={a} />
                                       </div>
                                   ))}
                               </div>
                           )}
                       </div>
                    ) : msg.role === Role.SYSTEM ? (
                       <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                    ) : (
                      // Ensure text wrapping and flex shrinkage
                      <div className="flex items-start gap-1 max-w-full">
                          <div className="flex-1 min-w-0 break-words overflow-hidden">
                              <ParsedMessage content={msg.content} />
                          </div>
                          <div className="flex-shrink-0">
                             <MessageActions 
                                content={msg.content} 
                                onExportWhole={handleGlobalExport}
                             />
                          </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
               <div className="text-green-600/70 animate-pulse text-xs font-mono mt-2 ml-2">
                 _CALCULATING_RESPONSE
               </div>
            )}
            
            {!isBooted && bootSequence.length === INITIAL_BOOT_SEQUENCE.length && (
               <div className="text-center text-green-500 animate-pulse mt-10 tracking-widest text-xs">
                 [ TERMINAL READY ]
               </div>
            )}
          </div>

          {/* Input Area Wrapper */}
          <div className="flex-shrink-0 border-t-2 border-green-600 bg-black flex flex-col">
            
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex gap-2 p-2 border-b border-green-800 bg-green-950/20 overflow-x-auto">
                 {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2 bg-green-900/40 border border-green-600 rounded px-2 py-1 text-xs text-green-300 whitespace-nowrap">
                       <Paperclip size={10} />
                       <span className="max-w-[150px] truncate">{att.name}</span>
                       <button onClick={() => {
                           setAttachments(prev => prev.filter((a) => a.id !== att.id));
                       }} className="hover:text-red-400"><X size={12}/></button>
                    </div>
                 ))}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-2 px-2 py-1 bg-green-950/30 border-b border-green-900/50">
               {/* Upload File */}
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 onChange={onFileSelect} 
               />
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 disabled={!isBooted || autoReconActive}
                 className="p-3 md:p-2 text-green-600 hover:text-green-300 hover:bg-green-900/50 transition-colors flex items-center gap-1 group relative disabled:opacity-30"
                 title="UPLOAD FILE"
               >
                 <FolderUp size={20} className="md:w-4 md:h-4" />
               </button>

               {/* Gallery */}
               <input 
                 type="file" 
                 ref={galleryInputRef} 
                 className="hidden" 
                 accept="image/*,video/*"
                 onChange={onFileSelect} 
               />
               <button 
                 onClick={() => galleryInputRef.current?.click()}
                 disabled={!isBooted || autoReconActive}
                 className="p-3 md:p-2 text-green-600 hover:text-green-300 hover:bg-green-900/50 transition-colors group relative disabled:opacity-30"
                 title="GALLERY"
               >
                 <Image size={20} className="md:w-4 md:h-4" />
               </button>

               <div className="flex-1"></div>
               <div className="text-[10px] text-green-800 font-mono tracking-widest hidden md:block">
                 {isListening ? (
                     <span className="text-red-500 animate-pulse font-bold">● VOX_UPLINK: ACTIVE</span>
                 ) : autoReconActive ? (
                     <span className="text-red-500 animate-pulse font-bold">● RECURSIVE_DAEMON: ACTIVE</span>
                 ) : (
                     roleMask ? 'MASK_PROTOCOL: ACTIVE' : 'SECURE_CHANNEL'
                 )}
               </div>
            </div>

            {/* Text Input */}
            <div className="p-2 md:p-4 pt-1 md:pt-2">
              <div className="flex gap-1 md:gap-2 relative group items-center">
                <span className="text-green-500 pl-1 select-none font-bold text-base md:text-lg animate-pulse">_</span>
                
                {speechSupported && (
                    <button 
                        onClick={toggleListening}
                        disabled={!isBooted || autoReconActive}
                        className={`p-3 md:p-2 transition-colors border border-transparent hover:border-green-800 ${isListening ? 'text-red-500 animate-pulse' : 'text-green-700 hover:text-green-400'}`}
                        title={isListening ? "STOP RECORDING" : "ACTIVATE VOICE UPLINK"}
                    >
                        {isListening ? <MicOff size={24} className="md:w-5 md:h-5" /> : <Mic size={24} className="md:w-5 md:h-5" />}
                    </button>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!isBooted || autoReconActive}
                  placeholder={autoReconActive ? "DAEMON CONTROLLED. CANCEL TO TYPE..." : isListening ? "LISTENING..." : (isBooted ? "ENTER COMMAND..." : "INITIALIZING...")}
                  className={`w-full bg-transparent font-mono text-base md:text-lg p-2 outline-none placeholder-green-900/50 caret-green-500 ${isListening ? 'text-red-400 placeholder-red-900/50' : 'text-green-400'}`}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  enterKeyHint="send"
                  autoFocus
                />
                {isProcessing || isSpeaking ? (
                    <button 
                        onClick={handleStop}
                        className="px-4 py-2 bg-red-950/30 border border-red-800 text-red-500 hover:bg-red-500 hover:text-black hover:border-red-500 transition-all font-mono font-bold text-xs flex items-center gap-2 shrink-0 animate-pulse"
                    >
                        STOP <Square size={12} fill="currentColor" />
                    </button>
                ) : (
                    <button 
                        onClick={handleSend}
                        disabled={!isBooted || autoReconActive || (!input.trim() && attachments.length === 0)}
                        className="px-4 py-2 bg-green-950/30 border border-green-800 text-green-600 hover:bg-green-500 hover:text-black hover:border-green-500 transition-all font-mono font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                    >
                        EXEC <Send size={12} />
                    </button>
                )}
              </div>
            </div>
          </div>
      </div>

      {/* Overlay for sidebar */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/80 z-30 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
      )}

    </div>
  );
};

export default Terminal;