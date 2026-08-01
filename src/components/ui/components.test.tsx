import { fireEvent, render, screen } from '@testing-library/preact';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
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
  });

  it('gère les états désactivé et chargement du bouton', () => {
    render(
      <Button isLoading variant="primary">
        Enregistrer
      </Button>,
    );

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
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
});
