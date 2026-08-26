import { AdminNavigation } from '@/components/layout/AdminNavigation';
import { TotemAppShell } from '@/components/layout/TotemShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { useI18n } from '@/i18n';

export function TotemAdminPreviewPage() {
  const { t } = useI18n();

  return (
    <TotemAppShell
      bottomNavigation={<AdminNavigation currentPath="/admin/accounts" />}
      className="totem-admin-surface"
      contentId="main-content"
      contentTabIndex={-1}
      sidebar={<AdminNavigation currentPath="/admin/accounts" />}
      topbar={
        <div className="totem-admin-topbar">
          <div>
            <p className="page-eyebrow">{t('admin.eyebrow')}</p>
            <p className="totem-admin-topbar__title">{t('admin.title')}</p>
          </div>
          <Button variant="secondary">{t('admin.navigation.backToApp')}</Button>
        </div>
      }
    >
      <section className="page-layout page-layout--admin page-shell">
        <PageHeader
          description={t('admin.accounts.description')}
          eyebrow="Aperçu de design — données de démonstration"
          id="totem-admin-preview-title"
          title={t('admin.accounts.title')}
        />
        <div className="admin-toolbar">
          <label className="ui-field">
            <span className="ui-field__label">
              {t('admin.accounts.search')}
            </span>
            <input
              className="ui-field__control"
              placeholder="camille@learnx.test"
            />
          </label>
          <Button variant="secondary">{t('programs.searchAction')}</Button>
        </div>
        <ResponsiveTable
          caption={t('admin.accounts.title')}
          columns={[
            { key: 'account', label: t('admin.navigation.accounts') },
            { key: 'role', label: t('admin.requests.role') },
            { key: 'status', label: t('admin.requests.status') },
            { key: 'action', label: t('admin.manageContent') },
          ]}
          rows={[
            {
              cells: {
                account: (
                  <div>
                    <strong>Camille Martin</strong>
                    <p className="ui-text-muted text-sm">camille@learnx.test</p>
                  </div>
                ),
                action: (
                  <Button variant="secondary">
                    {t('admin.accounts.suspend')}
                  </Button>
                ),
                role: t('admin.role.user'),
                status: <Badge tone="info">{t('admin.accounts.active')}</Badge>,
              },
              key: 'demo-account-active',
            },
            {
              cells: {
                account: (
                  <div>
                    <strong>Alex Renard</strong>
                    <p className="ui-text-muted text-sm">alex@learnx.test</p>
                  </div>
                ),
                action: (
                  <Button variant="secondary">
                    {t('admin.accounts.reactivate')}
                  </Button>
                ),
                role: t('admin.role.creator'),
                status: (
                  <Badge tone="warning">{t('admin.accounts.suspended')}</Badge>
                ),
              },
              key: 'demo-account-suspended',
            },
          ]}
        />
      </section>
    </TotemAppShell>
  );
}
