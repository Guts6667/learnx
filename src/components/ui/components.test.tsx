import { fireEvent, render, screen } from '@testing-library/preact';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { Metadata } from '@/components/ui/Metadata';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import { TextField } from '@/components/ui/TextField';

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
        <div class="ui-list">
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
});
