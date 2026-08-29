import type {
  CreditLedgerEntryType,
  CreditPolicyStatus,
} from '../../../generated/prisma/client.js';
import type { CreditProvenanceValue } from './credit-ledger.js';
import type { AdjustCreditsInput } from './prisma-credit-ledger.js';

export interface CreditProjectionPart {
  available: bigint;
  consumed: bigint;
  expired: bigint;
  reserved: bigint;
}

export interface CreditProjection {
  free: CreditProjectionPart;
  purchased: CreditProjectionPart;
  totalAvailable: bigint;
  totalReserved: bigint;
}

interface CreditHistoryItem {
  actorUserId: string | null;
  amount: bigint;
  createdAt: Date;
  entryId: string;
  provenance: CreditProvenanceValue;
  reason: string | null;
  referenceId: string;
  referenceType: string;
  type: CreditLedgerEntryType;
}

interface CreditMemberSummary {
  accountStatus: 'ACTIVE' | 'PSEUDONYMISED' | 'SUSPENDED';
  displayName: string;
  email: string;
  projection: CreditProjection;
  userId: string;
}

export interface CreditMemberDetail extends CreditMemberSummary {
  history: CreditHistoryItem[];
  pendingIncreaseRequest: {
    createdAt: Date;
    id: string;
    reason: string;
  } | null;
}

export interface CreditMemberPage {
  items: CreditMemberSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CreditPolicySummary {
  id: string;
  key: string;
  status: CreditPolicyStatus;
  version: string;
}

export interface CreditAdministrationService {
  adjustFreeAllocation(input: AdjustCreditsInput): Promise<CreditMemberDetail>;
  createIncreaseRequest(input: {
    idempotencyKey: string;
    reason: string;
    userId: string;
  }): Promise<{ createdAt: Date; id: string; reason: string; status: string }>;
  getMember(
    actorUserId: string,
    userId: string,
  ): Promise<CreditMemberDetail | null>;
  getOwnCredits(userId: string): Promise<CreditMemberDetail | null>;
  listMembers(input: {
    actorUserId: string;
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<CreditMemberPage>;
  listPolicies(): Promise<{
    allocation: CreditPolicySummary[];
    limits: CreditPolicySummary[];
  }>;
  reviewIncreaseRequest(input: {
    actorUserId: string;
    idempotencyKey: string;
    requestId: string;
    reviewReason: string;
    status: 'APPROVED' | 'REJECTED';
  }): Promise<void>;
}
