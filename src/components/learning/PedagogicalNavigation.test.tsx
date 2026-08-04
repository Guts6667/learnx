import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/preact';

import { PedagogicalNavigation } from '@/components/learning/PedagogicalNavigation';
import type { LessonActivity } from '@/lib/lesson-activity-sequence';

const activities: LessonActivity[] = [
  {
    estimatedMinutes: 5,
    href: '/lesson/demo?activity=content:one',
    id: 'one',
    kind: 'CONTENT',
    label: 'Comprendre',
    required: true,
    status: 'COMPLETED',
    title: 'Une activité au titre suffisamment long pour revenir à la ligne',
  },
  {
    estimatedMinutes: null,
    href: '/lesson/demo?activity=quiz:two',
    id: 'two',
    kind: 'QUIZ',
    label: 'Consolider',
    required: true,
    status: 'IN_PROGRESS',
    title: 'Quiz de compréhension',
  },
  {
    estimatedMinutes: null,
    href: '/lesson/demo?activity=complete:lesson',
    id: 'lesson',
    kind: 'COMPLETE',
    label: 'Terminer',
    required: true,
    status: 'AVAILABLE',
    title: 'Terminer la leçon',
  },
];

function renderNavigation() {
  return render(
    <PedagogicalNavigation
      activities={activities}
      currentKey="quiz:two"
      lessonTitle="Leçon de démonstration"
      moduleTitle="Module de test"
    />,
  );
}

describe('PedagogicalNavigation', () => {
  it('ordonne le sommaire puis Précédent et Continuer sans Suivant', () => {
    renderNavigation();
    const navigation = screen.getByRole('navigation', {
      name: 'Navigation pédagogique',
    });
    const summary = within(navigation).getByRole('button', {
      name: 'Sommaire',
    });
    const previous = within(navigation).getByRole('link', {
      name: 'Précédent',
    });
    const continueLink = within(navigation).getByRole('link', {
      name: 'Continuer',
    });

    expect(summary.compareDocumentPosition(previous)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(previous.compareDocumentPosition(continueLink)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(within(navigation).queryByText('Suivant')).not.toBeInTheDocument();
    expect(
      within(navigation).queryByRole('link', { name: 'Retour à la leçon' }),
    ).not.toBeInTheDocument();
  });

  it('ouvre un sommaire mono-colonne accessible et restaure le focus', async () => {
    renderNavigation();
    const summary = screen.getByRole('button', { name: 'Sommaire' });
    summary.focus();
    fireEvent.click(summary);

    const dialog = screen.getByRole('dialog', {
      name: 'Sommaire de la leçon',
    });
    expect(
      screen.getByRole('button', { name: 'Fermer le panneau' }),
    ).toHaveFocus();
    expect(within(dialog).getByRole('list')).toHaveClass('grid-cols-1');
    expect(
      within(dialog).getByRole('link', { name: /Quiz de compréhension/ }),
    ).toHaveAttribute('aria-current', 'step');
    expect(dialog).toHaveTextContent('Activité actuelle · En cours');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(summary).toHaveFocus());
  });
});
