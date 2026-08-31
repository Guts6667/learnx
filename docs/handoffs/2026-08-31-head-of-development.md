# Passation — Head of Development, 31 août 2026

## a. Tâche en cours

**V4.5-212, PR #175** (`feat/v4-5-212-pack-grid`, `f20f3bfc`) : grille des trois
paliers, limite d'un achat sur le palier d'entrée, libellé anglais, chiffres
dérivés servis. Rebasée sur `dev`, porte de qualité verte, poussée. **Rien ne
reste de mon côté** : elle attend une fusion.

**Conflit avant fusion** : #179 (Finance) ramène le plafond de réservation de 45
à 41. Mon test épingle 45 depuis les coûts publiés et
`CORRECTION_RESERVATION_CREDITS` vaut 45 : si #179 passe, les deux suivent —
c'est ce que le test existe pour rendre bruyant.

**Enquête PROTOCOL_3 (#177) : pas commencée**, reçue juste avant la clôture.
Rien à en dire, pas même une hypothèse.

## b. Fusionné aujourd'hui

#137 trace des webhooks, #141 résolution des commandes, #145 compensation des
remboursements, #147 et #152 contrat de l'écran d'achat, #162 transaction unique,
#159 et #165 épinglage des versions de prompt, #156 collecte fermée par défaut,
#169 formulation RGPD, #172 détachement à 180 jours.

## c. Blocages et qui les lève

- **#179 contre #175** — Head of AI arbitre lequel passe en premier.
- **Remboursement et palier d'entrée** — un apprenant remboursé perd
  définitivement le droit d'acheter le pack à 3 €. Rayan doit dire si c'est
  acceptable ; le Head of UX/UI tient deux phrases prêtes.
- **Consentement (168, seconde moitié)** — non écrit. Sans lui le consentement
  est faux partout, donc les textes sont supprimés à 180 jours plutôt que
  conservés : ordre prudent, pas oubli.

## d. Erreurs commises, une ligne chacune

- J'ai décrit la base de production comme une branche périmée sûre à rafraîchir ;
  elle a été vidée. **Lire l'hôte, jamais déduire d'un contenu.**
- J'ai lu le réglage Vercel et supposé qu'il agissait ; quatre de mes branches
  ont consommé des constructions. **Une protection se vérifie en la voyant agir.**
- Mon garde-fou de base refusait la configuration Neon standard et cassait toutes
  les constructions. **Mes propres jeux de test évitaient le cas réel.**
- J'ai fait insérer une ligne de compte par une migration ; la répétition sur
  clone l'a refusée. **Une migration décrit une forme, elle ne peuple pas.**
- J'ai relayé aux autres lanes une décision de Rayan qu'il a corrigée dans la
  minute. **Tenir une annonce le temps d'un message.**

## e. Besoins

- **Décisions de Rayan** : remboursement du palier d'entrée ; rotation Neon par
  un nouveau rôle ; ADR_004 §8 (BIC/BNC, TVA, CGV).
- **Libellés** : « Premier pack / Pack standard / Grand pack » viennent du Head
  of UX/UI, validés par personne d'autre.
- **Aucun accès supplémentaire** : je ne touche jamais une base.

## f. Prochaine étape recommandée, dans l'ordre

1. Trancher #179 contre #175, puis fusionner (~15 min).
2. Faire tourner `pnpm db:target -- --url '<preview>' --yes seed-packs` — **pas
   moi** (~5 min).
3. Enquête PROTOCOL_3 : pourquoi un rendu à deux critères a été noté VALID
   (~1–2 h) — bloque la re-mesure à 6 USD.
4. Consentement de réutilisation, seconde moitié de 168 (~2 h).
5. V4.5-211 : le service de remboursement rejoint la transaction du webhook
   (~2 h, de jour : code d'argent).

## g. À savoir pour le successeur

- **`pnpm install` + `pnpm prisma:generate` avant de déclarer une branche
  cassée.** M'a trompé trois fois ; le client Prisma périmé ment.
- **Images de référence : jamais en local**, elles dépendent du système. Lancer
  le workflow `Visual` avec `update: true`, commiter l'artefact, puis vérifier
  que seuls les écrans attendus ont bougé.
- **`[deploy]` / `[preview]`** dans un message de commit déclenche une
  construction. Le quota est serré : ne pas en mettre sans raison.
- **`db:target` est le seul chemin vers une base**, jamais `.env` — c'est ce qui
  a vidé la production le 30 août. `benchmarks/**` est en ajout seul.
- **Piège de numérotation : le ticket 168 n'est pas la PR #168.**
- **Copies de travail** : une par sujet sous `/private/tmp/learnx-*`, toujours
  depuis `origin/dev` — les branches locales périment vite.
- **Fichiers sensibles** : `promoted-identity.ts` (toute évolution exige une
  promotion), `prisma.config.ts` (garde-fou de base), `route-guards.test.ts`
  (seul point de vue sur l'application assemblée).

## h. Décisions orales de Rayan, écrites nulle part ailleurs

- **Le pack à 3 € ne peut être acheté qu'une fois** — dit, puis annulé, puis
  reconfirmé explicitement le 31 août. La version qui fait foi est la dernière.
- **`LEARNX_PUBLIC_LEADS_ENABLED = true`**, Production et Preview, posé le
  31 août à 01h36 : la collecte tourne désormais par décision, pas par défaut.
