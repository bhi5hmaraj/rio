/**
 * Encryption utilities for sensitive data (API keys)
 * Uses Web Crypto API available in Chrome extensions
 */

/**
 * Derive an encryption key from a password
 * Uses PBKDF2 with a random salt
 */
async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string value
 * @param value - Plain text to encrypt
 * @param password - Password for encryption (derived from extension ID)
 * @returns Base64 encoded encrypted value with salt and IV
 */
export async function encrypt(value: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine salt + IV + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an encrypted string value
 * @param encryptedValue - Base64 encoded encrypted value
 * @param password - Password for decryption
 * @returns Decrypted plain text
 */
export async function decrypt(encryptedValue: string, password: string): Promise<string> {
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedValue), c => c.charCodeAt(0));

  // Extract salt, IV, and encrypted data
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  // Convert back to string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Get encryption password based on extension ID
 * This ensures each extension installation has a unique encryption key
 */
export function getEncryptionPassword(): string {
  // In Chrome extensions, chrome.runtime.id is unique per installation
  // For testing, we'll use a fallback
  return chrome.runtime?.id || 'rio-extension-default-key';
}
