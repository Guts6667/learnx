# V4-003E-Q1-R1 — Remédiation hors ligne Gemini 3.6

- **Statut** : `FROZEN_HARD_OFF_AWAITING_FINANCE_AND_OWNER_GO`
- **Date** : 22 août 2026
- **Portée** : diagnostic différentiel, durcissement transport, gel R1 et
  préflight fake-only
- **Réseau fournisseur / appel modèle / dépense** : `0 / 0 / 0 USD`

## Verdict

La remédiation hors ligne est terminée. Une nouvelle identité Gemini 3.6 est
gelée, mais elle ne dispose d'aucun arbitrage Finance ni d'aucune autorisation
réseau. Le runtime produit demeure `HARD_OFF`/fake-only et la simple présence
d'une clé ne peut pas activer le live.

Le gate Q1 historique reste clos après son unique HTTP 400. Son autorisation est
consommée et sa réserve de `0,1208415 USD` reste
`RECONCILIATION_REQUIRED`; ni zéro ni coût réel n'ont été inventés.

## Identité R1 gelée

| Élément | Valeur |
| --- | --- |
| Commit public de code | `07d5d80978ac1346a78a46e41e6a589439fa564d` |
| Arbre Git | `b437ad2ef6741c8b57571d1dd0afa7c25c604d43` |
| Empreinte identité | `00cd27d8fb78682e155595dc17d65b8168edbb7a1b938f2777f56f3d171445d0` |
| Empreinte implémentation candidate | `4e5e196c40fbf85be94d2ecc167b5751207eda568e4d19bf0d28578029946f6e` |
| Modèle / snapshot | `google/gemini-3.6-flash` / `google/gemini-3.6-flash-20260721` |
| Route | `google-vertex/global`, fallback interdit |
| Raisonnement | `minimal`, température omise, limite totale `2500` |
| Dialecte wire | `evidence-assist-wire/3.0.1` |
| SHA-256 schéma wire | `05719294eed15139abd0039c0f1e91a25489535c882968836fe3ece25b2fdb13` |

Le manifeste d'implémentation lie les octets du runtime, de la persistance
Prisma, du contrôle-plan, des outils différentiels et des dépendances. Le CLI
recalcule ces empreintes et relit les fichiers courants avant toute clé,
création de répertoire ou initialisation fournisseur.

Le bloc `runnerContract` conserve byte-identique le contrat comportemental Q1,
y compris son ancien champ `SPECIFIED_NOT_EXECUTABLE`, afin de ne pas modifier
une seconde variable expérimentale. Ce champ historique n'est pas le statut
courant de l'implémentation R1 : celle-ci est attestée séparément par
`implementationBinding` et son empreinte candidate. Cette implémentation reste
néanmoins inexécutable en live sans les deux artefacts futurs gouvernés.

## Rapport différentiel hors ligne

Le comparateur reproduit le dernier smoke Gemini accepté depuis ses sources
figées, puis construit le corps R1 avec le même code de transport que le runner.

Résultat :

- dix invariants conservés : modèle wire, snapshot, route, fournisseur,
  raisonnement, limite de sortie, température omise, type et mode strict de
  sortie structurée, fallback désactivé ;
- trois différences attendues et observées : messages/frontière de confiance,
  protocole Evidence Assist 3.0, schéma `findings/relation/spanIds` ;
- `pattern` absent du schéma wire, regex stricte conservée côté serveur ;
- zéro écriture, zéro appel réseau et zéro appel modèle ;
- empreinte du rapport :
  `e75bcad45b871775862f1d00b748407fa991fdbb905dea687c1ed6b39a021232`.

Ce résultat confirme que la variable payload est isolée. Il ne prouve pas que
`pattern` était la cause du HTTP 400 : cette cause reste une hypothèse jusqu'à
un éventuel canari réseau dûment autorisé.

## Préflight fake-only

L'artefact
`writing-framework-selection-gemini-3-6-r1-runner-preflight.v1.json`
atteste :

- `4/4` workflows utilisables dans l'ordre positif, réfutation, mutation,
  injection ;
- quatre exécutions du fake provider ;
- zéro exécution fournisseur au replay ;
- zéro appel modèle et réseau interdit ;
- manifeste de requête avant `CALL_INTENT` et raw persisté avant validation ;
- regex locale, allowlist récursive Gemini et omission wire de `pattern`
  vérifiées ;
- empreinte préflight :
  `4672b01fc8828e45d32ad35101303f10e53de3c8214d3ea3645bd05b8b6c6c7b`.

Le candidat ne propose que des relations sur des `spanIds` serveur.
Validation, statut atomique, certificat, feedback, score, maîtrise et progression
restent exclusivement déterministes côté serveur.

## Finance et autorisation

Le draft Finance R1 calcule :

- `0,06039225 USD` maximum par appel ;
- `0,241569 USD` maximum calculé pour quatre appels ;
- cap fournisseur dur `0,50 USD` ;
- zéro retry, zéro fallback et arrêt au premier défaut.

Ce draft n'est pas arbitré et n'autorise rien. Les chemins futurs sont figés
mais les fichiers sont volontairement absents :

- `writing-framework-selection-gemini-3-6-r1-finance-arbitration.v1.json` ;
- `writing-framework-selection-gemini-3-6-r1-network-authorization.v1.json`.

Q1 est rejeté comme `CLOSED_NO_REPLAY`. R1 est rejeté comme
`NETWORK_AUTHORIZATION_NOT_GRANTED` avant token, clé, système de fichiers ou
provider tant que ces artefacts exacts ne sont pas créés et liés au dossier, au
préflight, à la Finance et au commit public.

## Prochaine décision autorisée

1. Reprendre la réconciliation Q1 à partir du 23 août 2026 UTC.
2. Obtenir séparément l'arbitrage Finance R1, sans réutiliser le budget Q1.
3. Obtenir un nouveau GO propriétaire single-use liant l'identité
   `00cd27d8…`, quatre appels maximum et le cap `0,50 USD`.
4. Exécuter alors seulement le canari positif, puis les trois autres cas,
   séquentiellement, sans retry ni fallback.

Le panel `10 × 2`, le holdout, la promotion, le raccordement produit live et la
publication pédagogique restent hors de cette preuve et exigent leurs propres
gates.
