/* global DOMException, URL, document, navigator, window */

(function initializeResearchJournal() {
  const language = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const main = document.querySelector('main');
  const labels = {
    all: language === 'en' ? 'All' : 'Toutes',
    changelog:
      language === 'en' ? 'Changelog and errata' : 'Changelog et errata',
    decision: language === 'en' ? 'Decision' : 'Décision',
    empty:
      language === 'en'
        ? 'No publication matches this filter.'
        : 'Aucune publication ne correspond à ce filtre.',
    erratum: language === 'en' ? 'Erratum' : 'Erratum',
    experimental:
      language === 'en' ? 'Experimental research' : 'Recherche expérimentale',
    exploration: language === 'en' ? 'Exploration' : 'Exploration',
    noErratum:
      language === 'en'
        ? 'No erratum has been published for this version.'
        : 'Aucun erratum publié pour cette version.',
    protocol: language === 'en' ? 'Protocol' : 'Protocole',
    result: language === 'en' ? 'Result' : 'Résultat',
    share: language === 'en' ? 'Share' : 'Partager',
    shareLabel:
      language === 'en' ? 'Share this research' : 'Partager cette recherche',
    toc: language === 'en' ? 'Contents' : 'Sommaire',
    version: 'Version 1.0',
    versionNavigation:
      language === 'en' ? 'Publication version' : 'Version de la publication',
    versionCurrent:
      language === 'en'
        ? 'Current version · v1.0'
        : 'Version actuelle · v1.0',
  };
  const publications = {
    'benchmark-initial': {
      filters: ['result'],
      scope: 'Correction formative · fr-FR',
    },
    'complete-report': {
      filters: ['exploration'],
      scope: 'Correction formative · fr-FR',
    },
    'composite-pipeline': {
      filters: ['exploration'],
      scope: 'Correction formative · fr-FR',
    },
    'current-state': {
      filters: ['exploration'],
      scope: 'Correction formative · fr-FR',
    },
    'executable-rubric': {
      filters: ['protocol'],
      scope: 'Correction formative · fr-FR',
    },
    'gates-and-holdout': {
      filters: ['result'],
      scope: 'Correction formative · fr-FR',
    },
    'writing-exam-bounded-pilot': {
      filters: ['result', 'decision'],
      scope: 'Writing · fr-FR',
    },
  };

  function publicationSlug(value) {
    const pathname = new URL(value, window.location.href).pathname;
    return (
      pathname
        .split('/')
        .filter(Boolean)
        .at(-1)
        ?.replace(/\.en\.html$|\.html$/, '') ?? ''
    );
  }

  function typeLabel(filter) {
    return labels[filter] ?? filter;
  }

  const brand = document.querySelector('.brand');
  const brandText = brand
    ? Array.from(brand.childNodes).find((node) => node.nodeType === 3)
    : undefined;
  if (brand && brandText?.textContent?.trim()) {
    const brandLabel = document.createElement('span');
    brandLabel.className = 'brand-label';
    brandLabel.textContent = brandText.textContent.trim();
    brandText.replaceWith(brandLabel);
  }

  if (main && !main.id) main.id = 'main-content';
  if (main && !document.querySelector('.public-skip-link')) {
    const skipLink = document.createElement('a');
    skipLink.className = 'public-skip-link';
    skipLink.href = '#main-content';
    skipLink.textContent = language === 'en' ? 'Skip to content' : 'Aller au contenu';
    document.body.prepend(skipLink);
  }

  const timeline = document.querySelector('.timeline');
  const cards = timeline ? Array.from(timeline.querySelectorAll('.article-card')) : [];
  if (timeline && cards.length > 0) {
    timeline.id = 'research-publications';
    for (const card of cards) {
      const publication = publications[publicationSlug(card.href)];
      if (!publication) continue;
      card.dataset.filters = publication.filters.join(' ');
      const time = card.querySelector('time');
      if (time && !card.querySelector('.article-card-meta')) {
        const meta = document.createElement('div');
        meta.className = 'article-card-meta';
        time.replaceWith(meta);
        meta.append(time);
        const type = document.createElement('span');
        type.textContent = publication.filters.map(typeLabel).join(' · ');
        const version = document.createElement('span');
        version.textContent = 'v1.0';
        meta.append(type, version);
      }
      const read = card.querySelector('.read');
      if (read) {
        read.textContent = '→';
        read.setAttribute('aria-hidden', 'true');
      }
    }

    const filters = document.createElement('div');
    filters.className = 'journal-filters';
    filters.setAttribute(
      'aria-label',
      language === 'en' ? 'Filter publications' : 'Filtrer les publications',
    );
    const availableFilters = [
      ['all', labels.all],
      ['exploration', labels.exploration],
      ['protocol', labels.protocol],
      ['result', labels.result],
      ['decision', labels.decision],
      ['erratum', labels.erratum],
    ];
    const empty = document.createElement('p');
    empty.className = 'journal-filter-empty';
    empty.hidden = true;
    empty.textContent = labels.empty;
    for (const [value, label] of availableFilters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.filter = value;
      button.setAttribute('aria-controls', timeline.id);
      button.setAttribute('aria-pressed', String(value === 'all'));
      button.textContent = label;
      button.addEventListener('click', () => {
        for (const candidate of filters.querySelectorAll('button')) {
          candidate.setAttribute('aria-pressed', String(candidate === button));
        }
        let visible = 0;
        for (const card of cards) {
          const matches =
            value === 'all' || card.dataset.filters?.split(' ').includes(value);
          card.hidden = !matches;
          if (matches) visible += 1;
        }
        empty.hidden = visible !== 0;
      });
      filters.append(button);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = language === 'en' ? 'Clear filter' : 'Effacer le filtre';
    reset.addEventListener('click', () => {
      filters.querySelector('[data-filter="all"]')?.click();
    });
    empty.append(' ', reset);
    const year = document.createElement('p');
    year.className = 'journal-year';
    year.textContent = '2026';
    timeline.before(filters, empty, year);
  }

  const articleBody = document.querySelector('.article-body');
  const prose = articleBody?.querySelector('.prose');
  const articleNavigation = articleBody?.querySelector('.article-nav');
  const articleHead = document.querySelector('.article-head');
  const articleMeta = articleHead?.querySelector('.article-meta');
  const articlePublication = publications[publicationSlug(window.location.href)];

  if (prose && !prose.querySelector('.article-errata')) {
    const errata = document.createElement('section');
    errata.className = 'article-errata';
    const title = document.createElement('h2');
    title.textContent = labels.changelog;
    const copy = document.createElement('p');
    copy.textContent = labels.noErratum;
    errata.append(title, copy);
    prose.append(errata);
  }

  if (articleMeta && articlePublication) {
    const type = document.createElement('span');
    type.className = 'article-type';
    type.textContent = articlePublication.filters.map(typeLabel).join(' · ');
    const version = document.createElement('span');
    version.className = 'article-version';
    version.textContent = labels.version;
    const experimental = document.createElement('span');
    experimental.className = 'article-experimental';
    experimental.textContent = labels.experimental;
    articleMeta.prepend(type, version, experimental);
    if (
      !Array.from(articleMeta.children).some((node) =>
        node.textContent?.includes('fr-FR'),
      )
    ) {
      const scope = document.createElement('span');
      scope.textContent = articlePublication.scope;
      articleMeta.append(scope);
    }
  }

  function createShareControl() {
    const wrapper = document.createElement('div');
    wrapper.className = 'share-control';
    const button = document.createElement('button');
    button.className = 'share-action';
    button.type = 'button';
    button.setAttribute('aria-label', labels.shareLabel);
    button.innerHTML =
      '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"></path></svg><span>' +
      labels.share +
      '</span>';
    const status = document.createElement('span');
    status.className = 'share-status';
    status.setAttribute('aria-live', 'polite');
    const canonical =
      document.querySelector('link[rel="canonical"]')?.href ?? window.location.href;
    button.addEventListener('click', async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url: canonical });
          return;
        }
        await navigator.clipboard.writeText(canonical);
        status.textContent = language === 'en' ? 'Link copied.' : 'Lien copié.';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        status.textContent =
          language === 'en'
            ? 'Copy this page address from your browser.'
            : 'Copiez l’adresse de cette page depuis votre navigateur.';
      }
    });
    wrapper.append(button, status);
    return wrapper;
  }

  if (articleHead && articleMeta && !articleHead.querySelector('.article-actions')) {
    const actions = document.createElement('div');
    actions.className = 'article-actions';
    articleMeta.replaceWith(actions);
    actions.append(articleMeta, createShareControl());
  }

  const headings = prose ? Array.from(prose.querySelectorAll('h2')) : [];
  if (
    articleBody &&
    articleNavigation &&
    headings.length > 1 &&
    !articleBody.querySelector('.article-support')
  ) {
    const support = document.createElement('div');
    support.className = 'article-support';
    const links = headings.map((heading, index) => {
      if (!heading.id) heading.id = `research-section-${index + 1}`;
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      return link;
    });
    const desktopToc = document.createElement('nav');
    desktopToc.className = 'article-toc article-toc--desktop';
    desktopToc.setAttribute('aria-label', labels.toc);
    const desktopTitle = document.createElement('strong');
    desktopTitle.textContent = labels.toc;
    const desktopList = document.createElement('ol');
    for (const link of links) {
      const item = document.createElement('li');
      item.append(link.cloneNode(true));
      desktopList.append(item);
    }
    desktopToc.append(desktopTitle, desktopList);

    const mobileToc = document.createElement('details');
    mobileToc.className = 'article-toc article-toc--mobile';
    const summary = document.createElement('summary');
    summary.textContent = labels.toc;
    const mobileNavigation = document.createElement('nav');
    mobileNavigation.setAttribute('aria-label', labels.toc);
    const mobileList = desktopList.cloneNode(true);
    mobileNavigation.append(mobileList);
    mobileToc.append(summary, mobileNavigation);

    const versionNavigation = document.createElement('nav');
    versionNavigation.className = 'article-version-nav';
    versionNavigation.setAttribute('aria-label', labels.versionNavigation);
    const versionTitle = document.createElement('strong');
    versionTitle.textContent = labels.versionNavigation;
    const versionCurrent = document.createElement('span');
    versionCurrent.textContent = labels.versionCurrent;
    versionNavigation.append(versionTitle, versionCurrent);

    articleBody.insertBefore(mobileToc, prose);
    articleBody.insertBefore(support, articleNavigation);
    support.append(desktopToc, versionNavigation, articleNavigation);
  }
})();
