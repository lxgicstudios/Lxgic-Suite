import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const ALGORITHM = 'aes-256-gcm';
export const KEY_LENGTH = 32; // 256 bits
export const IV_LENGTH = 16; // 128 bits
export const AUTH_TAG_LENGTH = 16; // 128 bits
export const SALT_LENGTH = 32;
export const PBKDF2_ITERATIONS = 100000;

export interface EncryptedData {
  version: number;
  algorithm: string;
  iv: string;
  salt: string;
  authTag: string;
  ciphertext: string;
  metadata?: Record<string, unknown>;
}

export interface KeyInfo {
  key: Buffer;
  source: 'env' | 'file' | 'direct';
  keyId?: string;
}

/**
 * Derive a key from a password using PBKDF2
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Generate a cryptographically secure random key
 */
export function generateKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Generate a secure random IV
 */
export function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

/**
 * Generate a secure random salt
 */
export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * Resolve the encryption key from various sources
 */
export function resolveKey(keyOption?: string): KeyInfo {
  // Check environment variable first
  if (keyOption?.startsWith('$')) {
    const envVar = keyOption.substring(1);
    const envValue = process.env[envVar];
    if (!envValue) {
      throw new Error(`Environment variable ${envVar} not set`);
    }
    return {
      key: Buffer.from(envValue, 'hex'),
      source: 'env',
      keyId: envVar,
    };
  }

  // Check if it's a file path
  if (keyOption && fs.existsSync(keyOption)) {
    const keyData = fs.readFileSync(keyOption, 'utf-8').trim();
    return {
      key: Buffer.from(keyData, 'hex'),
      source: 'file',
      keyId: path.basename(keyOption),
    };
  }

  // Try default environment variable
  if (process.env.PROMPT_ENCRYPT_KEY) {
    return {
      key: Buffer.from(process.env.PROMPT_ENCRYPT_KEY, 'hex'),
      source: 'env',
      keyId: 'PROMPT_ENCRYPT_KEY',
    };
  }

  // Direct key (hex string)
  if (keyOption) {
    const keyBuffer = Buffer.from(keyOption, 'hex');
    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars)`);
    }
    return {
      key: keyBuffer,
      source: 'direct',
    };
  }

  throw new Error('No encryption key provided. Use --key option or set PROMPT_ENCRYPT_KEY environment variable');
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(plaintext: string, key: Buffer, metadata?: Record<string, unknown>): EncryptedData {
  const iv = generateIV();
  const salt = generateSalt();

  // Derive a unique key for this encryption using the salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 1, KEY_LENGTH, 'sha256');

  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

  // Add metadata as AAD (Additional Authenticated Data) if provided
  if (metadata) {
    cipher.setAAD(Buffer.from(JSON.stringify(metadata)));
  }

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    metadata,
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData, key: Buffer): string {
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const salt = Buffer.from(encryptedData.salt, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

  // Derive the same key using the salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 1, KEY_LENGTH, 'sha256');

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  // Add metadata as AAD if present
  if (encryptedData.metadata) {
    decipher.setAAD(Buffer.from(JSON.stringify(encryptedData.metadata)));
  }

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt a file
 */
export function encryptFile(
  inputPath: string,
  key: Buffer,
  outputPath?: string,
  metadata?: Record<string, unknown>
): string {
  const absoluteInput = path.resolve(inputPath);

  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`File not found: ${absoluteInput}`);
  }

  const content = fs.readFileSync(absoluteInput, 'utf-8');
  const encrypted = encrypt(content, key, {
    ...metadata,
    originalFile: path.basename(absoluteInput),
    encryptedAt: new Date().toISOString(),
  });

  const output = outputPath || `${absoluteInput}.encrypted`;
  fs.writeFileSync(output, JSON.stringify(encrypted, null, 2));

  return output;
}

/**
 * Decrypt a file
 */
export function decryptFile(
  inputPath: string,
  key: Buffer,
  outputPath?: string
): string {
  const absoluteInput = path.resolve(inputPath);

  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`File not found: ${absoluteInput}`);
  }

  const content = fs.readFileSync(absoluteInput, 'utf-8');
  const encryptedData: EncryptedData = JSON.parse(content);

  const decrypted = decrypt(encryptedData, key);

  // Determine output path
  let output: string;
  if (outputPath) {
    output = path.resolve(outputPath);
  } else if (absoluteInput.endsWith('.encrypted')) {
    output = absoluteInput.replace(/\.encrypted$/, '');
  } else {
    output = `${absoluteInput}.decrypted`;
  }

  fs.writeFileSync(output, decrypted);

  return output;
}

/**
 * Rotate encryption key for a file
 */
export function rotateKey(
  inputPath: string,
  oldKey: Buffer,
  newKey: Buffer
): void {
  const absoluteInput = path.resolve(inputPath);

  if (!fs.existsSync(absoluteInput)) {
    throw new Error(`File not found: ${absoluteInput}`);
  }

  const content = fs.readFileSync(absoluteInput, 'utf-8');
  const encryptedData: EncryptedData = JSON.parse(content);

  // Decrypt with old key
  const plaintext = decrypt(encryptedData, oldKey);

  // Re-encrypt with new key
  const newEncrypted = encrypt(plaintext, newKey, {
    ...encryptedData.metadata,
    keyRotatedAt: new Date().toISOString(),
  });

  fs.writeFileSync(absoluteInput, JSON.stringify(newEncrypted, null, 2));
}

/**
 * Verify encrypted data integrity without decrypting
 */
export function verifyIntegrity(encryptedData: EncryptedData): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (encryptedData.version !== 1) {
    issues.push(`Unknown encryption version: ${encryptedData.version}`);
  }

  if (encryptedData.algorithm !== ALGORITHM) {
    issues.push(`Unexpected algorithm: ${encryptedData.algorithm}`);
  }

  try {
    const iv = Buffer.from(encryptedData.iv, 'base64');
    if (iv.length !== IV_LENGTH) {
      issues.push(`Invalid IV length: ${iv.length}`);
    }
  } catch {
    issues.push('Invalid IV encoding');
  }

  try {
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    if (authTag.length !== AUTH_TAG_LENGTH) {
      issues.push(`Invalid auth tag length: ${authTag.length}`);
    }
  } catch {
    issues.push('Invalid auth tag encoding');
  }

  try {
    Buffer.from(encryptedData.ciphertext, 'base64');
  } catch {
    issues.push('Invalid ciphertext encoding');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Generate a new key and save to file
 */
export function generateAndSaveKey(outputPath: string): string {
  const key = generateKey();
  const hexKey = key.toString('hex');
  fs.writeFileSync(outputPath, hexKey);
  return hexKey;
}
