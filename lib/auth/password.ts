import { hash as argon2Hash, verify as argon2Verify, argon2id } from "argon2";

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2Hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2Verify(hash, plain);
  } catch {
    return false;
  }
}

export function isValidPasswordStrength(plain: string): boolean {
  return plain.length >= 8;
}