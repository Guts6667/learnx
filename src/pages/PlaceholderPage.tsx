interface PlaceholderPageProps {
  default?: boolean;
  description?: string;
  path?: string;
  title: string;
}

const defaultDescription =
  'Cette page est prête à accueillir sa fonctionnalité dans un prochain ticket.';

export function PlaceholderPage({
  description = defaultDescription,
  title,
}: PlaceholderPageProps) {
  return (
    <section aria-labelledby="page-title">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
        LearnX
      </p>
      <h1 id="page-title" class="mt-3 text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p class="mt-4 max-w-prose text-base leading-7 text-slate-300">
        {description}
      </p>
    </section>
  );
}

interface NotFoundPageProps {
  default?: boolean;
  path?: string;
}

export function NotFoundPage(routeProps: NotFoundPageProps) {
  void routeProps;

  return (
    <section aria-labelledby="page-title">
      <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
        Erreur 404
      </p>
      <h1 id="page-title" class="mt-3 text-3xl font-bold tracking-tight">
        Page introuvable
      </h1>
      <p class="mt-4 text-base leading-7 text-slate-300">
        L’adresse demandée ne correspond à aucune page LearnX.
      </p>
      <a
        class="mt-6 inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        href="/today"
      >
        Retour à Aujourd’hui
      </a>
    </section>
  );
}
