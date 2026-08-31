import type {
  AccountStatus,
  Role,
} from '../../../../generated/prisma/client.js';
import type { SupportedLocale } from '../../../shared/locale.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  locale?: SupportedLocale;
  role: Role;
  /**
   * Réutilisation des corrections détachées pour la recherche (V4.5-168).
   *
   * Servi avec la session parce que l'écran doit montrer l'état AVANT que
   * l'apprenant y touche : une case dont on ignore la valeur se dessine
   * décochée, ce qui donnerait à lire un refus qui n'a jamais été exprimé.
   */
  correctionReuseConsent?: boolean;
}

export interface StoredAccountUser extends AuthenticatedUser {
  accountStatus: AccountStatus;
  locale: SupportedLocale;
  correctionReuseConsent: boolean;
}

export interface StoredUser extends StoredAccountUser {
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
  }): Promise<StoredSession | null>;
  createUser(input: {
    email: string;
    passwordHash: string;
    displayName: string;
    locale: SupportedLocale;
  }): Promise<StoredUser>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  findSessionWithUserByTokenHash(tokenHash: string): Promise<{
    session: StoredSession;
    user: StoredAccountUser;
  } | null>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  touchSession(id: string, lastUsedAt: Date): Promise<boolean>;
  updateUserLocale(
    userId: string,
    locale: SupportedLocale,
  ): Promise<StoredAccountUser | null>;
  updateUserCorrectionReuseConsent(
    userId: string,
    consent: boolean,
  ): Promise<StoredAccountUser | null>;
}
