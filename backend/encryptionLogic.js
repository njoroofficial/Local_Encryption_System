import crypto from 'crypto';

// Get the encryption algorithm from environment variables or use default
const ALGORITHM = process.env.ENCRYPTION_ALGORITHM || 'aes-256-cbc';

export function encryptFile(buffer, key) {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create key buffer of correct length (32 bytes for AES-256)
    const keyBuffer = crypto.createHash('sha256').update(String(key)).digest();
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    
    // Encrypt the file
    const encryptedData = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encryptedData.toString('hex') // Convert to hex string for storage
    };
  } catch (err) {
    console.error('Encryption error:', err);
    throw new Error('Failed to encrypt file');
  }
}

export function decryptFile(encryptedData, key, ivHex) {
  try {
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedBuffer = Buffer.from(encryptedData, 'hex');
    
    // Create key buffer of correct length
    const keyBuffer = crypto.createHash('sha256').update(String(key)).digest();
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    
    // Decrypt the file
    const decryptedData = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]);
    
    return decryptedData;
  } catch (err) {
    console.error('Decryption error:', err);
    throw new Error('Failed to decrypt file');
  }
}