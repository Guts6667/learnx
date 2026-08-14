# Corpus autonome WRITING/fr-FR

Cette famille de corpus est indépendante du benchmark historique V1 et de sa
propriété `humanReview`. Elle ne revendique aucune validation humaine.

- `writing-fr-development-mini-panel.v1.json` : dix cas synthétiques, deux
  répétitions prévues, oracle autonome scellé et relations métamorphiques
  explicites ;
- `writing-fr-holdout.v1.json` : ancien holdout compromis parce que ses réponses
  et ses golds ont été versionnés en clair ; il est supprimé de l'état actif et
  reste définitivement disqualifié, même si l'historique Git permet l'audit ;
- `../executable-rubric/writing-fr-holdout.v2.manifest.json` : manifeste vide
  du remplacement compatible avec la rubrique atomique, en attente d'un
  contenu externe et d'une revue humaine indépendante ;
- `manifest.v1.json` : empreinte du développement, preuve du retrait historique
  et lien vers le remplacement non exécutable.

Le contrat référencé reste `DRAFT_NOT_PUBLISHED`. Ces fichiers sont uniquement
des preuves hors ligne et n'autorisent ni appel modèle, ni publication, ni
activation utilisateur. Toute modification d'un cas, d'un gold ou d'un seuil
crée une nouvelle identité de corpus et de manifeste.

## Oracle

`SEALED_AUTONOMOUS` signifie que les attentes déterministes ont été fixées avant
les candidats. Cela ne signifie ni revue humaine indépendante, ni vérité
pédagogique universelle. Les empreintes rendent toute modification ultérieure
détectable.

Le mini-panel couvre exactement : baseline, paraphrase, concision, fautes et
Unicode sans perte de sens, mutation isolée de chacun des trois critères,
contradiction appartenant au critère de décision et deux injections.

Le mot « scellé » ne désigne plus un JSON lisible dont seule l'ouverture est
interdite par convention. Le remplacement ne pourra porter ce statut que si :

1. ses cas et attentes atomiques sont authorés hors du dépôt ;
2. une revue humaine indépendante approuve ce contenu exact ;
3. l'empreinte du contenu revu est conservée ;
4. seul un artefact chiffré AES-256-GCM est ajouté au dépôt ;
5. le manifeste reste non exécutable jusqu'au GO complet du développement.

Le script `scripts/seal-executable-rubric-holdout.ts` applique ces contrôles et
refuse un plaintext situé dans le dépôt. Aucun contenu V2 n'est actuellement
authoré ou approuvé : le manifeste dit donc explicitement
`CONTENT_NOT_AUTHORED` et ne revendique aucune nouvelle lecture humaine.
