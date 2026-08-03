import { argon2id, hash, verify, type HashOptions } from 'argon2';

const HASH_OPTIONS: HashOptions = {
  type: argon2id as 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
