import { fireEvent, render, screen } from '@testing-library/preact';

import { Button } from '@/components/ui/Button';
import { NavigationAction } from '@/components/ui/NavigationAction';

describe('NavigationAction', () => {
  it('conserve une sémantique de lien et une cible tactile explicite', () => {
    render(
      <NavigationAction href="/program" variant="secondary">
        Ouvrir le parcours
      </NavigationAction>,
    );

    const action = screen.getByRole('link', { name: 'Ouvrir le parcours' });

    expect(action).toHaveAttribute('href', '/program');
    expect(action).toHaveClass('min-h-11', 'bg-slate-800');
    expect(action).not.toHaveAttribute('role', 'button');
  });

  it('transmet les attributs accessibles de navigation', () => {
    render(
      <NavigationAction
        aria-label="Continuer vers la prochaine activité"
        href="/lesson/next"
        size="lg"
      >
        Continuer
      </NavigationAction>,
    );

    expect(
      screen.getByRole('link', {
        name: 'Continuer vers la prochaine activité',
      }),
    ).toHaveClass('min-h-12');
  });

  it('distingue une navigation GET d’une mutation', () => {
    const mutate = vi.fn();

    render(
      <div>
        <NavigationAction href="/notes">Ouvrir les notes</NavigationAction>
        <Button onClick={mutate}>Enregistrer</Button>
      </div>,
    );

    const navigation = screen.getByRole('link', { name: 'Ouvrir les notes' });
    const mutation = screen.getByRole('button', { name: 'Enregistrer' });

    expect(navigation).toHaveAttribute('href', '/notes');
    expect(mutation).not.toHaveAttribute('href');
    fireEvent.click(mutation);
    expect(mutate).toHaveBeenCalledOnce();
  });
});
