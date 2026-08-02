import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('uses argon2id hashes that verify without retaining the plain password', async () => {
    const password = 'correct-horse-battery-staple';
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toContain('$argon2id$');
    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
    await expect(
      verifyPassword(passwordHash, 'another-password'),
    ).resolves.toBe(false);
  });
});
