import type { FormEvent } from 'react';
import { useState } from 'react';

import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/TextField';
import {
  type PublicContact,
  type PublicContactPurpose,
  type PublicLeadPurpose,
  type PublicLeadStatus,
  useAdminPublicContactsQuery,
} from '@/features/admin/public-contacts';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/catalogs';
import { formatLocalizedDate } from '@/shared/locale';

const purposeKeys: Record<PublicLeadPurpose, MessageKey> = {
  EARLY_ADOPTER: 'admin.contacts.purpose.early',
  LAUNCH_UPDATES: 'admin.contacts.purpose.launch',
};
const statusKeys: Record<PublicLeadStatus, MessageKey> = {
  CONFIRMED: 'admin.contacts.status.confirmed',
  DELETED: 'admin.contacts.status.deleted',
  PENDING_CONFIRMATION: 'admin.contacts.status.pending',
  UNSUBSCRIBED: 'admin.contacts.status.unsubscribed',
};

function statusTone(status: PublicLeadStatus) {
  if (status === 'CONFIRMED') return 'info' as const;
  if (status === 'PENDING_CONFIRMATION') return 'warning' as const;
  return status === 'DELETED' ? ('danger' as const) : ('neutral' as const);
}

function PurposeDetails({ item }: { item: PublicContactPurpose }) {
  const { locale, t } = useI18n();
  return (
    <div className="space-y-2 border-t border-[var(--color-border)] pt-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="font-medium">{t(purposeKeys[item.purpose])}</strong>
        <Badge tone={statusTone(item.status)}>
          {t(statusKeys[item.status])}
        </Badge>
      </div>
      <p className="ui-text-muted text-sm">
        {t('admin.contacts.date', {
          date: formatLocalizedDate(item.createdAt, locale, {
            dateStyle: 'medium',
          }),
        })}
        {' · '}
        {t('admin.contacts.locale', { locale: item.locale.toUpperCase() })}
      </p>
      {item.firstName ? (
        <p className="ui-text break-words text-sm">
          {t('admin.contacts.firstName', { firstName: item.firstName })}
        </p>
      ) : null}
      {item.motivation ? (
        <p className="ui-text-muted break-words text-sm leading-6">
          {item.motivation}
        </p>
      ) : null}
      {/*
        Le frein est étiqueté, pas juste posé sous la motivation : deux
        paragraphes libres à la suite se liraient comme un seul texte, et la
        réponse à « ce qui vous ralentit » n'est pas la suite de « ce que vous
        voulez apprendre » (V4.5-228).
      */}
      {item.friction ? (
        <p className="ui-text-muted break-words text-sm leading-6">
          {t('admin.contacts.friction', { friction: item.friction })}
        </p>
      ) : null}
    </div>
  );
}

function ContactCard({ contact }: { contact: PublicContact }) {
  return (
    <li>
      <div className="admin-collection-item min-w-0 space-y-4">
        <h2 className="break-all text-lg font-medium">
          {contact.emailNormalized}
        </h2>
        <div className="space-y-3">
          {contact.purposes.map((purpose) => (
            <PurposeDetails item={purpose} key={purpose.purpose} />
          ))}
        </div>
      </div>
    </li>
  );
}

export function AdminContactsPage() {
  useBackNavigationTarget({
    href: '/admin',
    labelKey: 'navigation.back.admin',
  });
  const { t } = useI18n();
  const [offset, setOffset] = useState(0);
  const [purpose, setPurpose] = useState<PublicLeadPurpose | ''>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 20;
  const query = useAdminPublicContactsQuery({
    limit,
    offset,
    purpose: purpose || undefined,
    search,
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  }

  const page = Math.floor(offset / limit) + 1;
  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / limit))
    : 1;

  return (
    <section
      aria-labelledby="contacts-title"
      className="page-layout page-layout--admin page-shell space-y-6"
    >
      <PageHeader
        description={t('admin.contacts.description')}
        eyebrow={t('admin.eyebrow')}
        id="contacts-title"
        title={t('admin.contacts.title')}
      />
      {query.data && !query.error && !query.isPending ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <Card className="space-y-2" tone="muted">
            <dt className="ui-text-muted text-sm">
              {t('admin.contacts.metric.launch')}
            </dt>
            <dd className="text-3xl font-medium">
              {query.data.launchUpdatesConfirmed}
            </dd>
          </Card>
          <Card className="space-y-2" tone="muted">
            <dt className="ui-text-muted text-sm">
              {t('admin.contacts.metric.early')}
            </dt>
            <dd className="text-3xl font-medium">
              {query.data.earlyAdopterApplications}
            </dd>
          </Card>
        </dl>
      ) : null}
      <div className="admin-toolbar">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={submitSearch}
        >
          <TextField
            label={t('admin.contacts.search')}
            onInput={(event) => setSearchInput(event.currentTarget.value)}
            type="search"
            value={searchInput}
          />
          <Button className="self-end" type="submit" variant="secondary">
            {t('programs.searchAction')}
          </Button>
        </form>
        <label className="ui-field">
          <span className="ui-field__label">{t('admin.contacts.filter')}</span>
          <select
            className="ui-field__control"
            onChange={(event) => {
              setOffset(0);
              setPurpose(event.currentTarget.value as PublicLeadPurpose | '');
            }}
            value={purpose}
          >
            <option value="">{t('admin.contacts.filter.all')}</option>
            <option value="LAUNCH_UPDATES">
              {t(purposeKeys.LAUNCH_UPDATES)}
            </option>
            <option value="EARLY_ADOPTER">
              {t(purposeKeys.EARLY_ADOPTER)}
            </option>
          </select>
        </label>
      </div>
      {query.isPending ? (
        <p aria-live="polite">{t('admin.contacts.loading')}</p>
      ) : query.error || !query.data ? (
        <ErrorState
          action={
            <Button onClick={() => void query.retry()} variant="secondary">
              {t('common.retry')}
            </Button>
          }
          description={t('admin.contacts.loadError')}
        />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          description={t('admin.contacts.empty.description')}
          title={t('admin.contacts.empty.title')}
        />
      ) : (
        <>
          <p className="ui-text-muted text-sm">
            {t('admin.contacts.count', { count: query.data.total })}
          </p>
          <ul className="admin-collection">
            {query.data.items.map((contact) => (
              <ContactCard contact={contact} key={contact.id} />
            ))}
          </ul>
          <nav
            aria-label={t('admin.contacts.pagination')}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <Button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              variant="secondary"
            >
              {t('admin.accounts.previous')}
            </Button>
            <span className="ui-text-muted text-sm">
              {t('admin.accounts.page', { page, total: totalPages })}
            </span>
            <Button
              disabled={page >= totalPages}
              onClick={() => setOffset(offset + limit)}
              variant="secondary"
            >
              {t('admin.accounts.next')}
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
