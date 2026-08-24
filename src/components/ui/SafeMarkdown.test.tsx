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

  it('rend le code, les tableaux et les médias LearnX sans perdre leur structure', () => {
    const { container } = render(
      <SafeMarkdown
        content={
          '`pnpm dev`\n\n```bash\ncurl http://localhost:3000/health\n```\n\n| Signal | Sens |\n| --- | --- |\n| 200 | Service joignable |\n\n![Architecture](/learning/sourcelab/architecture.svg "Flux local")'
        }
      />,
    );

    expect(screen.getByText('pnpm dev').tagName).toBe('CODE');
    expect(screen.getByRole('region', { name: 'Code — bash' })).toHaveTextContent(
      'curl http://localhost:3000/health',
    );
    expect(screen.getByRole('table')).toHaveTextContent('Service joignable');
    expect(screen.getByRole('img', { name: 'Architecture' })).toHaveAttribute(
      'src',
      '/learning/sourcelab/architecture.svg',
    );
    expect(container.querySelector('pre code')).toBeInTheDocument();
  });

  it('refuse les médias externes et les traversées de chemin', () => {
    const { container } = render(
      <SafeMarkdown
        content={
          '![Externe](https://example.com/track.png)\n\n![Traversal](/learning/%2e%2e/secret.png)'
        }
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Externe')).toBeInTheDocument();
    expect(screen.getByText('Traversal')).toBeInTheDocument();
  });
});
