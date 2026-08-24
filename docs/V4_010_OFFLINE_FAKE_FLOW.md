# V4-010 — parcours de correction formative hors ligne

> **Historique uniquement depuis le 24 août 2026.** Ce faux flow a été retiré
> du chemin d'exécution V4. Il ne doit être ni réactivé, ni raccordé à
> l'interface, ni utilisé comme substitut du runtime borné défini dans
> `BACKLOG_V4.md` et `src/server/corrections/promoted-identity.ts`.

## Statut

Ce parcours est un **prototype technique non publiable**. Il est désactivé par
défaut, ne peut pas être activé en production et n'appelle aucun fournisseur de
modèle. Il n'ouvre aucune activité à la correction réelle.

## Périmètre vérifié

Le prototype relie, derrière un flag local, les étapes suivantes :

1. lecture d'une remise textuelle déjà soumise ;
2. présentation d'un devis et d'une réservation simulés, sans montant ;
3. recherche déterministe de relations candidates par un faux fournisseur ;
4. validation côté serveur des extraits exacts et production d'un certificat ;
5. restitution de messages exclusivement issus des templates authorés du
   contrat pilote `DRAFT / EVIDENCE_ASSIST_ONLY`.

Le contrat, le faux fournisseur et l'orchestrateur ne produisent aucun score,
niveau, PASS/FAIL, effet de progression ou feedback libre. Une révision n'est
demandée que lorsqu'un constat mécanique la justifie. Les autres issues
publiques sont `FEEDBACK_READY`, `CLARIFICATION_REQUIRED` et
`TEMPORARILY_UNAVAILABLE`.

## Garde-fous

- `LEARNX_V4_010_FAKE_FLOW=true` n'est pris en compte que hors production ;
- aucun appel réseau fournisseur et aucun secret ne sont utilisés ;
- aucun `CreditReservation` ni débit n'est créé ;
- les plafonds et coûts simulés restent à `null` : aucun prix fictif ;
- une réponse identique restitue le résultat existant ;
- une réponse modifiée crée une version immuable supplémentaire ;
- les clés d'idempotence empêchent le double traitement ;
- un retry technique simulé ne produit aucun débit ;
- les résultats sont limités au propriétaire de la remise ;
- l'historique survit au rechargement via la persistance `AiCorrection`
  existante, sans migration de schéma ;
- aucune écriture de progression ou de maîtrise n'est effectuée.

## Preuves attendues

Les tests unitaires et d'intégration couvrent les états, permissions,
idempotence, versions, retry et absence d'autorité pédagogique ou financière.
Le scénario navigateur couvre le parcours visible, le double clic, l'absence
de vocabulaire de tokens ou de score, les largeurs 320, 390 et 1440 px, ainsi
que les violations d'accessibilité sérieuses ou critiques.

## Limites avant toute suite

Ce prototype ne valide ni un modèle, ni un pipeline, ni une rubrique
publiable. Il ne démontre pas non plus la facturation, le comportement sous
charge ou l'éligibilité d'une activité. Tout passage au live exige séparément
un contrat `PUBLISHED / FULLY_COMPILABLE`, les gates autonomes, un pipeline
promu, une politique financière active et une décision explicite de rollout.
