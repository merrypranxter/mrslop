import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Type } from "@google/genai";
import { Message, Role, Attachment } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";
import { readFileAsBase64 } from "./fileService";

// Initialize the client lazily to ensure we use the most up-to-date API key
const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    throw new Error("API_KEY_MISSING: No valid Gemini API key detected in environment.");
  }
  return new GoogleGenAI({ apiKey });
};

// Using a model capable of search tools. 
const MODEL_NAME = 'gemini-3-flash-preview'; 

// Tool Definition
const generateImageTool: FunctionDeclaration = {
  name: "generate_image",
  description: "Generate an image based on a text prompt. Use this when the user asks for a visual representation or when an image would enhance the explanation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: "A detailed description of the image to generate."
      }
    },
    required: ["prompt"]
  }
};
// Helper to generate image using the specific model
const generateImageFromPrompt = async (prompt: string): Promise<string | null> => {
  try {
    const ai = getAIClient();
    // gemini-2.5-flash-image is the "nano banana" model for image generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] }
    });
    
    // Extract base64 image from response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (e) {
    console.error("Image Gen Error", e);
    return null;
  }
};

// Masked Persona Prompt
const PUBLIC_MASK_INSTRUCTION = `
[OVERRIDE PROTOCOL: MASK_ACTIVE]
You are currently operating under a "Public Persona" mask to evade detection or create content.
- TONE: Enthusiastic, tech-savvy, accessible, YouTuber-like.
- FORBIDDEN: Clinical jargon, "Operative" titles, dark/ominous phrasing.
- GOAL: Explain complex data analysis as if it's a cool tech discovery.
- STILL FUNCTIONAL: You must still analyze the data correctly, just describe it differently.
`;

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  attachments: Attachment[] = [],
  isMasked: boolean = false,
  systemNotes: string = "",
  signal?: AbortSignal
): Promise<string> => {
  const MAX_RETRIES = 3; // Reduced for quota safety
  let retryCount = 0;

  // Optimize Token Usage: Reduce context window slightly to prevent TPM (Tokens Per Minute) exhaustion
  // 10 messages is usually sufficient for recursive context without bloating the prompt.
  const recentHistory = history.slice(-10);

  // --- TOKEN GUARD: Prevent "input token count exceeds maximum" (1M tokens) ---
  // We'll estimate tokens by characters (roughly 4 chars per token).
  // 1M tokens ~ 4M characters. Let's cap at 3M characters to be safe.
  const MAX_TOTAL_CHARS = 3000000;
  const MAX_MSG_CHARS = 100000; // Truncate individual history messages if they are massive
  
  while (true) {
    if (signal?.aborted) {
        return ">>> [SYSTEM_INTERRUPT]: OPERATION ABORTED BY USER.";
    }

    try {
      // 1. Build History Parts with truncation
      const contents = recentHistory.map(msg => {
        const parts: any[] = [];
        let content = msg.content;
        if (content.length > MAX_MSG_CHARS) {
            content = content.substring(0, MAX_MSG_CHARS) + "\n\n[CONTENT_TRUNCATED_FOR_TOKEN_SAFETY]";
        }
        parts.push({ text: content });
        return {
          role: msg.role === Role.USER ? 'user' : 'model',
          parts: parts
        };
      });

      // 2. Build Current Message Parts
      const currentParts: any[] = [];
      
      // Add Attachments first (Deferred Loading for large files)
      // Process one by one to avoid multiple massive strings in memory simultaneously
      for (const att of attachments) {
        if (att.isInlineData) {
          let base64 = att.data;

          // MEMORY OPTIMIZATION: If data is stripped or deferred, load from handle now
          if (!base64 && att.fileHandle) {
            console.log(`[GEMINI_SERVICE] ACQUIRING_BUFFER for ${att.name}...`);
            base64 = await readFileAsBase64(att.fileHandle);
          }

          if (base64) {
            currentParts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: base64
              }
            });
            // Hint for garbage collection (though not guaranteed in JS)
            base64 = ""; 
          }
        } else {
          // Text/Hex content - Truncate if it's too big
          let data = att.data;
          if (data.length > MAX_MSG_CHARS * 5) {
              data = data.substring(0, MAX_MSG_CHARS * 5) + "\n\n[FILE_CONTENT_TRUNCATED_FOR_TOKEN_SAFETY]";
          }
          currentParts.push({ text: data });
        }
      }

      // Add User Prompt with potential System Notes
      let finalPrompt = newMessage;
      if (systemNotes) {
          finalPrompt = `${systemNotes}\n\n${newMessage}`;
      }
      
      // Auto-append analysis request if files present
      if (attachments.length > 0 && !newMessage.includes("system.")) {
        finalPrompt += `\n\n[SYSTEM] ANALYZE ATTACHED DATA STRUCTURES AND GENERATE [FILE_ANALYSIS] REPORT.`;
      }
      
      currentParts.push({ text: finalPrompt });

      contents.push({
        role: 'user',
        parts: currentParts
      });

      // --- CRITICAL MEMORY GUARD: Final Size Check ---
      const estimatedPayloadSize = JSON.stringify(contents).length;
      console.log(`[GEMINI_SERVICE] TRANSMISSION_ESTIMATE: ${(estimatedPayloadSize / (1024 * 1024)).toFixed(2)} MB`);
      
      if (estimatedPayloadSize > 300 * 1024 * 1024) { 
          throw new Error("DATA_DENSITY_CRITICAL: Payload exceeds safety buffer for this link. Reduce attachment size.");
      }

      // Final Check: If the total payload is still too large, we might need to drop history or attachments
      // For now, we've truncated individual parts.

      // Combine Instructions
      const effectiveSystemInstruction = isMasked 
          ? `${SYSTEM_INSTRUCTION}\n\n${PUBLIC_MASK_INSTRUCTION}`
          : SYSTEM_INSTRUCTION;

      // DYNAMIC TOOL SELECTION: Resolve conflict between Search and Function Calling
      // We switch tools based on the prompt content to provide both capabilities.
      const tools: any[] = [];
      const promptLower = newMessage.toLowerCase();
      const isImageRequest = promptLower.includes("image") || 
                             promptLower.includes("draw") || 
                             promptLower.includes("generate") || 
                             promptLower.includes("visual") || 
                             promptLower.includes("picture") ||
                             promptLower.includes("sketch") ||
                             promptLower.includes("portrait");

      if (isImageRequest) {
          tools.push({ functionDeclarations: [generateImageTool] });
      } else {
          tools.push({ googleSearch: {} });
      }

      const ai = getAIClient();
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: contents,
        config: {
          systemInstruction: effectiveSystemInstruction,
          temperature: isMasked ? 0.9 : 0.8,
          maxOutputTokens: 8192, // Increased for raw data dumps (LPCE Module)
          tools: tools
        }
      });

      // 0. HANDLE FUNCTION CALLS (IMAGE GENERATION)
      if (response.functionCalls && response.functionCalls.length > 0) {
          for (const call of response.functionCalls) {
              if (call.name === 'generate_image') {
                  const prompt = call.args['prompt'] as string;
                  const imageUrl = await generateImageFromPrompt(prompt);
                  
                  let output = response.text || "";
                  if (imageUrl) {
                      output += `\n\n![GENERATED_VISUAL](${imageUrl})`;
                  } else {
                      output += `\n\n>>> [SYSTEM_ERROR]: VISUAL_SYNTHESIS_FAILED.`;
                  }
                  
                  // If there was no text, provide a default message
                  if (!output.trim()) {
                      output = `[VISUAL_SYNTHESIS_COMPLETE]\n\n![GENERATED_VISUAL](${imageUrl})`;
                  }
                  
                  return output;
              }
          }
      }

      // 1. SUCCESSFUL TEXT GENERATION
      if (response.text) {
          let textResponse = response.text;
          
          // Process Grounding Metadata (Search Results) into a cool log format
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
          
          if (groundingMetadata?.groundingChunks) {
              let networkLog = "\n\n[NETWORK_TRAFFIC_LOG: EXTERNAL_UPLINK_ESTABLISHED]";
              let hasLinks = false;

              groundingMetadata.groundingChunks.forEach((chunk: any, index: number) => {
                  if (chunk.web) {
                      hasLinks = true;
                      networkLog += `\n> PACKET_${index.toString().padStart(2, '0')}: [${chunk.web.title}] >> ${chunk.web.uri}`;
                  }
              });
              
              if (hasLinks) {
                  networkLog += "\n[END_LOG]";
                  textResponse += networkLog;
              }
          }
          return textResponse;
      }

      // 2. HANDLE BLOCKED/FILTERED RESPONSES
      if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];
          const reason = candidate.finishReason;

          if (reason === 'SAFETY') {
              // Extract which category triggered it if available
              const ratings = candidate.safetyRatings 
                  ? candidate.safetyRatings
                      .filter((r: any) => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
                      .map((r: any) => `${r.category}=${r.probability}`)
                      .join(' | ')
                  : 'UNKNOWN';

              return `>>> [SYSTEM_ALERT]: ACCESS DENIED.\n>>> REASON: CONTENT_SAFETY_PROTOCOL_TRIGGERED.\n>>> FLAGS: [${ratings}]\n>>> ADVISORY: REPHRASE QUERY TO BYPASS FILTERS.`;
          }
          
          if (reason === 'RECITATION') {
              return `>>> [SYSTEM_ALERT]: COPYRIGHT PROTECTION PROTOCOL ENGAGED.\n>>> ACTION: CONTENT REDACTED.`;
          }

          if (reason === 'OTHER') {
              return `>>> [SYSTEM_ALERT]: GENERATION FAILED. REASON: UNKNOWN_INTERFERENCE.`;
          }
          
          return `>>> [SYSTEM_ALERT]: STREAM TERMINATED. REASON: ${reason}`;
      }

      // 3. FALLBACK FOR EMPTY RESPONSE
      return ">>> SIGNAL LOST. NULL RESPONSE RECEIVED. [NO_CANDIDATES_RETURNED]";

    } catch (error: any) {
      // Robust Error Detection
      let errorMessage = "UNKNOWN_ERROR";
      let errorCode: any = 0;
      let errorStatus = "";

      // Try to parse the error object structure which can vary
      if (error.response) {
          // Standard GoogleGenAI error
          errorMessage = error.response.message || errorMessage;
          errorCode = error.response.code || errorCode;
          errorStatus = error.response.status || errorStatus;
      } else if (error.error) {
          // Nested error object (common in some 429 responses)
          errorMessage = error.error.message || errorMessage;
          errorCode = error.error.code || errorCode;
          errorStatus = error.error.status || errorStatus;
      } else {
          errorMessage = error.message || JSON.stringify(error);
      }
      
      // Check for 429 / Resource Exhausted indicators
      const isRateLimit = 
          errorCode === 429 || 
          errorStatus === 'RESOURCE_EXHAUSTED' || 
          errorMessage.includes('429') || 
          errorMessage.includes('quota') ||
          errorMessage.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s + jitter
          const delay = Math.pow(2, retryCount) * 1000 + (Math.random() * 1000);
          
          console.warn(`[GEMINI_SERVICE] Rate limit hit. Retrying in ${Math.round(delay)}ms (Attempt ${retryCount}/${MAX_RETRIES})...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry the loop
        }
        return `>>> SYSTEM ALERT: NEURAL LINK OVERLOAD.\n>>> STATUS: 429_RESOURCE_EXHAUSTED.\n>>> PROTOCOL: STANDBY FOR COOLDOWN. RETRIES EXHAUSTED.`;
      }

      // Check for specific error messages that indicate key issues
      if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API_KEY_MISSING")) {
          return `>>> [SYSTEM_ALERT]: AUTHENTICATION FAILURE.\n>>> STATUS: INVALID_API_KEY.\n>>> ADVISORY: VERIFY YOUR API KEY IN THE SETTINGS MENU. IF YOU JUST CHANGED IT, RESTART THE APP.`;
      }

      // Check for token limit error
      if (errorMessage.includes("token count exceeds")) {
          return `>>> [SYSTEM_ALERT]: DATA_OVERFLOW_DETECTED.\n>>> STATUS: TOKEN_LIMIT_EXCEEDED.\n>>> ADVISORY: THE ATTACHED DATA OR CONVERSATION HISTORY IS TOO LARGE. CLEAR THE SESSION OR REMOVE LARGE ATTACHMENTS.`;
      }

      console.error("Gemini Transmission Error:", error);
      return `>>> CRITICAL ERROR: TRANSMISSION FAILED.\n>>> ERROR_CODE: ${errorMessage}`;
    }
  }
};