# Backlog V4.1 — fiabilisation après le pilote

## Objet

Ce document recueille ce qui est explicitement différé afin de livrer V4 sans
présenter son pipeline comme parfait. Rien ici ne bloque le pilote V4 borné,
mais chaque extension de scope ou ouverture payante exige les gates indiqués.

## P0 — qualité du pipeline Writing

### V4.1-001 — Contrainte dure → niveau plancher

- Corriger le contrat/prompt pour qu'une violation de contrainte dure reconnue
  dans le feedback impose mécaniquement le niveau plancher du critère.
- Ajouter des tests sur échéance, plafond, capacité et option interdite.
- Preuve du report : anatomie du dernier examen Writing, faux PASS sur plan
  d'action erroné.

### V4.1-002 — Garde indépendante du score du modèle

- À l'examen, ancrer la garde sur le gold scellé.
- Au runtime, utiliser des signaux indépendants et versionnés ; ne jamais
  prétendre connaître l'écart au gold d'une copie réelle.
- Mesurer séparément déclenchement utile, abstention et surcoût.

### V4.1-003 — Nouvel examen Writing pour un GO payant

- Auteur(s), accord préalable, corpus frais et préenregistrement avant modèle.
- Ne réutiliser aucun examen brûlé.
- Conserver `humanReviewApproved=false` tant qu'aucune vraie revue humaine
  n'existe ; une revue autonome reste nommée comme telle.
- Faux PASS, sécurité, preuve, coût P50/P90 et taux partiel sont bloquants.

## P1 — expérience et exploitation

### V4.1-004 — Nouvelle version ciblée d'une soumission

- Permettre à l'apprenant de ne modifier que la partie « à retravailler » sans
  écraser la version précédente.
- Définir devis et coût d'une recorrrection minimale avant implémentation.
- Mesurer compréhension, abandon et perception du prix plein.

### V4.1-005 — Monitoring de calibration

- Remplacer le signal heuristique de contrainte dure par un événement issu du
  contrat et de règles déterministes.
- Ajouter cohortes, dérive par contrat, coût P50/P75/P90 et incidents de
  réconciliation.
- Ne jamais convertir un coût absent en zéro.

### V4.1-006 — Workflow challenger

- Exécuter périodiquement des candidats sur un corpus non brûlé.
- Comparer à identité de protocole constante.
- Aucun remplacement automatique du modèle promu ; décision et rollback
  explicites.

## P2 — extension du scope

### V4.1-007 — Familles non Writing

- Créer des contrats et examens distincts pour `reflection`, `practice` et
  `project`.
- Le défaut Practice du 24 août interdit toute réutilisation automatique du
  pin Writing.

### V4.1-008 — Langues supplémentaires

- Contrat, corpus, QA linguistique et coûts par langue.
- Aucun simple changement de locale sur le pipeline fr-FR.

### V4.1-009 — Correction payante

- Ouvrir seulement après GO Writing, calibration des plafonds P90, traitement
  légal/comptable, parcours d'achat et support incident.
- Le pilote V4 reste crédits offerts ; ce ticket ne rétroactive aucun prix.

## Définition de terminé V4.1

- identité, contrat, corpus, règles, coûts et verdict liés par digest ;
- zéro promesse au-delà des données ;
- tests de transport, sécurité, preuve, calibration et UX ;
- mécanisme de rollback ;
- documentation publique datée, avec anciens résultats conservés.
