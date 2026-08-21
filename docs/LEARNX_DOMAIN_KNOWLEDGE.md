# Carte canonique du domaine LearnX

- **Statut** : `CANONICAL_DOMAIN_MAP`
- **Version** : `1.0.0`
- **Dernière mise à jour** : 21 août 2026
- **Objet** : retrouver rapidement le vocabulaire, les responsabilités et le
  chemin critique du produit sans relire l'ensemble du backlog

Ce document explique **ce qu'est LearnX**. Il ne remplace ni
`docs/V4_ROADMAP.md`, qui porte l'état courant, ni les tickets détaillés de
`BACKLOG_V4.md`.

## 1. La promesse produit

LearnX organise des parcours d'apprentissage guidés, mesure les preuves qui
peuvent l'être honnêtement et fournit de la remédiation. La plateforme ne doit
jamais transformer une approximation technique en promesse pédagogique.

Pour les productions libres, la promesse V4 est bornée :

> Feedback formatif autonome, critériel et appuyé sur les preuves présentes
> dans la réponse de l'apprenant.

Ce feedback n'est ni une correction certifiée, ni une validation de maîtrise,
ni un jugement académique.

## 2. Les objets structurants

La hiérarchie pédagogique est immuable :

```text
Program
  -> Stage
    -> Module
      -> Lesson
```

- **Program** : objectif global, public, prérequis, niveau visé et cohérence du
  parcours.
- **Stage** : jalon pédagogique cohérent, terminé par une évaluation d'étape.
- **Module** : groupe de leçons poursuivant un sous-objectif.
- **Lesson** : unité d'apprentissage contenant ressources, activités et
  évaluations nécessaires.

`AcademicYear` et `Semester` n'appartiennent pas au domaine LearnX. Les durées
sont indicatives et ne modifient jamais cette hiérarchie.

## 3. Les trois états à ne jamais confondre

| Objet | Question | Autorité |
| --- | --- | --- |
| Remise | L'apprenant a-t-il envoyé une version de son travail ? | Serveur LearnX |
| Feedback | Que démontre cette version au regard d'un contrat publié ? | Rubrique exécutable et preuves validées par LearnX |
| Maîtrise | L'objectif pédagogique est-il réellement validé ? | Évaluation déterministe indépendante |

Un feedback IA ne modifie jamais `ConceptProgress`, `StageProgress` ou un état
`VALIDATED`. V4-011 reste fermé tant qu'un contrôle cumulatif, déterministe et
multi-notions n'existe pas.

## 4. Le cycle de création d'un programme

```text
besoin apprenant
  -> objectifs et prérequis
  -> architecture Program/Stage/Module/Lesson
  -> ressources et références
  -> activités et évaluations
  -> contrôles éditoriaux et techniques
  -> publication versionnée
```

Une notion obligatoire possède une évaluation. Une étape publiée possède une
évaluation finale. Une ressource consultée ne valide aucune notion.

Les productions destinées au feedback autonome exigent en plus un contrat de
correction. Les productions trop holistiques restent hors du MVP autonome au
lieu d'être forcées dans une fausse grille précise.

## 5. Le contrat de correction

Un contrat publié définit une seule fois :

- les critères indépendants ;
- les éléments observables appartenant à chaque critère ;
- les variantes acceptables, contre-exemples et contradictions ;
- les règles de preuve ;
- les effets déterministes sur les niveaux ;
- les messages de force, révision, contradiction et clarification ;
- les ressources de remédiation.

Le funnel complet est défini dans
`docs/V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md`.

## 6. Le pipeline de feedback autonome

```text
réponse apprenant non fiable
  -> segmentation LearnX
  -> recherche de relations de preuve candidates
  -> validation serveur des spans et de la sécurité
  -> statuts atomiques authorés
  -> règles de niveau déterministes
  -> certificat reconstructible
  -> feedback par templates authorés
```

Le modèle n'a aucune autorité de score, niveau, `PASS/FAIL`, progression ou
feedback libre. Il peut seulement proposer ou contester des relations entre un
élément et des passages de la réponse.

