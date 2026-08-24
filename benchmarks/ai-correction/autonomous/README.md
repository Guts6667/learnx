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
  autonome actif. Ses 24 cas ont été authorés hors dépôt, qualifiés par les
  gates autonomes puis scellés en AES-256-GCM après l'autorisation explicite du
  Propriétaire. Le paquet reste fermé et inexécutable ;
- `manifest.v1.json` est conservé comme preuve historique ;
- `manifest.v2.json` relie la voie autonome active au holdout v3.

Le contrat reste `EVIDENCE_ASSIST_ONLY_DRAFT_NOT_PUBLISHED`. Aucun de ces
fichiers n'autorise un appel modèle, une publication ou une activation
utilisateur.

## Qualification autonome

L'absence d'évaluateur humain n'est jamais masquée par une fausse propriété
`humanReview`. Le holdout ne devient qualifié puis scellé que si :

1. ses cas et attentes sont construits hors des sorties candidates ;
2. aucun auteur du corpus n'accède aux résultats candidats pendant l'authoring ;
3. oracle mécanique, métamorphismes, mutations et tests injection/canari
   réussissent tous ;
4. les manifestes de construction et validation sont empreintés ;
5. seul un artefact chiffré AES-256-GCM est ajouté au dépôt ;
6. le contenu atteint au moins 24 cas et reste fermé jusqu'au GO complet du
   développement puis à une autorisation one-shot distincte.

L'authoring v3 courant couvre 6 cas à oracle mécanique, 6 cas à pseudo-oracle
synthétique explicitement non formel, 8 transformations métamorphiques et 4
frontières injection/canari. Les empreintes de construction et de
prévalidation sont versionnées sans publier le texte. `PREVALIDATED` ne signifie
ni `QUALIFIED`, ni `SEALED`, ni une autorisation d'ouverture.

Un accord entre modèles ne remplace aucune de ces preuves. La qualification
autonome établit conformité, sécurité, stabilité et abstention sur un scope
gelé ; elle ne démontre pas une justesse pédagogique universelle.

Toute modification d'un cas, d'une attente, d'un seuil, du protocole, de la
rubrique ou du segmenter crée une nouvelle identité. Le holdout ne sert jamais
au choix du prompt, du modèle ou des seuils.

## Scellement effectué, ouverture bloquée

La validation d'un plaintext conservé hors dépôt reste disponible pour les
contrôles de préparation :

```bash
pnpm ai:holdout:v3:validate -- --plaintext=<chemin-absolu-hors-depot>
```

Le scellement a été effectué via la commande dédiée et la décision propriétaire
`AUTHORIZE_V4_HOLDOUT_V3_QUALIFICATION_AND_SEAL`. La clé AES de 32 octets reste
dans le Trousseau macOS, hors dépôt. Le dépôt contient uniquement le ciphertext,
le manifeste et le certificat de qualification autonome. Cette décision
n'autorise ni l'ouverture, ni l'exécution, ni la promotion. L'ouverture one-shot
exige encore `GO_TO_SEALED_HOLDOUT` et une autorisation séparée.
