// AES-256-GCM encryption using Web Crypto API
// Key is derived from the user's master password via PBKDF2

export async function deriveKey(password: string, saltInput: Uint8Array): Promise<CryptoKey> {
  const salt = saltInput.buffer instanceof ArrayBuffer ? saltInput : new Uint8Array(saltInput)
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 200000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptText(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

export async function decryptText(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const dec = new TextDecoder()
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    ciphertextBytes
  )
  return dec.decode(decrypted)
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

export function saltToBase64(salt: Uint8Array): string {
  return btoa(String.fromCharCode(...salt))
}

export function base64ToSalt(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

export async function hashPassword(password: string, saltInput: Uint8Array): Promise<string> {
  const salt = saltInput.buffer instanceof ArrayBuffer ? saltInput : new Uint8Array(saltInput)
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 200000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}
