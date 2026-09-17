// Audio Synthesis & TTS Service

let audioCtx: AudioContext | null = null;
let backgroundOscillators: any[] = []; // Relaxed type to avoid TS conflicts with custom nodes
let backgroundGain: GainNode | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
        audioCtx = new Ctx();
    }
  }
  return audioCtx;
};

// --- Sound Synthesis ---

export const playStaticBurst = (duration = 0.1, volume = 0.01) => { 
  try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      if (ctx.state === 'suspended') ctx.resume();
      
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5; 
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
  } catch (e) {
      console.warn("Audio Context Error:", e);
  }
};

export const startHackerAmbience = () => {
  try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      if (ctx.state === 'suspended') ctx.resume();
      
      stopHackerAmbience(); // Ensure clean start

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.05; 
      masterGain.connect(ctx.destination);
      backgroundGain = masterGain;

      // 1. Cyberpunk Hum (Sine waves for smoothness)
      const freqs = [55, 110]; 
      freqs.forEach(f => {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; 
        osc.frequency.value = f;
        
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.1;
        
        // Subtle modulation
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; 
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.02;
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        backgroundOscillators.push(lfo);

        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start();
        backgroundOscillators.push(osc);
      });

      // 2. Minimal texture (filtered noise)
      const bufferSize = ctx.sampleRate * 4.0; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.02; 
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      noise.connect(masterGain);
      noise.start();
      (noise as any).stopNode = noise; 
      backgroundOscillators.push(noise as any);
  } catch (e) {
      console.warn("Ambience Start Error:", e);
  }
};

export const stopHackerAmbience = () => {
  backgroundOscillators.forEach(osc => {
    try {
      if (osc.stop) osc.stop();
      if (osc.disconnect) osc.disconnect();
    } catch (e) {}
  });
  backgroundOscillators = [];
  if (backgroundGain) {
    try {
        backgroundGain.disconnect();
    } catch(e){}
    backgroundGain = null;
  }
};

// --- Text Processing ---

const formatTextForSpeech = (text: string): string => {
  if (!text) return "";
  let processed = text;
  
  // 1. Remove Code Blocks 
  processed = processed.replace(/```[\s\S]*?```/g, " [Data Block] ");

  // 2. Remove HTML/XML-like tags 
  processed = processed.replace(/<[^>]+>/g, "");

  // 3. Remove URLs
  processed = processed.replace(/https?:\/\/[^\s]+/g, " link ");

  // 4. Handle Brackets & All-Caps inside them
  // Detect [ALL_CAPS_TEXT] and convert to "all caps text" to prevent spelling it out
  // Expanded to include colons, hyphens, and dots which might appear in system tags
  processed = processed.replace(/\[([A-Z0-9_ :\-\.]+)\]/g, (_, p1) => {
      return " " + p1.toLowerCase().replace(/[_\-]/g, " ") + " ";
  });
  
  // Remove remaining brackets but keep content
  processed = processed.replace(/[\[\]\(\)\{\}]/g, " ");

  // 5. Remove Emojis & Misc Symbols
  processed = processed.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');

  // 6. Remove Markdown & Special Symbols (keep basic punctuation)
  // We keep , . ! ? ; : - to maintain cadence
  processed = processed.replace(/[*#_~`>\\\/<>=+\^%\$@&]/g, "");

  // 7. Clean up multiple spaces
  processed = processed.replace(/\s+/g, " ").trim();

  return processed;
};

// --- TTS Engine ---

let synthesisParams = {
  pitch: 0.9, 
  rate: 1.0,  
  volume: 1.0 
};

// GLOBAL REFERENCE TO PREVENT GARBAGE COLLECTION
// This is critical for Chrome/Blink browsers
let activeUtterance: SpeechSynthesisUtterance | null = null;
let watchdogTimer: any = null;

const splitTextIntoChunks = (text: string, maxLength: number = 160): string[] => {
  // Split by sentence endings first
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  
  for (const sentence of sentences) {
    if (sentence.length <= maxLength) {
      chunks.push(sentence.trim());
    } else {
      // Split long sentence by commas
      const subParts = sentence.match(/[^,]+,|[^,]+$/g) || [sentence];
      for (const part of subParts) {
         if (part.length <= maxLength) {
            chunks.push(part.trim());
         } else {
            // Hard split by words if still too long
            const words = part.split(' ');
            let current = "";
            for (const word of words) {
               if ((current + word).length > maxLength) {
                  chunks.push(current.trim());
                  current = word + " ";
               } else {
                  current += word + " ";
               }
            }
            if (current.trim()) chunks.push(current.trim());
         }
      }
    }
  }
  return chunks.filter(c => c.length > 0);
};

export const readAloud = (text: string, glitchMode: boolean = false, onStart?: () => void, onEnd?: () => void) => {
  // Cancel any ongoing speech immediately
  stopReading();

  if (glitchMode) {
    startHackerAmbience();
  }

  if (onStart) onStart();

  const cleanText = formatTextForSpeech(text);
  const chunks = splitTextIntoChunks(cleanText);
  
  let currentChunkIndex = 0;

  const speakNextChunk = () => {
    if (currentChunkIndex >= chunks.length) {
      if (glitchMode) stopHackerAmbience();
      activeUtterance = null; // Release
      if (onEnd) onEnd();
      return;
    }

    const chunkText = chunks[currentChunkIndex].trim();
    if (!chunkText) {
      currentChunkIndex++;
      speakNextChunk();
      return;
    }

    // Create and assign to global variable
    activeUtterance = new SpeechSynthesisUtterance(chunkText);
    
    // Voice Selection - Re-query voices every time as they load asynchronously
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Google US English")) || 
                           voices.find(v => v.name.includes("Microsoft David")) ||
                           voices.find(v => v.lang.startsWith("en-")) ||
                           voices[0];
                           
    if (preferredVoice) activeUtterance.voice = preferredVoice;

    activeUtterance.pitch = synthesisParams.pitch;
    activeUtterance.rate = synthesisParams.rate;
    activeUtterance.volume = synthesisParams.volume;

    // Event handlers to chain the chunks
    activeUtterance.onend = () => {
      clearTimeout(watchdogTimer);
      currentChunkIndex++;
      speakNextChunk();
    };

    activeUtterance.onerror = (e) => {
      console.error("TTS Chunk Error:", e);
      clearTimeout(watchdogTimer);
      // Try to skip to next chunk on error
      currentChunkIndex++;
      speakNextChunk();
    };

    // Watchdog: If onend doesn't fire within expected time + buffer, force next
    // Estimate time: 10 chars per second roughly? conservative 5 chars/sec
    const estimatedDuration = (chunkText.length / 5) * 1000 + 2000; 
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
        console.warn("TTS Watchdog Triggered - Forcing next chunk");
        window.speechSynthesis.cancel(); // This will trigger onend or onerror usually, but we force next just in case
        currentChunkIndex++;
        speakNextChunk();
    }, Math.max(5000, estimatedDuration));

    window.speechSynthesis.speak(activeUtterance);
  };

  // Start the chain
  speakNextChunk();
};

export const stopReading = () => {
  if (watchdogTimer) clearTimeout(watchdogTimer);
  window.speechSynthesis.cancel();
  activeUtterance = null;
  stopHackerAmbience();
};