import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.JWT_SECRET || 'bharatai-encryption-key-32bytes!!';
const IV_LENGTH = 16;

export function encrypt(text) {
  if (!text) return null;
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text) {
  if (!text) return null;
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = textParts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

