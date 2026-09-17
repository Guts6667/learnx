# Handoff LearnX — reprise du 17 septembre 2026

## Reprise en moins de 15 minutes

1. Lire `AGENTS.md`, puis `docs/INDEX.md`.
2. Lire `docs/AI_CORRECTION_RECOVERY.md` : état daté, révisions, propriétaires,
   limites des preuves et prochaines sorties. C'est l'autorité de reprise.
3. Lire uniquement le lot V4.5-210 de `V4_5_BACKLOG.md`, puis les fichiers
   concernés. V4.1 est clôturée ; V4.3 est parquée.
4. Avant toute modification de frontière, consulter `docs/ARCHITECTURE.md`,
   `docs/DOMAIN_MODEL.md` et `docs/ENGINEERING_CONVENTIONS.md`. React 19 reste
   l'unique runtime UI ; Program > Stage > Module > Lesson reste le domaine.
5. Pour la rubrique étroite et le holdout propriétaire, lire
   `docs/AI_CORRECTION_WRITING_RECOVERY.md`. Pour une release, lire
   `docs/TESTING_AND_RELEASE.md` et la recette de reprise avant toute action.

## État distinct de chaque surface

| Surface | Preuve | Interprétation |
| --- | --- | --- |
| Dernière production enregistrée | `194e57e92c0bd2c2d1d51aeadcc5ba8297217c4a` | Pas de preuve fraîche de flags effectifs ; health public non joignable lors de la reprise |
| `dev` | `7a120bed3ec0b4b966f9566e5174c509d51cea23` | Intégration V4.5, pas une qualification |
| Recherche PR #213 | `17b07a7367aacd8345c50ed6fe530cb886dc4a21` | Résultats négatifs ou non mesurables conservés |
| Reprise | `codex/ai-correction-recovery`, base `e874f943cb3d75469547571d0fbadff236f7eaa4` | Travail isolé, corrections et revue ; gates de release séparés |

Le workspace historique `learnx` sur `74d0b24f` n'est pas la baseline active
pour évaluer la correction. Ses modifications locales restent conservées.
L'ancien handoff V4.1 est accessible dans l'historique Git au SHA de base ;
ses compteurs de tests et son affirmation d'absence de P0/P1 ne décrivent pas
l'audit de septembre.

La reprise est proposée dans [PR #222](https://github.com/Guts6667/learnx/pull/222).
Le SHA d'implémentation `21b6ab4e4c1521abec6e3b3146b94b6ae438853d` passe le
gate local complet (2 479 tests). Voir
[`la preuve QA`](qa/AI_CORRECTION_RECOVERY_2026-09-17.md) ; les résultats CI
font autorité dans la PR et ne constituent pas une qualification scientifique.

## Prochaine preuve, pas prochaine campagne

- R1–R3 : runtime, comptabilité, qualification et gouvernance réparés puis
  relus au SHA immuable ; tests synthétiques et mocks ne valent pas preuve
  sémantique face à un modèle.
- R4 : Rayan approuve la rubrique, fournit/revoit 30 réponses indépendantes
  avec dossiers et 60 mutations, verrouille les niveaux absolus, puis effectue
  un retest aveugle sur dix sources. Une absence d'extraction reste incertaine.
- R5 : zéro niveau affiché incorrect, ≥70 % de critères utilisables, tous les
  gates de sécurité applicables et recette cible. Le pilote reste bloqué avant
  ces preuves et le GO Rayan. Aucun write IA vers maîtrise/progression.

Le board Airtable V4.5-210 a été réconcilié avec cette définition ; l'historique
reste dans `docs/AIRTABLE_SYNC_LOG.md`. Les dépenses de composants ne doivent
pas être présentées comme le cumul de campagne ; 0,62 USD restent à réconcilier.

## Valider et livrer

```bash
pnpm install --offline --frozen-lockfile
pnpm quality:v4.1:final
pnpm test:e2e:production
```

Dans un worktree neuf, générer le client Prisma avant typecheck. Toujours
identifier la cible DB ; `DIRECT_URL` prime sur `DATABASE_URL` dans la config.
Ne pas copier ni sourcer une `.env` de production. Une génération Prisma locale
n'est ni une migration ni un test de base. Aucun reset/seed de production.

Avant push, exécuter la chaîne prescrite par `docs/AGENT_WORKFLOW.md`. Avant
ouverture : SHA réellement déployé, flags effectifs, durée de fonction,
correction authentifiée, interruption, règlement rejoué, monitoring et
rollback sur cible identifiée. Les contrôles qui n'ont pas été exécutés restent
explicitement ouverts, jamais remplacés par un résultat local similaire.

## Exploitation et rollback

La cible de rollback vit dans `docs/RUNBOOK_RESTORE.md` §3. Ce handoff ne la
recopie pas. Un résultat terminé doit rester consultable/réglable malgré
expiration ou arrêt des nouveaux appels ; le prix d'origine reste gelé.

Un coût inconnu reste inconnu : conserver la réservation et demander une
réconciliation. Un verrou de recherche laissé par une interruption ne doit pas
être volé ou réinitialisé automatiquement. La nouvelle enveloppe est partagée
entre worktrees et comptabilise les appels en vol avant dispatch.

Tout futur handoff transmet ticket, branche/worktree, base exacte, SHA,
fichiers, preuves, validations non exécutées, limites, rollback et prochaine
autorité. « Implémenté », « testé », « qualifié » et « déployé » restent quatre
états différents.
