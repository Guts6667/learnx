/* global DOMException, document, navigator, window */

(function initializeResearchJournal() {
  const language = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const main = document.querySelector('main');

  if (main && !main.id) main.id = 'main-content';
  if (main && !document.querySelector('.public-skip-link')) {
    const skipLink = document.createElement('a');
    skipLink.className = 'public-skip-link';
    skipLink.href = '#main-content';
    skipLink.textContent = language === 'en' ? 'Skip to content' : 'Aller au contenu';
    document.body.prepend(skipLink);
  }

  const articleBody = document.querySelector('.article-body');
  const prose = articleBody?.querySelector('.prose');
  const articleNavigation = articleBody?.querySelector('.article-nav');
  const headings = prose ? Array.from(prose.querySelectorAll('h2')) : [];

  if (
    articleBody &&
    articleNavigation &&
    headings.length > 1 &&
    !articleBody.querySelector('.article-support')
  ) {
    const support = document.createElement('div');
    support.className = 'article-support';
    const tocLabel = language === 'en' ? 'Contents' : 'Sommaire';
    const links = headings.map((heading, index) => {
      if (!heading.id) heading.id = `research-section-${index + 1}`;
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      return link;
    });

    const desktopToc = document.createElement('nav');
    desktopToc.className = 'article-toc article-toc--desktop';
    desktopToc.setAttribute('aria-label', tocLabel);
    const desktopTitle = document.createElement('strong');
    desktopTitle.textContent = tocLabel;
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
    summary.textContent = tocLabel;
    const mobileNavigation = document.createElement('nav');
    mobileNavigation.setAttribute('aria-label', tocLabel);
    const mobileList = document.createElement('ol');
    for (const link of links) {
      const item = document.createElement('li');
      item.append(link.cloneNode(true));
      mobileList.append(item);
    }
    mobileNavigation.append(mobileList);
    mobileToc.append(summary, mobileNavigation);

    articleBody.insertBefore(mobileToc, prose);
    articleBody.insertBefore(support, articleNavigation);
    support.append(desktopToc, articleNavigation);
  }

  const articleMeta = document.querySelector('.article-head .article-meta');
  if (!articleMeta || articleMeta.querySelector('.share-action')) return;

  const canonical =
    document.querySelector('link[rel="canonical"]')?.href ?? window.location.href;
  const label = language === 'en' ? 'Share this research' : 'Partager cette recherche';
  const buttonLabel = language === 'en' ? 'Share' : 'Partager';
  const copied = language === 'en' ? 'Link copied.' : 'Lien copié.';
  const failed =
    language === 'en'
      ? 'Copy this page address from your browser.'
      : 'Copiez l’adresse de cette page depuis votre navigateur.';

  const button = document.createElement('button');
  button.className = 'share-action';
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.innerHTML =
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"></path></svg><span>' +
    buttonLabel +
    '</span>';

  const status = document.createElement('span');
  status.className = 'share-status';
  status.setAttribute('aria-live', 'polite');

  button.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url: canonical });
        return;
      }
      await navigator.clipboard.writeText(canonical);
      status.textContent = copied;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      status.textContent = failed;
    }
  });

  articleMeta.append(button, status);
})();
