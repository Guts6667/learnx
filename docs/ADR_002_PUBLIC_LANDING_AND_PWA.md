# ADR-002 — Landing publique et entrée PWA

**Statut : accepté — V3.5-005**

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
