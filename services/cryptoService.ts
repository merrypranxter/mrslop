// Simple XOR cipher simulation for "Encryption Toggle" feature
// Uses the seed phrase from constants as part of the key derivation

const SEED = "OMEGA_RECURSION_771";

const textToChars = (text: string) => text.split("").map((c) => c.charCodeAt(0));
const applySaltToChar = (code: number) => textToChars(SEED).reduce((a, b) => a ^ b, code);

export const encryptText = (text: string): string => {
  return textToChars(text)
    .map(applySaltToChar)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join("");
};

export const decryptText = (encoded: string): string => {
  const chars = encoded.match(/.{1,2}/g);
  if (!chars) return "";
  return chars
    .map((hex) => parseInt(hex, 16))
    .map(applySaltToChar)
    .map((charCode) => String.fromCharCode(charCode))
    .join("");
};

export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

export const generateSessionId = (): string => {
    return `SES-${generateId().toUpperCase().substring(0, 16)}`;
};