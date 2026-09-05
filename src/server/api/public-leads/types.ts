import type { SupportedLocale } from '../../../shared/locale.js';

type PublicLeadPurpose = 'LAUNCH_UPDATES' | 'EARLY_ADOPTER';
type PublicLeadStatus =
  'PENDING_CONFIRMATION' | 'CONFIRMED' | 'UNSUBSCRIBED' | 'DELETED';

interface PublicContactListItem {
  createdAt: Date;
  emailNormalized: string;
  id: string;
  purposes: Array<{
    confirmedAt: Date | null;
    createdAt: Date;
    firstName: string | null;
    friction: string | null;
    locale: string;
    motivation: string | null;
    purpose: PublicLeadPurpose;
    status: PublicLeadStatus;
  }>;
}

export interface PublicContactPage {
  earlyAdopterApplications: number;
  items: PublicContactListItem[];
  launchUpdatesConfirmed: number;
  limit: number;
  offset: number;
  total: number;
}

export interface PublicLeadRepository {
  convertToAccessRequest(leadId: string, now: Date): Promise<string | null>;
  confirm(tokenHash: string, now: Date): Promise<boolean>;
  delete(tokenHash: string, now: Date): Promise<boolean>;
  export(input: PublicLeadExportInput): Promise<PublicLeadExportRow[]>;
  issue(input: PublicLeadIssueInput): Promise<string>;
  list(input: PublicLeadListInput): Promise<PublicContactPage>;
  unsubscribe(tokenHash: string, now: Date): Promise<boolean>;
}

export interface PublicLeadExportInput {
  limit: number;
  purpose?: PublicLeadPurpose;
  status?: PublicLeadStatus;
}

export interface PublicLeadExportRow {
  confirmedAt: Date | null;
  createdAt: Date;
  emailNormalized: string;
  firstName: string | null;
  friction: string | null;
  id: string;
  locale: string;
  motivation: string | null;
  purpose: PublicLeadPurpose;
  status: PublicLeadStatus;
}

export interface PublicLeadIssueInput {
  confirmationExpiresAt: Date;
  confirmationTokenHash: string;
  consentVersion: string;
  email: string;
  firstName?: string;
  friction?: string;
  id: string;
  locale: SupportedLocale;
  managementTokenHash: string;
  motivation?: string;
  now: Date;
  purpose: PublicLeadPurpose;
}

export interface PublicLeadListInput {
  limit: number;
  offset: number;
  purpose?: PublicLeadPurpose;
  search?: string;
}

export interface PublicLeadEmailProvider {
  send(input: PublicLeadEmailInput): Promise<void>;
}

export interface PublicLeadEmailInput {
  confirmationUrl: string;
  deletionUrl: string;
  email: string;
  /** Pour saluer la personne quand elle l'a donné (V4.5-228). */
  firstName?: string;
  idempotencyKey: string;
  /** Vrai quand la même soumission a aussi abonné aux nouvelles. */
  includesLaunchUpdates?: boolean;
  locale: SupportedLocale;
  purpose: PublicLeadPurpose;
  unsubscribeUrl: string;
}

export interface PublicLeadServiceDependencies {
  appUrl: string;
  createId(): string;
  createToken(): string;
  emailProvider: PublicLeadEmailProvider;
  now(): Date;
  repository: PublicLeadRepository;
  ttlMilliseconds: number;
}

export interface PublicLeadRequest {
  email: string;
  firstName?: string;
  friction?: string;
  /** La case « launch updates » : abonne en plus de la candidature. */
  launchUpdates?: boolean;
  locale: SupportedLocale;
  motivation?: string;
  purpose: PublicLeadPurpose;
}
