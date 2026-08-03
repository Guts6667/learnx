import { fireEvent, render, screen } from '@testing-library/preact';
import { useState } from 'preact/hooks';

import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';

function DrawerFixture() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Ouvrir la gestion</Button>
      <Drawer
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
        title="Gestion du module"
      >
        <Button>Première action</Button>
        <Button>Dernière action</Button>
      </Drawer>
    </>
  );
}

describe('Drawer', () => {
  it('prend le focus, le piège puis le rend au déclencheur avec Échap', () => {
    render(<DrawerFixture />);
    const trigger = screen.getByRole('button', { name: 'Ouvrir la gestion' });

    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = screen.getByRole('button', {
      name: 'Fermer le panneau',
    });
    const lastButton = screen.getByRole('button', {
      name: 'Dernière action',
    });
    expect(closeButton).toHaveFocus();

    lastButton.focus();
    fireEvent.keyDown(lastButton, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
