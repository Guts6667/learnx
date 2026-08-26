import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

function DialogFixture({
  dismissOnInteractOutside = true,
  inferReturnFocus = false,
}: {
  dismissOnInteractOutside?: boolean;
  inferReturnFocus?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        elementRef={triggerRef}
        onClick={() => setIsOpen(true)}
      >
        Supprimer la ressource
      </Button>
      <Dialog
        description="Cette action est irréversible."
        dismissOnInteractOutside={dismissOnInteractOutside}
        initialFocusRef={initialFocusRef}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
        returnFocusElement={inferReturnFocus ? undefined : triggerRef.current}
        role="alertdialog"
        title="Confirmer la suppression"
      >
        <Button elementRef={initialFocusRef} variant="danger">
          Supprimer
        </Button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('nomme le dialogue, piège le focus et le restaure après Échap', async () => {
    render(<DialogFixture />);
    const trigger = screen.getByRole('button', {
      name: 'Supprimer la ressource',
    });

    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('alertdialog', {
      name: 'Confirmer la suppression',
    });
    expect(dialog).toHaveAccessibleDescription(
      'Cette action est irréversible.',
    );
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveFocus();
    expect(document.querySelector('.ui-dialog-overlay')).toBeInTheDocument();
    expect(document.body).toHaveAttribute('data-scroll-locked', '1');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body).not.toHaveAttribute('data-scroll-locked');
  });

  it('permet de rendre une confirmation non dismissible depuis l’overlay', async () => {
    render(<DialogFixture dismissOnInteractOutside={false} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Supprimer la ressource' }),
    );

    const overlay = document.querySelector('.ui-dialog-overlay');
    expect(overlay).toBeInstanceOf(HTMLElement);
    if (!overlay) throw new Error('Overlay attendu');
    fireEvent.pointerDown(overlay);

    expect(
      screen.getByRole('alertdialog', { name: 'Confirmer la suppression' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
  });

  it('restaure le déclencheur actif même sans cible explicite', async () => {
    render(<DialogFixture inferReturnFocus />);
    const trigger = screen.getByRole('button', {
      name: 'Supprimer la ressource',
    });

    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(
      screen.getByRole('alertdialog', { name: 'Confirmer la suppression' }),
      { key: 'Escape' },
    );

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
