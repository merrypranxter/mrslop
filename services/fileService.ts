import { Attachment } from '../types';
import { generateId } from './cryptoService';

const MAX_HEX_BYTES = 8192; // Limit hex dump size to avoid token overflow

/**
 * Processes a file for ingestion.
 * Note: Size limits (300MB) are enforced in Terminal.tsx to prevent 
 * browser crashes on mobile hardware.
 */
export const processFile = async (file: File): Promise<Attachment> => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  const id = generateId();

  console.log(`[FILE_SERVICE] PROCESSING ${fileName} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

  // 1. Images, Audio, Video, PDF -> Keep FileHandle (don't load into memory yet)
  if (
    fileType.startsWith('image/') ||
    fileType.startsWith('audio/') ||
    fileType.startsWith('video/') ||
    fileType === 'application/pdf'
  ) {
    return {
      id,
      name: file.name,
      mimeType: fileType,
      data: "", // Don't load massive strings into state
      isInlineData: true,
      fileHandle: file
    };
  }

  // 2. Text / Code -> Plain Text
  if (
    fileType.startsWith('text/') ||
    fileName.endsWith('.json') ||
    fileName.endsWith('.js') ||
    fileName.endsWith('.ts') ||
    fileName.endsWith('.py') ||
    fileName.endsWith('.c') ||
    fileName.endsWith('.cpp') ||
    fileName.endsWith('.html') ||
    fileName.endsWith('.css') ||
    fileName.endsWith('.md')
  ) {
    const text = await readFileAsText(file);
    return {
      id,
      name: file.name,
      mimeType: 'text/plain',
      data: `[FILE_CONTENT: ${file.name}]\n${text}\n[END_FILE_CONTENT]`,
      isInlineData: false
    };
  }

  // 3. Everything else (Binaries, Executables, Raw Data) -> Hex Dump
  // Treat as text for analysis prompt
  const hex = await readFileAsHex(file);
  return {
    id,
    name: file.name,
    mimeType: 'text/plain',
    data: `[BINARY_INGESTION: ${file.name}]\n[HEX_STREAM_START]\n${hex}\n[HEX_STREAM_END]\n(Truncated to first ${MAX_HEX_BYTES} bytes for analysis)`,
    isInlineData: false
  };
};

export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result) {
        reject(new Error("File Read Error: Result is empty"));
        return;
      }
      // Remove Data URL prefix (e.g. "data:image/png;base64,")
      const parts = result.split(',');
      if (parts.length > 1) {
          resolve(parts[1]);
      } else {
          // Fallback if no prefix found (unlikely for readAsDataURL)
          resolve(result);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const readFileAsHex = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      if (!buffer) {
          resolve("");
          return;
      }
      const bytes = new Uint8Array(buffer.slice(0, MAX_HEX_BYTES));
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0') + ' ';
      }
      resolve(hex.trim());
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};