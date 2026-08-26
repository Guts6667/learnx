# Candidats V5 — Conception guidée de formations

## Statut

- Version : 0.3.0
- Statut : **exploratoire — aucun ticket activable avant cadrage et validation V5**
- Source : arbitrage Produit, pédagogie et Finance & Pricing du 12 août 2026

Ce document conserve les hypothèses à tester pour V5. Il ne modifie pas le
scope V4, n'autorise aucun appel utilisateur de génération et ne fixe aucun
prix, modèle ou nombre de leçons.

## Séquençage et gouvernance

- Prérequis de séquence : clôture prouvée de V4.1-504 puis de V4.5-012.
- Autorité d'activation : Propriétaire, après cadrage Produit distinct.
- Les identifiants `V5-CANDIDATE-*` et `V5-ANALYTICS-*` ci-dessous ne sont pas
  des tickets d'implémentation et ne peuvent pas être affectés à un agent.
- La recherche de conception ne réutilise pas silencieusement les corpus,
  seuils, prix ou verdicts de correction IA V4/V4.5.
- Les analytics n'instrumentent aucune donnée avant décision confidentialité,
  rétention et consentement ; ils ne modifient jamais la progression.
- Une promotion en backlog V5 crée un nouveau ticket avec owner, reviewer,
  dépendances, critères d'acceptation, source, statut et rollback.

| Candidat | Owner du cadrage | Reviewer requis | Dépendance de promotion | Statut |
| --- | --- | --- | --- | --- |
| V5-CANDIDATE-001 — conception guidée | Produit / Pédagogie | Recherche IA / Finance | V4.5-012 + protocole V5 approuvé | Exploratoire |
| V5-CANDIDATE-002 — analytics | Produit / Data | Confidentialité / Sécurité | V4.5-012 + contrat de mesure approuvé | Exploratoire |

## V5-CANDIDATE-001 — Benchmark du pipeline de conception

### Intention

Comparer un pipeline auteur-réviseur capable de produire des formations
compatibles avec LearnX sans faire dépendre la qualité d'un modèle unique ni
confondre génération, vérification des sources et validation humaine.

### Pipeline candidat

- Préparation et contrôles simples : comparer `google/gemini-3.6-flash-20260721`
  et `openai/gpt-5.6-luna-20260709` comme alternatives.
- Auteur principal : `anthropic/claude-4.6-sonnet-20260217`.
- Réviseur indépendant et normalisation LearnX :
  `openai/gpt-5.6-terra-20260709`.
- Recours exceptionnel : `openai/gpt-5.6-sol-20260709` uniquement pour
  programme complexe ou sensible, désaccord auteur-réviseur ou échec répété,
  et seulement si son gain est mesuré.
- Recherche et vérification des sources : workflow, preuve et poste de coût
  séparés. La confiance d'un modèle ne constitue jamais une vérification.

### Scénarios à mesurer

1. Blueprint seul : préparation → Sonnet auteur → Terra réviseur.
2. Leçon complète : Sonnet auteur → Terra réviseur, avec éventuelle itération
   corrective mesurée.
3. Mini-formation : préparation, blueprint, leçons par lots et revue globale.
4. Programme long : génération par lots, revue de chaque lot et audit
   transversal final.
5. Variante économique : modèle léger pour la préparation uniquement, sans
   supprimer auteur, réviseur ou vérification des sources.
6. Escalade Sol sur une proportion limitée et mesurée des cas.

### Hypothèses financières de départ

Ces fourchettes fournisseur prudentes sont des simulations datées du 12 août
2026, pas des prix LearnX ni des objectifs pédagogiques :

| Scénario | Médiane–P90 théorique |
| --- | ---: |
| Blueprint Flash → Sonnet → Terra | 0,353–0,868 $ |
| Blueprint Luna → Sonnet → Terra | 0,330–0,810 $ |
| Une leçon Sonnet → Terra avec itération éventuelle | 0,430–1,168 $ |
| Mini-formation, hypothèse 5–8 leçons | 2,82–11,07 $ |
| Programme long, hypothèse 24–40 leçons | 11,38–50,38 $ |
| Supplément Sol pondéré 5–15 % | 0,043–0,323 $ |

