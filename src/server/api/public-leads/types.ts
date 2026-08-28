import type { SupportedLocale } from '../../../shared/locale.js';

export type PublicLeadPurpose = 'LAUNCH_UPDATES' | 'EARLY_ADOPTER';
export type PublicLeadStatus =
  'PENDING_CONFIRMATION' | 'CONFIRMED' | 'UNSUBSCRIBED' | 'DELETED';

export interface PublicContactListItem {
  createdAt: Date;
  emailNormalized: string;
  id: string;
  purposes: Array<{
    confirmedAt: Date | null;
    createdAt: Date;
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
  idempotencyKey: string;
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
  locale: SupportedLocale;
  motivation?: string;
  purpose: PublicLeadPurpose;
}