Les statuts pédagogiques visibles sont :

- `FEEDBACK_READY` : résultat déterminable ;
- `REVISION_REQUIRED` : un élément requis n'est pas démontré ou est explicitement
  refusé/contredit ;
- `CLARIFICATION_REQUIRED` : une ambiguïté peut changer le résultat ;
- `TEMPORARILY_UNAVAILABLE` : incident technique, sans résultat ni débit.

## 7. Les autorités

| Décision | Autorité |
| --- | --- |
| Texte, objectif, critère, élément, template | Produit et pédagogie, puis approbation propriétaire |
| Compilation, spans, règles, niveaux indicatifs | Serveur LearnX |
| Relations de preuve candidates | Modèle, sans autorité décisionnelle |
| Progression et maîtrise | Serveur LearnX, hors correction IA |
| Budget expérimental | Finance puis Propriétaire |
| Publication/activation | Propriétaire après gates techniques et pédagogiques |

## 8. Les machines d'état séparées

| Plan | États principaux |
| --- | --- |
| Pédagogie | `FEEDBACK_READY`, `REVISION_REQUIRED`, `CLARIFICATION_REQUIRED`, `TEMPORARILY_UNAVAILABLE` |
| Exécution | `PENDING`, `SENT`, `CONFIRMED`, `ORPHANED` |
| Finance | `RESERVED`, `SETTLED`, `RELEASED`, `RECONCILIATION_REQUIRED` |
| Publication | `DRAFT`, `PUBLISHED`, `RETIRED` |

Un succès réseau ne constitue pas un succès pédagogique. Un résultat
pédagogique sans coût réconcilié ne peut pas être réglé ou publié.

## 9. V4 et V5

- **V4** : expérience d'apprentissage, correction formative, comptes, crédits,
  instrumentation et premier pilote borné.
- **V5** : conception assistée de formations et industrialisation éditoriale.

Le funnel V4 authorise un contrat précis pour une activité existante. Il ne
remplace pas le futur funnel conversationnel V5 de création d'un programme
complet.

## 10. État réel au 21 août 2026

| Plan | État |
| --- | --- |
| Fondations techniques | Intégrées sur `dev`, tests hors ligne disponibles |
| Flow apprenant V4-010 | Fake provider intégré, forcé à `OFF` en production |
| Contrats publiés | 0 |
| Activités éligibles | 0 |
| Pipeline promu | Aucun |
| Dernière campagne | Close après divergence sémantique, sans replay |
| Holdout | Scellé mais fermé |
| Débit utilisateur | Aucun |

Le chemin critique n'est donc plus de construire un orchestrateur. Il est de
publier **un contrat WRITING/fr-FR honnêtement exécutable**, puis de démontrer
qu'un chercheur de preuves respecte ce contrat.

## 11. Prochain chemin critique

1. Exécuter `V4-002A` : cadrer l'activité et la consigne pilote.
2. Obtenir l'arbitrage Propriétaire A, puis authorer le contrat atomique
   `V4-002B`.
3. Livrer le compilateur v2 et passer les paires minimales/métamorphismes.
4. Auditer puis geler une nouvelle identité expérimentale.
5. Obtenir séparément les GO Finance et Propriétaire pour quatre appels.
6. Si le gate réussit, exécuter le corpus de développement, puis demander
   l'ouverture one-shot du holdout.
7. Seulement après promotion, remplacer le fake provider de V4-010 derrière
   un feature flag et lancer un pilote fermé.

## 12. Sources à ouvrir ensuite

- état et prochaines actions : `docs/V4_ROADMAP.md` ;
- tickets et critères : `BACKLOG_V4.md` ;
- moteur : `docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md` ;
- arbitrage sémantique successeur :
  `docs/V4_EVIDENCE_SEMANTIC_ARBITRATION.md` ;
- authoring : `docs/V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md` ;
- historique expérimental : `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md`.