Les nombres de leçons ci-dessus servent uniquement au chiffrage. La cohérence
pédagogique détermine toujours le nombre réel d'étapes, modules et leçons.

Le benchmark doit distinguer : inférence, cache, recherches, retries,
itérations auteur-réviseur, frais OpenRouter, change et scénario TVA. Le cache
porte surtout sur les instructions, le contrat LearnX et le blueprint répétés ;
il ne supprime aucune étape de contrôle. Tout contexte OpenAI dépassant 272k
tokens doit être évité par un traitement en lots afin de maîtriser coût et
qualité.

### Critères avant promotion en backlog V5

- Corpus V5 représentatif et validé séparément du corpus de correction V4.
- Mesures qualité, traçabilité des sources, conformité au contrat LearnX,
  latence, retries, médiane, P75 et P90.
- Comparaison Flash/Luna fondée sur preuves ; aucun remplacement silencieux.
- Gain de Sol démontré avant toute autorisation d'escalade.
- Coût des recherches et vérifications explicite et non masqué dans la
  génération.
- Aucun prix, capacité commerciale ou modèle actif avant arbitrage du
  Propriétaire.

## V5-CANDIDATE-002 — Analytics produit et cockpit administrateur

### Intention

Donner à LearnX des indicateurs produit fiables pour comprendre l'adoption,
l'usage récurrent et les contenus effectivement ouverts, sans confondre vues,
personnes, apprentissage et maîtrise. Les mesures servent au pilotage produit ;
elles ne modifient jamais la progression d'un apprenant.

### Définitions à figer avant implémentation

- **Utilisateurs inscrits** : nombre de comptes répondant à une règle de statut
  documentée. Les comptes supprimés, administrateurs, tests et seeds doivent
  être inclus ou exclus par une politique explicite et versionnée.
- **Utilisateur actif unique** : compte authentifié ayant produit au moins un
  événement d'activité éligible dans la fenêtre. Plusieurs événements du même
  compte ne créent jamais plusieurs utilisateurs uniques.
- **DAU / WAU / MAU** : utilisateurs actifs uniques sur des fenêtres glissantes
  de 1, 7 et 30 jours, calculées en UTC. Une vue locale peut reformater les
  dates sans modifier les agrégats de référence.
- **Ressource ouverte** : ouverture d'une ressource interne ou clic sortant vers
  une ressource externe. Pour une URL externe, LearnX ne doit jamais présenter
  ce clic comme une preuve de lecture ou de compréhension.
- **Vue de ressource** : volume total d'ouvertures, distinct du nombre
  d'utilisateurs uniques ayant ouvert la ressource.

Les visiteurs anonymes, si leur mesure est retenue ultérieurement, restent une
population séparée. Aucun fingerprinting ni fusion silencieuse avec un compte
authentifié n'est autorisé.

### Découpage proposé

#### V5-ANALYTICS-001 — Contrat de mesure, confidentialité et gouvernance

- Définir les événements éligibles, leur version, leur horodatage UTC et leur
  clé d'idempotence.
- Fixer les populations incluses, exclusions internes, fenêtres DAU/WAU/MAU,
  politique de rétention et traitement d'une suppression de compte.
- Séparer identifiant technique, propriétés autorisées et données personnelles ;
  interdire texte libre, réponse d'apprenant, token, secret et contenu sensible
  dans les événements analytics.
- Faire valider la base juridique, l'information utilisateur et les éventuels
  consentements avant toute collecte en production.
- Documenter la date de début de collecte : aucune donnée antérieure ne doit
  être inventée ou reconstruite sans preuve.

#### V5-ANALYTICS-002 — Instrumentation produit de première partie

Instrumenter au minimum, avec écriture idempotente côté serveur lorsque
l'autorité appartient au serveur :

- création et activation d'un compte ;
- session ou activité authentifiée éligible ;
- inscription à un programme ;
- démarrage et complétion d'une leçon ;
- ouverture d'une ressource interne ;
- clic vers une ressource externe ;
- démarrage et soumission d'une activité ou évaluation ;
- événement technique rejeté ou dupliqué, sans payload utilisateur sensible.

