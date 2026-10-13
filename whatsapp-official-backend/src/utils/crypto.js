const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const HEX_KEY = /^[a-f0-9]{64}$/i;

function missingKeyError() {
  const error = new Error(
    'ENCRYPTION_KEY must be a 64-character hexadecimal AES-256 key'
  );
  error.status = 500;
  return error;
}

/**
 * A local developer can move the backend folder without accidentally losing
 * the ability to save encrypted settings. In development only, create a
 * private key in this backend's ignored .env file when it is genuinely
 * missing. Production always requires an explicitly managed environment
 * variable so a deployment can never silently rotate its encryption key.
 */
function createLocalDevelopmentKey() {
  if (process.env.NODE_ENV === 'production') throw missingKeyError();
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  try {
    const saved = fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*ENCRYPTION_KEY\s*=\s*([^\s#]+)\s*$/)?.[1])
      .filter(Boolean)
      .at(-1);
    if (saved && HEX_KEY.test(saved)) {
      process.env.ENCRYPTION_KEY = saved;
      return saved;
    }
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.appendFileSync(envPath, `\nENCRYPTION_KEY=${generated}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    try {
      fs.chmodSync(envPath, 0o600);
    } catch {
      // Windows does not support POSIX file modes; the ignored .env remains
      // the private local configuration source there.
    }
  } catch (cause) {
    const error = missingKeyError();
    error.message = `${error.message}. Unable to create it in ${envPath}: ${cause.message}`;
    throw error;
  }
  process.env.ENCRYPTION_KEY = generated;
  console.warn(
    '[security] Generated a local ENCRYPTION_KEY in backend/.env. Keep this value; it encrypts saved WhatsApp and AI credentials.'
  );
  return generated;
}

function key() {
  let value = process.env.ENCRYPTION_KEY || '';
  if (!value) value = createLocalDevelopmentKey();
  if (!HEX_KEY.test(value)) throw missingKeyError();
  return Buffer.from(value, 'hex');
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('hex')}:${ciphertext.toString('hex')}:${cipher.getAuthTag().toString('hex')}`;
}

function decrypt(value) {
  const parts = String(value || '').split(':');
  if (parts.length === 3) {
    const [ivHex, ciphertextHex, tagHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key(),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
  if (parts.length === 2) {
    const [ivHex, ciphertextHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      key(),
      Buffer.from(ivHex, 'hex')
    );
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
  const error = new Error('Encrypted value has an unrecognised format');
  error.status = 400;
  throw error;
}

function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { encrypt, decrypt, hashSecret };
