# ADR-002 — Landing publique et entrée PWA

**Statut : accepté — V3.5-006**

## Décision

`https://learn-x.app` reste l'adresse officielle unique. La landing publique est
servie sur `/`, tandis que l'application authentifiée conserve ses routes
existantes. L'installation PWA démarre sur `/today`, qui redirige vers `/login`
en l'absence de session.

Cette frontière par route préserve les cookies `HttpOnly`, `SameSite=Lax` et le
déploiement Vercel existants sans introduire de CORS inter-origines ni modifier
le DNS validé. Un futur domaine marketing séparé nécessitera un nouvel ADR.

## Sécurité, cache et observabilité

- La landing n'appelle aucune API privée et ne rend ni shell ni navigation app.
- Toutes les réponses API restent `private, no-store`; le service worker ne
  précache que les ressources statiques et exclut `/api/`.
- La CSP et les en-têtes globaux restent définis dans `vercel.json`.
- Aucun outil analytics n'est activé dans cette livraison. Toute mesure future
  devra être bornée, documentée et compatible avec le consentement.
- Les contacts publics utilisent une table, des jetons et des finalités
  distincts des demandes d'accès, invitations, comptes et sessions.

## Environnements et DNS

- Production : `learn-x.app`, apex pointé vers Vercel, HTTPS obligatoire.
- Preview : URL Vercel isolée, mêmes routes, base Preview dédiée.
- Local : `localhost`, sans changement DNS.
- `APP_URL` doit correspondre à l'origine de l'environnement pour produire les
  liens e-mail. `RESEND_API_KEY`, `LEARNX_EMAIL_FROM` et
  `LEARNX_PUBLIC_LEADS_ENABLED` configurent la collecte.

## Déploiement et rollback

La migration `public_leads` est additive. Le rollback fonctionnel consiste à
mettre `LEARNX_PUBLIC_LEADS_ENABLED=false` et à restaurer l'ancienne route `/`
et les anciens manifests. La table est conservée pendant le rollback afin de ne
pas supprimer silencieusement des consentements ou demandes de suppression.
La migration ne doit être promue qu'après répétition sur clone Neon.

## Liens publics et transition de domaine

Les routes `/login`, `/request-access`, `/verify-email`, `/activate` et
`/interest` utilisent une stratégie réseau prioritaire lorsqu'une connexion est
disponible. Le service worker s'actualise automatiquement : un ancien shell ne
doit pas masquer une route publique ajoutée plus tard. Les API et leurs réponses
restent exclues de tout cache.

Les jetons de vérification et d'activation restent dans le fragment `#token=`.
Ce fragment n'est transmis ni au serveur, ni aux logs, ni au cache. Toute
redirection de domaine doit conserver chemin, requête et fragment côté navigateur.

Pendant un changement de domaine :

1. configurer une redirection temporaire (307) ;
2. tester les liens profonds avec cache froid et chaud sur Chromium et WebKit ;
3. contrôler l'origine finale et la conservation du fragment ;
4. seulement alors promouvoir la redirection permanente (308).

Pour un navigateur déjà affecté par un ancien 308 ou worker : fermer les onglets
LearnX, supprimer les données du site `learn-x.app`, puis rouvrir le lien original.
Le rollback doit publier une nouvelle version de worker qui purge les caches
incompatibles ; redéployer uniquement un ancien bundle ne suffit pas.
