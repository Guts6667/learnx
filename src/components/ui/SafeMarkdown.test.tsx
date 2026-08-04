import { render, screen } from '@testing-library/preact';

import { SafeMarkdown } from '@/components/ui/SafeMarkdown';

describe('SafeMarkdown', () => {
  it('rend les titres, paragraphes, listes et emphases sémantiquement', () => {
    render(
      <SafeMarkdown
        content={`## Consignes\n1. Lire le cas.\n2. Rédiger une **analyse**.\n\n- Une limite\n- Une *source*`}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Consignes' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getByText('analyse').tagName).toBe('STRONG');
    expect(screen.getByText('source').tagName).toBe('EM');
  });

  it('autorise uniquement les liens HTTP et HTTPS', () => {
    render(
      <SafeMarkdown content="[Source](https://example.com/doc) [Danger](javascript:alert(1))" />,
    );

    expect(screen.getByRole('link', { name: /source/i })).toHaveAttribute(
      'href',
      'https://example.com/doc',
    );
    expect(
      screen.queryByRole('link', { name: /danger/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Danger')).toBeInTheDocument();
  });

  it('neutralise le HTML brut au lieu de l’injecter', () => {
    const { container } = render(
      <SafeMarkdown
        content={'<img src=x onerror="alert(1)">\n<script>alert(1)</script>'}
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });
});
