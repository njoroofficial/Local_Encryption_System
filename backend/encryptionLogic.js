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
    // Validate the IV format
    if (!ivHex || typeof ivHex !== 'string') {
      console.error('Invalid IV format received:', {
        iv: ivHex,
        type: typeof ivHex,
        length: ivHex?.length
      });
      throw new Error('Invalid IV format');
    }
    
    // Ensure IV is exactly 32 characters (16 bytes) hex string
    if (ivHex.length !== 32) {
      console.error('IV has incorrect length:', ivHex.length);
      throw new Error('IV has incorrect length, expected 32 hex characters');
    }
    
    // Convert hex strings back to buffers
    try {
      const iv = Buffer.from(ivHex, 'hex');
      
      // Ensure IV is exactly 16 bytes
      if (iv.length !== 16) {
        console.error('IV buffer has incorrect length:', iv.length);
        throw new Error('IV buffer has incorrect length');
      }
      
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
    } catch (conversionError) {
      console.error('Error converting IV or encrypted data:', conversionError);
      throw new Error('Failed to convert IV or encrypted data: ' + conversionError.message);
    }
  } catch (err) {
    console.error('Decryption error:', err);
    
    // Check for specific bad decrypt error
    if (err.code === 'ERR_OSSL_BAD_DECRYPT' || 
        (err.message && err.message.includes('bad decrypt'))) {
      throw new Error('Invalid decryption key - the key provided cannot decrypt this file');
    }
    
    // For other errors
    throw new Error('Failed to decrypt file: ' + (err.message || 'Unknown error'));
  }
}