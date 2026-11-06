/**
 * Cifrado de tokens sensibles (WhatsApp Cloud API, Gemini) con Web Crypto
 * (AES-GCM), no con el módulo 'crypto' de Node — ver blueprint-saas-inmobiliario.md §6/§11.
 *
 * `secretHex` es un string hex de 64 caracteres (32 bytes), ej. generado con
 * `openssl rand -hex 32` y cargado como el secret ENCRYPTION_KEY del Worker.
 */

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secretHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(secretHex) as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plainText: string, secretHex: string): Promise<string> {
  const key = await importKey(secretHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plainText) as BufferSource
  );
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);
  return bytesToBase64(combined);
}

export async function decrypt(cipherTextB64: string, secretHex: string): Promise<string> {
  const key = await importKey(secretHex);
  const combined = base64ToBytes(cipherTextB64);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    data as BufferSource
  );
  return new TextDecoder().decode(plainBuffer);
}
