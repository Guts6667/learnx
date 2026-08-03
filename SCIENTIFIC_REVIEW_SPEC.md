# Validation scientifique optionnelle

## 1. Décision produit

La publication et la validation scientifique sont indépendantes.

- Un contenu pédagogiquement complet peut être publié pour usage personnel sans
  revue scientifique.
- Publier ne signifie jamais « validé scientifiquement ».
- Une validation professionnelle peut être ajoutée après publication.
- Une modification du contenu revu doit rendre la validation périmée jusqu'à
  une nouvelle décision.

Cette évolution est classée `TECH_VALIDATION` : elle nécessite des données
persistées, une migration Prisma, des contrats API et une représentation dans
l'interface. Elle ne doit pas être mélangée à un commit de contenu ou au ticket
d'administration minimale.

## 2. Expérience utilisateur

### Leçon

La page d'une leçon affiche un indicateur discret :

- aucune pastille promotionnelle lorsque la revue n'a pas été réalisée ;
- texte neutre « Revue scientifique non réalisée » dans les détails ;
- pastille verte « Validé scientifiquement » lorsque la validation est active ;
- pastille ambre « Validation à renouveler » lorsque le contenu a changé.

La pastille est un bouton accessible au clavier. Elle ouvre un panneau ou une
boîte de dialogue indiquant :

- le nom du réviseur ;
- ses qualifications et, si renseignée, son organisation ;
- la date de validation ;
- la version ou l'empreinte du contenu contrôlé ;
- le périmètre de la revue ;
- une note courte ;
- un lien de preuve optionnel.

Le nom et les qualifications ne sont affichés qu'avec l'accord du réviseur.

### Module

Le statut du module est dérivé des leçons publiées :

- toutes validées et courantes : « Module validé scientifiquement » ;
- validation partielle : « X/Y leçons validées » ;
- aucune validation : aucune pastille verte.

Aucune seconde validation de module n'est requise pour répéter les mêmes
contrôles.

## 3. Modèle de preuve

La preuve doit être historisée dans une entité distincte liée à la leçon plutôt
que dans `Lesson.isPublished`.

Champs minimaux :

- identifiant ;
- `lessonId` ;
- décision : `VALIDATED`, `CHANGES_REQUIRED` ou `WITHDRAWN` ;
- nom, qualifications et organisation optionnelle du réviseur ;
- consentement d'affichage de l'identité ;
- date de décision ;
- périmètre et note ;
- URL de preuve optionnelle ;
- empreinte de la version revue ;
- dates de création et modification.

L'empreinte couvre au minimum le résumé, les blocs, les ressources, les notions,
les questions, les tâches et exercices. Une validation est active uniquement si
la dernière décision applicable est `VALIDATED` et si son empreinte correspond
au contenu courant.

## 4. Administration et autorisation

Dans le MVP, seul un administrateur propriétaire peut enregistrer une décision
reçue d'un professionnel. Le professionnel n'a pas besoin d'un compte LearnX.
Un portail de signature externe reste une évolution ultérieure.

L'administration doit permettre :

- créer une validation ;
- consulter l'historique ;
- retirer une validation sans supprimer la preuve ;
- constater qu'une validation est périmée ;
- ne jamais bloquer la publication au seul motif qu'aucune validation n'existe.

## 5. Critères d'acceptation

- Une leçon sans revue scientifique peut être publiée si les contrôles
  pédagogiques existants passent.
- Aucun endpoint de publication ne consulte la revue scientifique comme gate.
- Une leçon validée affiche la pastille et ses détails exacts.
- Une leçon non validée ne peut pas être présentée comme validée.
- Une modification couverte par l'empreinte rend automatiquement la pastille
  périmée.
- Le module agrège uniquement les leçons publiées et leurs validations actives.
- Les utilisateurs non administrateurs ne peuvent ni créer ni modifier une
  validation.
- Les détails privés d'un réviseur sans consentement ne sont pas exposés.
- Les tests couvrent autorisation, publication indépendante, agrégation,
  péremption, retrait et affichage accessible.

## 6. Hors périmètre initial

- accréditation ou vérification juridique des qualifications ;
- paiement du réviseur ;
- workflow de signature externe ;
- validation globale automatique d'un programme ;
- score scientifique calculé par IA.
