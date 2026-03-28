/**
 * EDH STORE KEYS — Client-side AES-256-GCM encryption
 *
 * Passwords are encrypted in the browser using a key derived from the user's
 * master password (login password) via PBKDF2-SHA-256. The server only ever
 * stores ciphertext + IV — it never sees plaintext passwords.
 *
 * Workflow:
 *   encrypt(plaintext, masterPassword) → { ciphertext: string, iv: string }
 *   decrypt(ciphertext, iv, masterPassword) → plaintext
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const SALT = "EDH-STORE-KEYS-SALT-v1"; // static salt for key derivation (per-app)

async function deriveKey(masterPassword: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptPassword(
  plaintext: string,
  masterPassword: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(masterPassword);
  const enc = new TextEncoder();
  const ivRaw = crypto.getRandomValues(new Uint8Array(12));
  const ivBuffer = ivRaw.buffer.slice(ivRaw.byteOffset, ivRaw.byteOffset + ivRaw.byteLength) as ArrayBuffer;

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(ivBuffer as ArrayBuffer),
  };
}

export async function decryptPassword(
  ciphertext: string,
  iv: string,
  masterPassword: string
): Promise<string> {
  const key = await deriveKey(masterPassword);
  const dec = new TextDecoder();

  const ivBytes = base64ToBuffer(iv);
  const ivArrayBuffer = ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength) as ArrayBuffer;
  const cipherBytes = base64ToBuffer(ciphertext);
  const cipherArrayBuffer = cipherBytes.buffer.slice(cipherBytes.byteOffset, cipherBytes.byteOffset + cipherBytes.byteLength) as ArrayBuffer;

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(ivArrayBuffer) },
    key,
    cipherArrayBuffer
  );

  return dec.decode(decryptedBuffer);
}
