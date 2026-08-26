# Backlog V4.5 — correction IA assistée et ouverture commerciale

## Autorité et état

- Version : 1.0.0
- Statut : **fermé — aucun ticket activable avant GO de V4.1-504**
- Owner de séquence : Produit
- Reviewer d'activation : Propriétaire
- Autorité : ce fichier devient le backlog d'exécution V4.5 uniquement après
  un GO explicite de V4.1-504.

## Objet

V4.5 commence après la clôture de V4.1. Elle combine une nouvelle version de
la correction IA assistée avec les évaluations textuelles d'étape et le cycle
commercial complet : calibration, essai public, packs, paiement,
remboursements et exploitation.

Les anciens tickets V4-011, V4-013 à V4-015, V4-018 et V4-018A restent des
références historiques. Ce document devient l'autorité d'exécution de leur
reprise ; aucune valeur de prix ou de pack n'est activée par sa seule création.

La recherche, les résultats et les décisions V4 restent append-only. Ils
informent le cadrage mais ne qualifient automatiquement ni un modèle, ni un
fournisseur, ni une famille, ni un tarif pour V4.5. Chaque nouvelle campagne
doit être préenregistrée, versionnée et relue sur des preuves fraîches.

## Registre d'exécution

| Ticket | Owner | Reviewer | Dépendances minimales | Statut |
| --- | --- | --- | --- | --- |
| V4.5-001 | Recherche IA | Produit / Pédagogie | V4.1-504 | Bloqué — V4.1 ouverte |
| V4.5-002 | Architecture IA | Sécurité / Recherche IA | V4.5-001 | Bloqué |
| V4.5-003 | Recherche IA | Reviewer indépendant | V4.5-001, V4.5-002 | Bloqué |
| V4.5-004 | Recherche IA | Pédagogie / Produit | V4.5-003 | Bloqué |
| V4.5-005 | Domaine / Pédagogie | Produit / Sécurité | V4.5-001, V4.5-004 | Bloqué |
| V4.5-006 | Produit / Frontend | QA / Accessibilité | V4.5-005 | Bloqué |
| V4.5-007 | Finance & Pricing | Produit / Recherche IA | V4.5-003, V4.5-004 | Bloqué |
| V4.5-008 | Growth / Produit | Sécurité / Finance | V4.5-007 | Bloqué |
| V4.5-009 | Commerce / Backend | Finance / Sécurité | V4.5-007, V4.5-008 | Bloqué |
| V4.5-010 | Finance / Support | Juridique / Sécurité | V4.5-009 | Bloqué |
| V4.5-011 | Exploitation | Recherche IA / Finance | V4.5-004, V4.5-008, V4.5-010 | Bloqué |
| V4.5-012 | Release engineering | Propriétaire | V4.5-001 à V4.5-011 | Bloqué |

Un changement de statut exige une preuve liée et le verdict du reviewer. La
seule clôture de V4.1 n'ouvre pas automatiquement une campagne, un essai ou un
paiement : l'activation du ticket concerné reste explicite.

## P0 — nouvelle correction IA assistée

### V4.5-001 — Contrat qualité de nouvelle génération

- Versionner les critères, preuves, contraintes dures, abstentions et règles de
  livraison partielle.
- Séparer résultats scientifiques, arbitrages produit et promesses publiques.
- Ne jamais faire dépendre progression ou maîtrise d'un verdict IA seul.

### V4.5-002 — Pipeline assisté et garde indépendante

- Comparer primaire seul, vérification ciblée et autres architectures
  préenregistrées.
- Utiliser des signaux indépendants du score déclaré par le modèle.
- Aucun changement automatique de modèle, seuil ou fournisseur.

### V4.5-003 — Benchmark frais et workflow challenger

- Corpus et examen frais, identités scellées, coûts réconciliés et gates adaptés
  à la taille réelle des échantillons.
- Évaluer sécurité, faux résultats favorables, stabilité, couverture,
  abstention, qualité pédagogique et coût P50/P75/P90.
- Publier chaque décision comme un nouvel article sans réécrire l'historique.

### V4.5-004 — Qualification des quatre familles

- Tester séparément `writing`, `reflection`, `practice` et `project`.
- Ne pas extrapoler la preuve Writing aux autres familles.
- Maintenir un scope runtime strict par contrat, langue et classe de taille.

## P0 — évaluations textuelles d'étape

### V4.5-005 — Autorité de validation et progression

- Définir la relation entre remise, feedback formatif et preuve de maîtrise.
- Conserver un gate déterministe lorsque la maîtrise doit modifier la
  progression.
- Ne pas simuler de validation humaine absente.

### V4.5-006 — Expérience d'évaluation et historique

- Intégrer devis, soumission, correction, incertitude, nouvelle tentative et
  historique sans écraser les résultats précédents.
- Couvrir recours, indisponibilité et absence d'effet sur la progression lorsque
  l'autorité déterministe manque.

## P0 — calibration et commerce

### V4.5-007 — Calibration économique

- Mesurer coûts réels et incidents par famille et classe de taille.
- Fixer parité, P90, réserve, prix minimal et marge de contribution disponible.
- Ne dépendre ni d'une promotion fournisseur ni de l'inactivité utilisateur.

### V4.5-008 — Essai public et cohortes

- Séparer essai public, famille/amis, early adopters et crédits achetés.
- Définir limites, anti-abus, métriques d'acquisition et coupe-circuit.
- Une sortie inutilisable ne consomme pas l'essai.

### V4.5-009 — Packs, checkout et webhooks

- Publier uniquement les packs explicitement validés.
- Attribuer les crédits exclusivement après webhook vérifié et idempotent.
- Conserver la séparation des lots achetés et offerts.

### V4.5-010 — Remboursements, litiges et clôture

- Définir procédures, écritures compensatoires, réconciliation et audit.
- Ne jamais réécrire silencieusement le ledger.
- Valider les traitements juridiques, fiscaux et comptables applicables.

## P1 — exploitation et lancement

### V4.5-011 — Monitoring qualité, coût et marché

- Suivre dérive, incidents, abstentions, coûts, funnel essai→paiement et marge.
- Distinguer coût IA, CAC IA et CAC complet.
- Documenter seuils d'alerte, suspension et rollback.

### V4.5-012 — Gate de release V4.5

- Réconcilier achat → crédits → correction → règlement → remboursement/clôture.
- Valider sécurité, confidentialité, accessibilité, support et conditions
  commerciales sur les environnements ouverts.
- Exiger un GO explicite du Propriétaire avant prix, packs ou paiement réels.

## Définition de terminé V4.5

- pipeline et limites publiées correspondent aux preuves ;
- évaluations textuelles n'accordent aucune maîtrise non démontrée ;
- coûts et réserves sont calibrés sur des mesures réelles ;
- essai, packs, paiement et remboursements sont réconciliables ;
- support, monitoring, rollback et conformité sont opérationnels ;
- rapport public et rapport technique sont datés et reproductibles.
