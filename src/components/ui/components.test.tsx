import { fireEvent, render, screen } from '@testing-library/react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConsentGroup } from '@/components/ui/ConsentGroup';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { Metadata } from '@/components/ui/Metadata';
import { Notice } from '@/components/ui/Notice';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatePanel } from '@/components/ui/StatePanel';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';
import { TotemTheme } from '@/components/ui/TotemTheme';

describe('design system minimal', () => {
  it('affiche les primitives de contenu et de progression', () => {
    render(
      <>
        <Card>Contenu de la carte</Card>
        <Badge tone="success">Validée</Badge>
        <ProgressBar label="Progression" value={35} />
      </>,
    );

    expect(screen.getByText('Contenu de la carte')).toBeInTheDocument();
    expect(screen.getByText('Validée')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Progression' }),
    ).toHaveAttribute('aria-valuenow', '35');
    expect(screen.getByText('35 %')).toBeInTheDocument();
    expect(screen.getByText('Contenu de la carte')).toHaveClass('ui-card');
    expect(screen.getByText('Validée')).toHaveClass(
      'ui-badge',
      'ui-badge--success',
    );
  });

  it('structure une section, une ligne et des métadonnées sans carte imbriquée', () => {
    const { container } = render(
      <Section description="Description secondaire" title="Comprendre">
        <div className="ui-list">
          <ListRow aside={<span>12 min</span>}>
            <strong>Leçon accessible</strong>
          </ListRow>
        </div>
        <Metadata
          items={[
            { label: 'Durée', value: '12 min' },
            { label: 'Statut', value: 'Disponible' },
          ]}
        />
      </Section>,
    );

    expect(
      screen.getByRole('heading', { name: 'Comprendre' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Leçon accessible').closest('.ui-list-row')).toBe(
      screen.getAllByText('12 min')[0]?.closest('.ui-list-row'),
    );
    expect(screen.getByText('Durée').closest('dl')).toHaveClass('ui-metadata');
    expect(container.querySelector('.ui-card')).toBeNull();
  });

  it('gère les états désactivé et chargement du bouton', () => {
    render(
      <Button isLoading variant="primary">
        Enregistrer
      </Button>,
    );

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /enregistrer/i })).toHaveClass(
      'ui-action',
      'ui-action--primary',
      'ui-action--md',
    );
    expect(
      screen.getByRole('status', { name: 'Chargement' }),
    ).toBeInTheDocument();
  });

  it('permet à une action shadcn possédée de composer un lien sans wrapper', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/today">Revenir à aujourd’hui</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Revenir à aujourd’hui' });
    expect(link).toHaveAttribute('href', '/today');
    expect(link).toHaveClass(
      'ui-action',
      'ui-action--secondary',
      'ui-action--md',
    );
  });

  it('associe labels et erreurs aux champs de formulaire', () => {
    const onChange = vi.fn();

    render(
      <>
        <Checkbox label="Accepter les conditions" onChange={onChange} />
        <TextField error="Adresse e-mail invalide" label="E-mail" />
        <Textarea description="Maximum 500 caractères" label="Note" />
      </>,
    );

    const checkbox = screen.getByRole('checkbox', {
      name: 'Accepter les conditions',
    });
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('E-mail')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('E-mail')).toHaveClass('ui-field__control');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Adresse e-mail invalide',
    );
    expect(screen.getByLabelText('Note')).toHaveAttribute('aria-describedby');
  });

  it('rend les états de feedback accessibles', () => {
    render(
      <>
        <Spinner label="Chargement des données" />
        <EmptyState
          description="Ajoutez un élément pour commencer."
          title="Aucun élément"
        />
        <ErrorState description="Réessayez dans quelques instants." />
        <OfflineBanner />
      </>,
    );

    expect(
      screen.getByRole('status', { name: 'Chargement des données' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Aucun élément' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Réessayez');
    expect(
      screen.getByRole('status', { name: /hors ligne/i }),
    ).toBeInTheDocument();
  });

  it('masque la bannière hors ligne lorsque la connexion est disponible', () => {
    render(<OfflineBanner isOffline={false} />);

    expect(screen.queryByText(/vous êtes hors ligne/i)).not.toBeInTheDocument();
  });

  it('expose une hiérarchie de page et un skeleton annoncés', () => {
    render(
      <>
        <PageHeader
          description="Description lisible"
          eyebrow="Parcours"
          id="page-title"
          title="Titre de page"
        />
        <Skeleton label="Chargement de la page" />
      </>,
    );

    expect(
      screen.getByRole('heading', { name: 'Titre de page' }),
    ).toHaveAttribute('id', 'page-title');
    expect(
      screen.getByRole('status', { name: 'Chargement de la page' }),
    ).toBeInTheDocument();
  });

  it('active Totem dans une frontière locale et expose les variantes visuelles', () => {
    render(
      <TotemTheme>
        <Button variant="editorial">Lire la publication</Button>
        <Card tone="signature">Prochaine étape</Card>
      </TotemTheme>,
    );

    expect(screen.getByText('Lire la publication')).toHaveClass(
      'ui-action--editorial',
    );
    expect(screen.getByText('Prochaine étape')).toHaveClass(
      'ui-card--signature',
    );
    expect(
      screen.getByText('Prochaine étape').closest('.totem-theme'),
    ).toHaveAttribute('data-visual-system', 'totem');
  });

  it('annonce chaque notice par un libellé et une sémantique explicites', () => {
    render(
      <>
        <Notice title="Action enregistrée" tone="safe">
          La modification est conservée.
        </Notice>
        <Notice title="Échec de l’action" tone="danger">
          Aucune modification n’a été enregistrée.
        </Notice>
      </>,
    );

    expect(
      screen.getByRole('status', { name: 'Action enregistrée' }),
    ).toHaveTextContent('conservée');
    expect(
      screen.getByRole('alert', { name: 'Échec de l’action' }),
    ).toHaveTextContent('Aucune modification');
  });

  it('formalise les états chargement, vide, erreur et sûr sans couleur seule', () => {
    render(
      <>
        <StatePanel status="loading" title="Chargement">
          Patientez.
        </StatePanel>
        <StatePanel status="empty" title="Aucun résultat">
          Modifiez les filtres.
        </StatePanel>
        <StatePanel status="error" title="Erreur de chargement">
          Réessayez.
        </StatePanel>
        <StatePanel status="safe" title="Enregistré">
          Aucune autre action requise.
        </StatePanel>
      </>,
    );

    expect(screen.getByRole('status', { name: 'Chargement' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByRole('status', { name: 'Aucun résultat' })).toHaveClass(
      'ui-state-panel--empty',
    );
    expect(
      screen.getByRole('alert', { name: 'Erreur de chargement' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Enregistré' }),
    ).toHaveTextContent('Aucune autre action');
  });

  it('garde les consentements indépendants dans un fieldset nommé', () => {
    render(
      <ConsentGroup legend="Préférences">
        <Checkbox label="Informations de lancement" />
        <Checkbox label="Programme early adopter" />
      </ConsentGroup>,
    );

    expect(
      screen.getByRole('group', { name: 'Préférences' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Informations de lancement' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Programme early adopter' }),
    ).not.toBeChecked();
  });

  it('fournit une table desktop et des enregistrements mobiles équivalents', () => {
    render(
      <ResponsiveTable
        caption="Ressources"
        columns={[
          { key: 'name', label: 'Nom' },
          { key: 'status', label: 'État' },
        ]}
        rows={[
          {
            cells: { name: 'Guide', status: 'Disponible' },
            key: 'guide',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('table', { name: 'Ressources' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Ressources' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Guide')).toHaveLength(2);
    expect(screen.getAllByText('Disponible')).toHaveLength(2);
  });
});
