# V4-009B — Audit hors ligne

## Baseline

- Base Git : `origin/dev` au commit `8d663db`.
- V4-008A : `fc21d47`.
- V4-009 : `8d663db`.
- Catalogue et pipeline composite : inactifs ; aucun appel public possible.

## Répétition Neon

Le workflow Integration #116 (`31650478455`) a utilisé une branche Neon
éphémère, appliqué les migrations puis supprimé la branche. La comparaison a
échoué avant le replay fonctionnel :

```text
20260812170000_add_ai_pricing_catalog:
local migration is absent or has another checksum in the clone
```

Diagnostic : le commit `c0c39fd` a modifié une migration créée par `ed06e63`
après son application. Le correctif attendu est une restauration du fichier
historique et une nouvelle migration additive ; aucun checksum ne sera toléré
ou réécrit dans `_prisma_migrations`.

## Contradictions et bloqueurs

1. Les règles exactes de déclenchement et de désaccord matériel ont été
   arbitrées par Produit/pédagogie et figées en version `1.0.0`.
2. Les identités historiques Mistral et Sonnet ont des protocoles distincts ;
   elles servent au calibrage, pas de preuve composite.
3. Finance a arbitré le plafond `0.75 USD`, le maximum de 48 tentatives et le
   retry transitoire unique. Toute dépense demeure bloquée avant GO explicite.
4. La documentation benchmark historique interdit encore une combinaison
   multi-modèle ; cet énoncé est obsolète face à BACKLOG_V4 v1.3.0, mais les
   artefacts historiques restent non comparables.

## Plan hors ligne

1. Valider une enveloppe de run stricte et son empreinte.
2. Préenregistrer les douze cellules du mini-panel sans holdout.
3. Tester avec providers déterministes la chaîne V4-009 complète, y compris
   retry, désaccord, dépassement absorbé, règlement et libération.
4. Produire un paquet aveugle ne contenant aucun champ interdit.
5. Répéter le workflow sur une branche Neon jetable après réparation de la
   migration.
6. Demander un GO explicite avec identité, routes, 12 runs, maximum d'appels et
   plafond avant toute dépense.

## Identité et protocole gelés

- Pipeline : `learnx-fr-text-mistral-sonnet-targeted-v1@1.0.0`.
- Primaire : `mistralai/mistral-medium-3-5`, route Mistral, profil `2.0.0`.
- Vérificateur : `anthropic/claude-sonnet-4.6`, route Anthropic, profil `2.0.0`.
- Prompt `2.0.0`, protocole `3.0.1`, aucun fallback.
- Déclenchement `1.0.0` : sensibilité à la frontière interne, revue sécurité,
  warning exploitable ou contrôle préenregistré. La confiance seule est exclue.
- Désaccord matériel `1.0.0` : côtés opposés de la frontière, distance ordinale
  de deux niveaux, ou au moins deux critères divergents. Résultat `UNCERTAIN`
  sans score exact, sans moyenne ni vote.
- Budget : `0.75 USD` maximum, 48 tentatives maximum, préflight avant chaque
  appel ; zéro débit utilisateur.

Le corpus v1-3 et la configuration prompt/protocole sont encore des travaux
parallèles non committés dans le dépôt principal. Le manifeste les lie par
identité et SHA, mais aucun lancement reproductible ne sera autorisé tant que
leur autorité n'est pas disponible dans une révision Git propre.
