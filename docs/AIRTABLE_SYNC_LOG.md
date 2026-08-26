# Journal de synchronisation Airtable — V4.1

## Contrat

Ce journal complète `docs/AGENT_WORKFLOW.md`. Il est append-only pendant V4.1.
Chaque entrée consigne uniquement une synchronisation réellement relue ; elle
ne constitue ni un GO de release ni une autorisation de publier une interface.

## 26 août 2026 — initialisation contrôlée

- Base : `app8IaHD1sJtI83WT`
- Table : `tblpSbdB7K4MioyJq`
- Source Git : `V4_1_BACKLOG.md`
- SHA de définition initial : `4b342511`
- Portée : 27 IDs V4.1 stables, sans doublon ni ID manquant
- Champs opérationnels relus : statut, blocage, branche, SHA, preuves QA et
  date de synchronisation
- Mutations effectuées ensuite : mises à jour unitaires des tickets actifs ou
  revus ; aucun bulk update, aucune suppression, aucun archivage
- Interface Kanban : non publiée ; publication exclue sans confirmation
- Conflit : aucun statut manuel n'a été écrasé ; toute divergence future suit
  le protocole `NEEDS_ARBITRATION`

Les prochaines entrées doivent indiquer le ticket, l'ancien et le nouveau
statut, le SHA, les champs modifiés, le résultat de la relecture et l'auteur de
l'autorisation.

## 26 août 2026 — réconciliation opérationnelle

- Autorisation : instruction propriétaire « PLEASE IMPLEMENT THIS PLAN », dont
  le backlog Airtable et le workflow agents font partie intégrante.
- V4.1-005 : `REVIEW` → `NEEDS_ARBITRATION`, SHA `4b342511`. Le blocage réel
  (choix de statuts incomplets et synchronisation non relue) a été enregistré ;
  aucun statut tiers n'a été écrasé.
- V4.1-301 : `IN_PROGRESS` → `REVIEW`, SHA `f53a23a9`, branche
  `codex/v4-1-301`. Les preuves owner ont été enregistrées avant la revue
  indépendante.
- V4.1-302 : `IN_PROGRESS` → `QA`, SHA `b4a43d3b`, branche
  `codex/v4-1-302`. La transition suit un `REVIEW_PASS` indépendant.
- V4.1-006 : statut `REVIEW` conservé, SHA `76f5c2bd`. Le correctif de parité
  bilatérale et le test ciblé ont remplacé les preuves inexactes ; la clôture
  attend encore la seconde revue.
- Les 23 autres tickets V4.1 ont conservé exactement leur statut manuel. Seuls
  `État de synchro = Canonique Git` et `Dernière synchronisation` ont été mis à
  jour en une écriture groupée contrôlée.
- Relecture : 27 IDs V4.1 uniques ; 25 sont synchronisés avec Git. V4.1-005
  demeure explicitement à réconcilier et V4.1-006 demeure en revue. Les vues
  supplémentaires et le choix `READY_FOR_OWNER_GO` ne sont pas fabriqués avant
  une transition réelle.
- Interface : aucun brouillon n'a été publié.
