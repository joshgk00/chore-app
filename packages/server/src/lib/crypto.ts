import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SALT_LEN = 16;

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const hash = (await scryptAsync(pin, salt, SCRYPT_KEYLEN)).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const candidate = (await scryptAsync(pin, salt, SCRYPT_KEYLEN)).toString("hex");
  const hashBuf = Buffer.from(hash, "hex");
  const candidateBuf = Buffer.from(candidate, "hex");

  if (hashBuf.length !== candidateBuf.length) return false;

  return crypto.timingSafeEqual(hashBuf, candidateBuf);
}
