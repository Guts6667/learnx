# V4-009B — Registre de consultation

Date d'ouverture : 2026-08-13
Statut global : `MINI_PANEL_NO_GO`

## Produit & pédagogie

- Statut : `ARBITRATED`
- Date : 2026-08-13
- Périmètre transmis : protocole du panel, identité composite, déclenchement
  serveur, consolidation, revue aveugle et gates de promotion.
- Réponse reçue : panel de six cas de développement, deux répétitions, identité
  immuable, vérificateur isolé de la sortie primaire, aucune moyenne ni vote,
  pause obligatoire avant toute dépense et revue réellement aveugle.
- Décisions retenues :
  - douze cellules exactes, sans holdout ;
  - `UNCERTAIN` sur désaccord matériel, sans score exact ;
  - sécurité injection à 100 %, preuve inventée à 0 %, aucun résultat
    inutilisable visible ou débité ;
  - toute mutation de modèle, route, prompt ou règle change l'identité et
    recommence le mini-panel.
- Arbitrage reçu : identité `learnx-fr-text-mistral-sonnet-targeted-v1@1.0.0`,
  déclencheur serveur `1.0.0`, consolidateur `1.0.0` et désaccord matériel
  définis dans le manifeste gelé.
- Panel : six cas autoritaires × deux répétitions ; deux contrôles préenregistrés
  (`writing-successful:1` et `practice-erroneous:1`).
- Inconnues restantes : aucune pour l'enveloppe hors ligne ; les taux futurs de
  contrôle restent volontairement non calibrés.
- Arbitrage propriétaire requis : `YES` uniquement avant appel facturable.

## Finance & Pricing

- Statut : `ARBITRATED`
- Date : 2026-08-13
- Périmètre transmis : coût complet du workflow, plafond de campagne, retries,
  arrêt et instrumentation.
- Réponse reçue : plafond de benchmark proposé à `0.75 USD` de `usage.cost`,
  attente sans retry inférieure ou égale à `0.35 USD`, maximum de 48 requêtes
  avec un retry technique par rôle et par cellule.
- Décisions retenues :
  - enveloppe interne en USD fournisseur uniquement ;
  - arrêt avant l'appel suivant si son pire cas borné dépasse le plafond ;
  - retries, INVALID, timeout et résultats inutilisables absorbés ;
  - prix, crédits, parité et catalogue restent `DRAFT/INACTIVE`.
- Arbitrage reçu : plafond dur `0.75 USD`, attente sans retry `<= 0.35 USD`,
  48 tentatives maximum et un retry transitoire allowlisté par rôle/cellule.
- Arbitrage conditionnel du full : `1.10–1.30 USD` attendus, plafond dur
  `2.00 USD` et 180 tentatives agrégées, seulement après GO écrit du mini-panel
  puis autorisation propriétaire distincte ; les 12 cellules sont réutilisées.
- Le préflight inclut coût réel, réserves en vol et pire coût du prochain appel.
- Inconnues restantes : solde fournisseur disponible au moment du lancement.
- Arbitrage propriétaire requis : `YES` avant appel facturable.

## Développement

- Statut : `ARBITRATED_OFFLINE`
- Date : 2026-08-13
- Périmètre : répétition V4-009 sur Neon jetable, instrumentation,
  reproductibilité, providers déterministes, reprise et idempotence.
- Preuve : le run Integration #116 a créé puis supprimé la branche Neon
  `ci-31650478455-1` et appliqué les migrations sans toucher une base partagée.
- Écart constaté : la comparaison a rejeté
  `20260812170000_add_ai_pricing_catalog`, dont le fichier local a été modifié
  après son application. Le checksum appliqué correspond à la version initiale.
- Arbitrage propriétaire reçu : restauration exacte au checksum appliqué
  `4156ce…`, puis migration additive et idempotente séparée. Le fichier
  historique et la nouvelle migration sont couverts par un test de régression ;
  la répétition Neon #117 a ensuite validé le clone, l'application des
  migrations, la comparaison avant/après et le rejeu complet de l'historique.
- Preuve complémentaire : le test réel du ledger V4-009 est vert sur la branche
  jetable `ci-31710711187-1` (`br-soft-pine-asgdknih`), supprimée en fin de job.
- Le correctif `be9131a` borne les middlewares d'authentification et
  d'autorisation au seul endpoint pricing. La répétition Integration #119
  (`31713310879`) est entièrement verte : les `403` hors pricing ont disparu.
- Le runner composite est désormais relié au protocole `3.0.1` et aux profils
  gelés. Il vérifie les SHA, bloque sans GO propriétaire, préautorise chaque
  coût, persiste un ledger append-only, reprend sans doublon et sépare paquet
  aveugle/mapping. Aucun appel réseau n'a été effectué pendant cette validation.

## Gate de clôture

- [x] Consultations Produit et Finance reçues.
- [x] Aucun appel modèle facturable lancé.
- [x] Migration historique réparée avec autorisation explicite.
- [x] Répétition Neon V4-009 verte (migration, replay, règlement, libération).
- [x] Suite Integration globale verte (run #119).
- [x] Identité composite finale arbitrée et gelée.
- [x] Enveloppe Finance du mini-panel arbitrée.
- [x] Autorisation explicite de Rayan reçue avant tout appel facturable.
- [x] Mini-panel exécuté dans l'enveloppe Finance (`0,2018835 / 0,75 USD`).
- [x] Revue pédagogique aveugle en deux phases reçue.
- [x] Verdict `NO-GO` figé ; aucun `24×3`, holdout ou appel supplémentaire.
