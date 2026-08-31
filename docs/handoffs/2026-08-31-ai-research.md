# Passation — AI Research — 31 août 2026

## a. Tâche en cours
Mesurer si la consigne primaire **2.3.0** corrige le défaut de direction, avant de la
promouvoir dans le runtime. Branche `codex/v4-5-measured-costs-v2`, PR **#177** ouverte
contre `dev`, texte corrigé et poussé (`8ab620a7`). Reste : la mesure sur 245 cellules,
**non recommandée aujourd'hui** (voir c).

## b. Mergé aujourd'hui
- **#163** deux variantes de consigne vérificateur + sonde qui les distingue
- **#165** refuse une consigne vérificateur modifiée sans sa version
- **#167** le vérificateur n'est pas laxiste : il ne calcule pas
- **#168** oracle arithmétique déterministe (calculer au lieu de demander)
- **#170** les indices de suppression tiennent, le correcteur comble les trous
- **#173** politique de gates v6 + brouillon de la consigne 2.3.0

## c. Blocages
**Question ouverte, confiée à Head of Development.** Un mutant a renvoyé **2 critères
sur 3** — en omettant précisément celui que la mutation vise — et le banc l'a enregistré
`VALID`. Or `canonicalizeProtocol3CorrectionOutput` lève déjà
`PROTOCOL_3_CRITERION_MISSING` quand un critère du contrat manque à la sortie. Le
contrôle existe, en amont, et **il n'a pas déclenché**. Je ne sais pas pourquoi.
C'est grave : un critère omis quitte le numérateur *et* le dénominateur des gates, donc
le gate s'améliore quand le modèle se tait. Tant que ce n'est pas compris, pas de mesure
à 6 USD et pas de second garde — traiter le symptôme masquerait la cause. Mon rôle
ensuite est de relire leur conclusion, pas d'en produire une troisième.

## d. Erreurs et leçons
- Lu 3,79 USD de dépense là où il n'y avait aucun appel → comparer octet à octet avant d'annoncer un coût.
- `git stash -u` sur le worktree d'un run payant a détruit ses artefacts → **jamais de git destructif sur un worktree où tourne un run** (récupéré via `git fsck --unreachable`).
- Un test de remplacement passait sans le correctif → vérifier qu'un test échoue quand on casse le code qu'il couvre.
- Annoncé `dev` cassé deux fois, c'était mon worktree périmé → `pnpm install` + `pnpm prisma:generate` avant d'accuser une branche partagée.
- Prédit un résultat de gate par arithmétique budgétaire → mesuré 7/47, faux.
- Classé quatre indices en défauts d'écriture pour minorer un taux → relecture : ils étaient sains, retiré.
- Présenté une hypothèse (« le banc ne contrôle pas la complétude ») comme un constat → retirée dans `8ab620a7`.

## e. Besoins
**Enveloppe.** Plafond oral de Rayan : **4 USD**. Dépensé aujourd'hui **0,6540 USD**
(sondes A/B 0,019444 + sonde D 0,015167 + pré-test 0,619437). **Reste 3,3460 USD.**
Le plan à 245 cellules est borné à **17,1272 USD** (convention `measured-p90-v2`,
sécurité ×1,5), réel attendu ≈ **6,21 USD**, ≈ 92 min. **Les deux dépassent le reste
d'enveloppe** : cette mesure demande une décision explicite du propriétaire, pas
seulement le déblocage technique du point c.

**41 vs 45 crédits (réservation).** Méthode Finance retenue, reproduite au chiffre près
depuis le registre : rapport p90/p50 des coûts par correction × devis de 30 crédits.
Sur les **240** cellules → p50 0,021801, p90 0,029748, rapport 1,3645 → **41**. Sur les
**231** ayant réellement livré → 1,2195 → **37**. Le 45 initial n'était reproductible
sous aucune définition et Finance l'a retiré. **Gelé à 41.** À dire tel quel : la
doctrine produit 37, 41 est 37 plus une marge délibérée de 4 crédits — la prudence est
du côté de LearnX, le coût du côté de l'apprenant. Signalé à Rayan, c'est son arbitrage.
`measured-costs.v2` est encore dans #177 non mergée : ne pas le citer comme source
unique avant le merge.

## f. Prochaine étape recommandée
1. Merger **#177** (docs + `measured-costs.v2`) — 0 USD.
2. Attendre la conclusion de Head of Development sur `PROTOCOL_3_CRITERION_MISSING`, la relire — 0 USD.
3. Ajouter un oracle de critères omis, d'abord *rapporté*, puis bloquant à zéro livré en politique v6.1 — 0 USD.
4. Seulement ensuite proposer les 245 cellules à Rayan — ≈ 6,21 USD réels, borne 17,13, ≈ 92 min.

## g. À savoir pour ton successeur
- Worktree de la voie : `/Users/rayanchambet/Desktop/Workflow/learnx-v45-120`. `OPENROUTER_API_KEY` est dans son `.env` — exporter la seule variable, ne jamais sourcer le fichier, ne jamais l'afficher.
- Un run payant prend un **run-lock** ; reprendre avec `--resume` (la dépense réelle déjà faite est réinjectée dans le plafond, cf. #135).
- `benchmarks/**` est **append-only** : nouveaux fichiers seulement, jamais de réécriture.
- Pas de `[deploy]` dans un sujet de merge sauf build voulu.
- Une commande lancée avec `!` est tuée à 2 min → lancer les runs en `nohup`, suivre avec `tail -f`.
- Après resync : `pnpm install --frozen-lockfile` puis `pnpm prisma:generate`.
- Politique de gates active : **v6** (`gate-policy.v6.json`). Elle déclare `minimumDenominator` : un gate sans échantillon suffisant est une erreur de politique, pas un succès.
- Sonde de faux accord : `false-agree-probe.v1.json`, 20 cas. Consignes vérificateur **A** (= runtime, épinglée octet à octet), **B** (adversariale), **D** (adversariale + recalcul explicite, idée de Rayan). Faux accords : A 3/20, B 2/20, **D 1/20**.
- Oracle arithmétique déterministe (`ai-correction-quoted-arithmetic.ts`) : il couvre les expressions en chiffres, D couvre l'arithmétique en toutes lettres. **Complémentaires, garder les deux.**
- Le pool est gelé par son premier run payant : changer le pool rebat le sous-ensemble de 24 cas.

## h. Décisions orales de Rayan
- Plafond de dépense **4 USD**, sans exception.
- Consigne **D** à écrire et à sonder (son idée : contester les hypothèses, surtout arithmétiques).
- Pré-test bon marché avant toute mesure complète.
- Mesurer avant de promouvoir 2.3.0 : pas de promotion sur intuition.
