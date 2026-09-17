// Speech Recognition Service

let recognition: any = null;

export const isSpeechSupported = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

export const startListening = (
  onResult: (text: string, isFinal: boolean) => void,
  onEnd: () => void
) => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  // Stop previous instance if exists
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      console.warn("Error stopping previous recognition", e);
    }
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true; // Keep listening until stopped manually
  recognition.interimResults = true; // Show results as user speaks
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    // Send back the relevant text chunk
    // Note: We send 'final' if available, otherwise interim. 
    // The consumer should handle how to append this.
    onResult(finalTranscript || interimTranscript, !!finalTranscript);
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.onerror = (event: any) => {
    console.warn("Speech recognition error", event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        onEnd(); // Fatal
    }
    // Ignore 'no-speech' errors which happen if user is silent for a bit
  };

  try {
      recognition.start();
  } catch(e) {
      console.error("Failed to start recognition", e);
      onEnd();
  }

  return recognition;
};

export const stopListening = () => {
  if (recognition) {
    try {
        recognition.stop();
    } catch(e) {}
  }
};