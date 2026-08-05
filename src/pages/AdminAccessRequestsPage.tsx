import { useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import {
  type AdminAccessRequest,
  type AccessRequestStatus,
  type AssignableRole,
  useAdminAccessRequestReviewMutation,
  useAdminAccessRequestsQuery,
} from '@/features/admin/access-requests';
import { ApiClientError } from '@/lib/api-client';

const statusLabels: Record<AccessRequestStatus, string> = {
  APPROVED: 'Acceptées',
  PENDING_APPROVAL: 'À examiner',
  REJECTED: 'Refusées',
};
const roleLabels: Record<AssignableRole, string> = {
  ADMIN: 'Administrateur',
  CREATOR: 'Créateur',
  USER: 'Apprenant',
};

function reviewError(error: unknown): string {
  if (
    error instanceof ApiClientError &&
    error.code === 'ACCESS_REQUEST_CONFLICT'
  ) {
    return 'Cette demande a été modifiée ou traitée. Rechargez la liste avant de recommencer.';
  }
  return 'La décision n’a pas pu être enregistrée.';
}

function RequestReview({ request }: { request: AdminAccessRequest }) {
  const mutation = useAdminAccessRequestReviewMutation();
  const [action, setAction] = useState<'APPROVE' | 'REJECT'>();
  const [confirmation, setConfirmation] = useState(false);
  const [reason, setReason] = useState('');
  const [role, setRole] = useState<AssignableRole>('USER');
  const [success, setSuccess] = useState<string>();

  async function applyDecision() {
    setSuccess(undefined);
    try {
      if (action === 'APPROVE') {
        await mutation.approve(request.id, {
          expectedVersion: request.version,
          role,
        });
        setSuccess('Demande acceptée et invitation préparée.');
      } else if (action === 'REJECT') {
        await mutation.reject(request.id, {
          expectedVersion: request.version,
          reason: reason.trim(),
        });
        setSuccess('Demande refusée.');
      }
      setAction(undefined);
      setConfirmation(false);
    } catch {
      // The normalized mutation error is announced below.
    }
  }

  if (request.status !== 'PENDING_APPROVAL') {
    return (
      <div class="space-y-2 text-sm text-slate-300">
        {request.assignedRole ? (
          <p>Rôle attribué : {roleLabels[request.assignedRole]}</p>
        ) : null}
        {request.rejectionReason ? (
          <p>Motif interne : {request.rejectionReason}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div class="space-y-4">
      {!action ? (
        <div class="grid gap-3 sm:grid-cols-2">
          <Button onClick={() => setAction('APPROVE')}>Accepter</Button>
          <Button onClick={() => setAction('REJECT')} variant="secondary">
            Refuser
          </Button>
        </div>
      ) : (
        <div class="space-y-4 border-t border-slate-700 pt-4">
          {action === 'APPROVE' ? (
            <label class="grid gap-2 text-sm font-medium text-slate-200">
              Rôle à attribuer
              <select
                class="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                onChange={(event) =>
                  setRole(event.currentTarget.value as AssignableRole)
                }
                value={role}
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Textarea
              description="Ce motif reste interne et n’est jamais affiché publiquement."
              label="Motif du refus"
              maxLength={2_000}
              onInput={(event) => setReason(event.currentTarget.value)}
              required
              value={reason}
            />
          )}
          {!confirmation ? (
            <div class="flex flex-wrap gap-3">
              <Button
                disabled={action === 'REJECT' && !reason.trim()}
                onClick={() => setConfirmation(true)}
                variant={action === 'APPROVE' ? 'primary' : 'danger'}
              >
                Prévisualiser la décision
              </Button>
              <Button onClick={() => setAction(undefined)} variant="ghost">
                Annuler
              </Button>
            </div>
          ) : (
            <Card class="space-y-3 bg-slate-950" role="region">
              <h3 class="font-semibold">Confirmer la décision</h3>
              <p class="text-sm leading-6 text-slate-300">
                {action === 'APPROVE'
                  ? `La demande sera acceptée avec le rôle « ${roleLabels[role]} ». Une invitation sera préparée, sans créer de compte.`
                  : `La demande sera refusée avec le motif interne « ${reason.trim()} ».`}
              </p>
              <div class="flex flex-wrap gap-3">
                <Button
                  isLoading={mutation.isPending}
                  onClick={() => void applyDecision()}
                  variant={action === 'APPROVE' ? 'primary' : 'danger'}
                >
                  Confirmer
                </Button>
                <Button
                  onClick={() => setConfirmation(false)}
                  variant="ghost"
                >
                  Modifier
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
      {success ? (
        <p class="text-sm text-emerald-200" role="status">
          {success}
        </p>
      ) : null}
      {mutation.error ? (
        <ErrorState description={reviewError(mutation.error)} />
      ) : null}
    </div>
  );
}

function RequestCard({ request }: { request: AdminAccessRequest }) {
  const tone =
    request.status === 'APPROVED'
      ? 'success'
      : request.status === 'REJECTED'
        ? 'danger'
        : 'warning';

  return (
    <li>
      <Card class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="break-words text-lg font-semibold">
              {request.emailNormalized}
            </h2>
            <p class="mt-1 text-sm text-slate-400">
              Vérifiée le{' '}
              {new Intl.DateTimeFormat('fr-FR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(request.emailVerifiedAt))}
            </p>
          </div>
          <Badge tone={tone}>{statusLabels[request.status]}</Badge>
        </div>
        <RequestReview request={request} />
      </Card>
    </li>
  );
}

export function AdminAccessRequestsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] =
    useState<AccessRequestStatus>('PENDING_APPROVAL');
  const query = useAdminAccessRequestsQuery({
    page,
    pageSize: 20,
    search,
    status,
  });

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <section aria-labelledby="access-review-title" class="page-shell space-y-6">
      <a
        class="inline-flex min-h-11 items-center text-sm font-medium text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        href="/admin"
      >
        Retour à l’administration
      </a>
      <PageHeader
        description="Examinez les adresses vérifiées, attribuez un rôle et conservez une décision auditée."
        eyebrow="Zone sécurisée"
        id="access-review-title"
        title="Demandes d’accès"
      />
      <form class="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={submitSearch}>
        <TextField
          label="Rechercher par e-mail"
          onInput={(event) => setSearchInput(event.currentTarget.value)}
          type="search"
          value={searchInput}
        />
        <Button class="self-end" type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>
      <label class="grid gap-2 text-sm font-medium text-slate-200">
        État des demandes
        <select
          class="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          onChange={(event) => {
            setPage(1);
            setStatus(event.currentTarget.value as AccessRequestStatus);
          }}
          value={status}
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {query.isPending ? (
        <p aria-live="polite">Chargement des demandes…</p>
      ) : query.error || !query.data ? (
        <ErrorState description="Les demandes d’accès n’ont pas pu être chargées." />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          description="Aucune demande vérifiée ne correspond à ces filtres."
          title="Aucune demande"
        />
      ) : (
        <>
          <p class="text-sm text-slate-400">
            {query.data.total} demande{query.data.total > 1 ? 's' : ''}
          </p>
          <ul class="space-y-4">
            {query.data.items.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </ul>
          <nav
            aria-label="Pagination des demandes"
            class="flex items-center justify-between gap-4"
          >
            <Button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              variant="secondary"
            >
              Précédent
            </Button>
            <span class="text-sm text-slate-300">
              Page {query.data.page} sur {query.data.totalPages}
            </span>
            <Button
              disabled={page >= query.data.totalPages}
              onClick={() => setPage((value) => value + 1)}
              variant="secondary"
            >
              Suivant
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
