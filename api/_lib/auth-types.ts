import type { Role } from '../../generated/prisma/client.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface StoredUser extends AuthenticatedUser {
  passwordHash: string;
}

export interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface AuthRepository {
  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<StoredSession>;
  createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<StoredUser>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  findSessionWithUserByTokenHash(tokenHash: string): Promise<{
    session: StoredSession;
    user: AuthenticatedUser;
  } | null>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  touchSession(id: string, lastUsedAt: Date): Promise<void>;
}
