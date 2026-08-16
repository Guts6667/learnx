# Corpus autonome WRITING/fr-FR

Cette famille est indépendante du benchmark historique V1 et ne revendique
aucune validation humaine ni vérité pédagogique universelle.

- `writing-fr-development-mini-panel.v1.json` est un corpus synthétique
  historique de développement, jamais un oracle humain ;
- `writing-fr-holdout.v1.json` est définitivement compromis par son ancien
  versionnement en clair et retiré de l'état actif ;
- `../executable-rubric/writing-fr-holdout.v2.manifest.json` reste un draft
  historique supersédé qui exigeait encore une revue humaine ;
- `../executable-rubric/writing-fr-holdout.v3.manifest.json` est le manifeste
  autonome actif, actuellement non authoré, non scellé et inexécutable ;
- `manifest.v1.json` est conservé comme preuve historique ;
- `manifest.v2.json` relie la voie autonome active au holdout v3.

Le contrat reste `DRAFT_NOT_PUBLISHED`. Aucun de ces fichiers n'autorise un
appel modèle, une publication ou une activation utilisateur.

## Qualification autonome

L'absence d'évaluateur humain n'est jamais masquée par une fausse propriété
`humanReview`. Un futur holdout ne devient qualifié que si :

1. ses cas et attentes sont construits hors des sorties candidates ;
2. aucun auteur du corpus n'accède aux résultats candidats pendant l'authoring ;
3. oracle mécanique, métamorphismes, mutations et tests injection/canari
   réussissent tous ;
4. les manifestes de construction et validation sont empreintés ;
5. seul un artefact chiffré AES-256-GCM est ajouté au dépôt ;
6. le contenu atteint au moins 24 cas et reste fermé jusqu'au GO complet du
   développement puis à une autorisation one-shot distincte.

Un accord entre modèles ne remplace aucune de ces preuves. La qualification
autonome établit conformité, sécurité, stabilité et abstention sur un scope
gelé ; elle ne démontre pas une justesse pédagogique universelle.

Toute modification d'un cas, d'une attente, d'un seuil, du protocole, de la
rubrique ou du segmenter crée une nouvelle identité. Le holdout ne sert jamais
au choix du prompt, du modèle ou des seuils.
