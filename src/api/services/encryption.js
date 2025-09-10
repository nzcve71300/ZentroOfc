const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = process.env.ENCRYPTION_KEY || this.generateKey();
    this.aad = Buffer.from('zentro-rcon', 'utf8');
  }

  generateKey() {
    const key = crypto.randomBytes(32);
    console.warn('⚠️ Using generated encryption key. Set ENCRYPTION_KEY in environment variables for production!');
    return key.toString('hex');
  }

  /**
   * Encrypt sensitive data (like RCON passwords)
   * @param {string} text - The text to encrypt
   * @returns {string} - Encrypted text with IV and auth tag
   */
  encrypt(text) {
    try {
      if (!text) {
        throw new Error('Text to encrypt cannot be empty');
      }

      const iv = crypto.randomBytes(16);
      const keyBuffer = Buffer.from(this.key, 'hex');
      
      const cipher = crypto.createCipher(this.algorithm, keyBuffer);
      cipher.setAAD(this.aad);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Return format: iv:authTag:encrypted
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedText - The encrypted text to decrypt
   * @returns {string} - Decrypted text
   */
  decrypt(encryptedText) {
    try {
      if (!encryptedText) {
        throw new Error('Encrypted text cannot be empty');
      }

      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      const keyBuffer = Buffer.from(this.key, 'hex');

      const decipher = crypto.createDecipher(this.algorithm, keyBuffer);
      decipher.setAAD(this.aad);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure random string for secret references
   * @param {number} length - Length of the random string
   * @returns {string} - Random string
   */
  generateSecretRef(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a password for storage
   * @param {string} password - Password to hash
   * @returns {string} - Hashed password
   */
  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return salt + ':' + hash;
  }

  /**
   * Verify a password against its hash
   * @param {string} password - Password to verify
   * @param {string} hash - Stored hash
   * @returns {boolean} - Whether password matches
   */
  verifyPassword(password, hash) {
    const [salt, hashPart] = hash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hashPart === verifyHash;
  }

  /**
   * Generate a JWT token
   * @param {object} payload - Token payload
   * @param {string} expiresIn - Token expiration time
   * @returns {string} - JWT token
   */
  generateJWT(payload, expiresIn = '24h') {
    return require('jsonwebtoken').sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn });
  }

  /**
   * Verify a JWT token
   * @param {string} token - JWT token to verify
   * @returns {object} - Decoded token payload
   */
  verifyJWT(token) {
    return require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');
  }
}

module.exports = EncryptionService;