Les événements de progression déjà autoritaires ne sont pas recalculés par le
client. Un rafraîchissement de page ne doit pas gonfler artificiellement les
comptes uniques.

#### V5-ANALYTICS-003 — Agrégations et API administrateur

- Produire des agrégats reproductibles pour inscrits, nouveaux inscrits,
  utilisateurs actifs uniques, DAU, WAU et MAU.
- Exposer les séries quotidiennes et la comparaison avec la période précédente,
  en affichant `N/A` lorsque l'historique est insuffisant.
- Classer programmes, leçons et ressources par ouvertures totales et par
  utilisateurs uniques, avec les deux valeurs visibles.
- Permettre les filtres par période, programme et cohorte lorsqu'ils sont
  réellement disponibles ; ne jamais fabriquer une cohorte manquante.
- Protéger les endpoints par le rôle administrateur, borner les périodes,
  paginer les listes et empêcher l'accès aux événements individuels depuis le
  cockpit agrégé.
- Prévoir un recalcul idempotent et un contrôle de cohérence entre événements
  bruts et agrégats.

#### V5-ANALYTICS-004 — Vue admin « Usage »

Créer une surface administrateur cohérente avec la direction Totem :

- cartes principales : inscrits, nouveaux inscrits, DAU, WAU et MAU ;
- courbe d'activité dans le temps, sans graphique décoratif ;
- tableau des programmes, leçons et ressources les plus ouverts ;
- colonnes distinctes `ouvertures` et `utilisateurs uniques` ;
- filtres de période et programme, état de filtre toujours visible ;
- date de dernière mise à jour et définition accessible de chaque KPI ;
- états chargement, vide, données insuffisantes, erreur et accès interdit ;
- responsive 320/390/720/1440/1920, clavier, focus, contraste, zoom 200 %,
  reduced motion et aucune couleur comme seul signal.

La vue n'affiche aucun classement individuel d'apprenant et n'utilise aucune
métrique de vanité comme preuve de maîtrise pédagogique.

#### V5-ANALYTICS-005 — Qualité, exploitation et audit

- Tester déduplication, frontières UTC, fenêtres glissantes et changements de
  statut d'un compte.
- Vérifier qu'un utilisateur avec dix ouvertures compte pour un utilisateur
  unique et dix ouvertures, tandis que dix utilisateurs comptent pour dix
  uniques.
- Vérifier les exclusions administrateur/test/seed selon la politique gelée.
- Tester autorisations, pagination, limites de période et absence de données
  personnelles dans les payloads.
- Mesurer délai d'agrégation, volume, coût de stockage et temps de réponse P50,
  P75 et P90 avant activation générale.
- Ajouter alertes sur rupture de collecte, dérive brut/agrégé et retard de mise
  à jour ; documenter reprise et recalcul.

### KPIs du MVP proposé

1. Comptes inscrits et nouveaux comptes sur la période.
2. DAU, WAU et MAU authentifiés.
3. Ratio DAU/MAU, présenté comme fréquence d'usage et non comme rétention à lui
   seul.
4. Démarrages et complétions de programmes et leçons.
5. Ressources les plus ouvertes : ouvertures totales et utilisateurs uniques.
6. Taux de passage inscription → premier programme → première leçon terminée.
7. Fraîcheur des données et taux d'événements rejetés ou dédupliqués.

La rétention par cohorte, les funnels avancés, l'export, les visiteurs anonymes
et les expériences A/B restent hors MVP jusqu'à arbitrage dédié.

### Critères avant promotion en backlog V5 activable

- Définitions Produit approuvées et exemples limites testés.
- Arbitrage confidentialité, rétention, information utilisateur et consentement.
- Choix explicite entre stockage interne de première partie et prestataire ;
  aucune dépendance analytics activée silencieusement.
- Modèle de coût stockage/agrégation et limites d'exploitation documentés.
- Maquette administrateur validée par Produit et direction artistique.
- Plan de migration sans faux historique et mécanisme de désactivation.
- Aucun événement analytics ne modifie progression, score, correction ou
  facturation.
