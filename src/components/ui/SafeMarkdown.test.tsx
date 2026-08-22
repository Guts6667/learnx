import { render, screen } from '@testing-library/preact';

import { SafeMarkdown } from '@/components/ui/SafeMarkdown';

describe('SafeMarkdown', () => {
  it('rend les titres, paragraphes, listes et emphases sémantiquement', () => {
    render(
      <SafeMarkdown
        content={
          '## Consignes\n1. Lire le cas.\n2. Rédiger une **analyse** avec `curl`.\n\n- Une limite\n- Une *source*'
        }
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Consignes' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getByText('analyse').tagName).toBe('STRONG');
    expect(screen.getByText('source').tagName).toBe('EM');
    expect(screen.getByText('curl').tagName).toBe('CODE');
    expect(screen.getByText('curl')).toHaveClass('ui-inline-code');
  });

  it('imbrique les titres sous le niveau sémantique fourni', () => {
    render(
      <SafeMarkdown
        content={'# Modèle mental\n## Détail\n### Limite'}
        headingStartLevel={3}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'Modèle mental' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Détail' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 5, name: 'Limite' }),
    ).toBeInTheDocument();
  });

  it('normalise un contenu qui commence directement par un titre de niveau deux', () => {
    render(
      <SafeMarkdown
        content={'## Modèle mental\n### Détail'}
        headingStartLevel={3}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'Modèle mental' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Détail' }),
    ).toBeInTheDocument();
  });

  it('omet uniquement le premier titre quand le contexte affiche déjà le même intitulé', () => {
    render(
      <SafeMarkdown
        content={
          'Introduction.\n\n## Suivre une `requête` HTTP ##\n\n### Interprétation\n\nLe détail.'
        }
        headingStartLevel={3}
        omitFirstHeadingWhenEqual="Suivre une requête HTTP"
      />,
    );

    expect(
      screen.queryByRole('heading', { name: 'Suivre une requête HTTP' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Interprétation' }),
    ).toBeInTheDocument();
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

  it('rend un bloc de code balisé, défilable au clavier et sans interpréter son contenu', () => {
    const { container } = render(
      <SafeMarkdown
        content={[
          '```typescript',
          'const unsafe = "<script>alert(1)</script>";',
          '```',
        ].join('\n')}
      />,
    );

    const region = screen.getByRole('region', {
      name: 'Code — typescript',
    });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.querySelector('code')).toHaveClass('language-typescript');
    expect(region).toHaveTextContent(
      'const unsafe = "<script>alert(1)</script>";',
    );
    expect(container.querySelector('script')).toBeNull();
  });

  it('rend les images pédagogiques locales avec leur alternative et leur légende', () => {
    render(
      <SafeMarkdown
        content={
          '![Trajet de la requête](/learning/http/request-flow.svg "Du client au handler")'
        }
      />,
    );

    const image = screen.getByRole('img', {
      name: 'Trajet de la requête',
    });
    expect(image).toHaveAttribute('src', '/learning/http/request-flow.svg');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(screen.getByText('Du client au handler').tagName).toBe('FIGCAPTION');
    expect(
      screen.getByRole('region', {
        name: 'Trajet de la requête',
      }),
    ).toHaveAttribute('tabindex', '0');
  });

  it('rend un tableau pédagogique avec des en-têtes accessibles', () => {
    render(
      <SafeMarkdown
        content={[
          '| Observation | Interprétation |',
          '| --- | --- |',
          '| 404 | Route absente |',
          '| 200 | Handler exécuté |',
        ].join('\n')}
      />,
    );

    expect(
      screen.getByRole('region', {
        name: 'Observation, Interprétation',
      }),
    ).toHaveAttribute('tabindex', '0');
    expect(
      screen.getByRole('columnheader', { name: 'Observation' }),
    ).toHaveAttribute('scope', 'col');
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('bloque les images distantes, actives et les traversées de chemin encodées', () => {
    const { container } = render(
      <SafeMarkdown
        content={[
          '![Externe](https://example.com/image.png)',
          '![Active](data:image/png;base64,AAAA)',
          '![Traversal](/learning/%252e%252e/private.svg)',
          '![Backslash](/learning/%255c%255cevil.test/pixel.png)',
          '![Control](/learning/%2500pixel.png)',
        ].join('\n')}
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Externe')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Traversal')).toBeInTheDocument();
    expect(screen.getByText('Backslash')).toBeInTheDocument();
    expect(screen.getByText('Control')).toBeInTheDocument();
  });
});
