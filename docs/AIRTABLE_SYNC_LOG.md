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
