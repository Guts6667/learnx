# Blueprint pédagogique — Pilotage de projets IA et ISO/IEC 42001

## Statut

- Version : 1.0.1
- Statut : blueprint validé par le responsable produit le 9 août 2026 ; retour
  apprenant encore attendu sur le rythme et la certification personnelle exacte
- Classification : `CONTENT_ONLY`
- Programme cible : `pilotage-projets-ia-iso-42001`
- Public : consultant Data/IA junior ayant des bases en Agile et en IA
  générative
- Langue principale : français ; ressources anglaises possibles lorsqu'elles
  apportent une source primaire ou un support sensiblement meilleur
- Rythme cible : huit semaines, six heures par semaine en moyenne ; charge
  variable selon les étapes
- Volume indicatif : 48 heures, hors approfondissements facultatifs
- Cas principal : assistant interne fondé sur l'IA générative et la recherche
  documentaire
- État d'intégration : les huit étapes sont authorées en brouillon dans 36
  `PEDAGOGY_SPEC` et huit évaluations finales ; le bundle seed reste lui aussi
  en brouillon et ne contourne aucun contrôle de publication

Ce document décrit la carte cible du programme. Il ne remplace ni les futures
`PEDAGOGY_SPEC_XXX.json`, ni les évaluations détaillées, ni un éventuel bundle
de seed. Les titres, slugs et séquences deviennent contraignants seulement
après validation du blueprint puis intégration explicite.

Le parcours poursuit deux objectifs indissociables : exercer une posture de
consultant capable de cadrer et piloter des projets d'IA en entreprise, et
accompagner une organisation dans la mise en œuvre d'un système de management
de l'intelligence artificielle (SGIA). Il construit ainsi une base applicable à
une certification personnelle de type « Lead Implementer », mais ne revendique
ni équivalence avec une formation accréditée, ni préparation à l'examen d'un
organisme encore non identifié.

## 1. Besoin apprenant retenu

L'apprenant est un adulte de 27 ans, consultant Data/IA junior. Il possède :

- des bases en gestion de projet et en Agile ;
- une première expérience des usages de l'IA, surtout générative ;
- une compréhension initiale des chatbots, assistants et automatisations ;
- peu d'expérience structurée en gouvernance, conformité et gestion des risques.

Il souhaite évoluer vers un rôle de consultant IA capable d'accompagner une
entreprise depuis l'identification d'un cas d'usage jusqu'au déploiement et à
l'amélioration continue. Il privilégie des études de cas réalistes, des
livrables professionnels et des mises en situation. Il souhaite conjointement
préparer une certification personnelle orientée mise en œuvre
d'ISO/IEC 42001 : cet objectif de gouvernance et d'implémentation est central,
au même titre que sa progression comme consultant IA.

## 2. Finalité et résultats d'apprentissage

À l'issue du parcours, l'apprenant doit pouvoir :

1. conduire un entretien de découverte et reformuler une demande IA ambiguë ;
2. distinguer automatisation, logiciel conventionnel, apprentissage automatique
   et IA générative afin de ne pas imposer une solution inadaptée ;
3. identifier, documenter et prioriser des cas d'usage selon leur valeur, leur
   faisabilité, leur risque et la maturité de l'organisation ;
4. construire une note de cadrage comportant objectifs, indicateurs,
   hypothèses, dépendances, coûts, critères d'arrêt et décision `go/no-go` ;
5. adapter le pilotage Agile aux incertitudes d'un projet IA, de
   l'expérimentation au passage en production ;
6. cartographier un système d'IA générative, ses données, ses interfaces, ses
   fournisseurs, ses utilisateurs et ses mécanismes de supervision ;
7. formuler des scénarios de risque, les évaluer sans fausse précision et
   proposer des traitements proportionnés et vérifiables ;
8. situer les responsabilités pertinentes au regard du RGPD et du règlement
   européen sur l'IA, sans se substituer à un juriste ou à un DPO ;
9. définir le contexte, le périmètre, la gouvernance, les processus, les preuves
   et la boucle d'amélioration d'un SGIA ;
10. conduire un diagnostic d'écart et construire une feuille de route de mise
    en œuvre inspirée d'ISO/IEC 42001 ;
11. préparer déploiement, adoption, surveillance, incident, changement et
    retrait d'un système d'IA ;
12. défendre un dossier de pilotage et d'implémentation devant un comité de
    direction, en explicitant incertitudes, arbitrages et limites.

## 3. Positionnement de la certification

Trois objets sont distingués pendant tout le parcours :

1. la compétence personnelle de l'apprenant comme consultant et
   implémenteur ;
2. la mise en œuvre d'un SGIA dans une organisation ;
3. la certification du SGIA de cette organisation par un organisme tiers.

La certification AFNOR ISO/IEC 42001 présentée dans les références de cadrage
porte sur l'organisation. Elle sert à comprendre la destination d'une démarche
de mise en œuvre, pas à faire croire que le parcours délivre ce certificat à
l'apprenant.

Le parcours ne forme pas à conduire un audit tierce partie et ne prépare pas la
certification personnelle AFNOR « Auditeur ICA ». Il enseigne néanmoins les
bases de l'audit interne et de la préparation des preuves, nécessaires à une
posture de Lead Implementer.

Avant d'authorer une préparation d'examen spécifique, il faudra obtenir :

- l'intitulé et l'organisme exacts de la certification personnelle visée ;
- le programme d'examen et sa version ;
- les conditions d'admission et de réussite ;
- un accès licite à l'édition applicable de la norme ;
- les règles de l'organisme relatives aux supports et aux questions d'examen.

## 4. Principes de découpage

Les huit étapes structurent le parcours de deux mois souhaité, mais leur nombre
est justifié par la progression professionnelle : découvrir, sélectionner,
cadrer, réaliser, maîtriser les risques, mettre en œuvre le SGIA, opérer, puis
intégrer. Une étape peut être répartie sur plusieurs séances et ne correspond
pas nécessairement à une semaine civile. Ce découpage ne constitue pas un
standard LearnX.

La charge varie de 4 h 30 à 7 h 30 selon la densité, pour une moyenne de six
heures par semaine sur l'ensemble. Les leçons sont des unités ciblées, souvent
de 45 à 75 minutes activités comprises. Une étape ne sera ni gonflée ni
découpée uniquement pour obtenir une durée uniforme.

Chaque étape produit une partie d'un dossier cumulatif. Les évaluations ne sont
donc pas huit cas indépendants : elles améliorent progressivement un même
projet et obligent l'apprenant à réviser ses décisions lorsque de nouvelles
contraintes apparaissent.

## 5. Cas fil rouge — Asteria Services

### 5.1 Contexte fictif

Asteria Services est une entreprise fictive de services présente sur plusieurs
sites en France. Sa direction envisage un assistant interne d'IA générative
capable de rechercher des informations dans la documentation de l'entreprise,
de répondre aux questions des collaborateurs, d'aider à rédiger certaines
réponses et d'orienter les demandes complexes vers une personne compétente.

L'entreprise ne dispose pas encore d'une gouvernance IA unifiée. Les documents
sont dispersés, leur qualité varie et certains contiennent des informations
sensibles. Plusieurs fournisseurs promettent un déploiement rapide. La
direction attend des gains de productivité, mais les objectifs et la mesure de
la valeur restent imprécis.

Toutes les données, personnes, performances et décisions du cas sont
explicitement fictives. Elles illustrent une mission plausible sans prétendre
décrire une entreprise réelle.

### 5.2 Révélations progressives

Le cas évolue à mesure du programme :

- besoins contradictoires entre direction, métiers et IT ;
- absence de baseline fiable pour mesurer le temps de traitement ;
- documentation obsolète ou insuffisamment classifiée ;
- données personnelles et informations confidentielles ;
- dépendance à un fournisseur de modèle et à un hébergeur ;
- réponses plausibles mais incorrectes ;
- risque de prompt injection et d'exfiltration ;
- responsabilités de validation mal réparties ;
- adoption inégale et contournement des procédures ;
- incident fictif nécessitant analyse, correction et décision de maintien.

Ces révélations empêchent une solution parfaite dès la première semaine et
entraînent la révision du dossier, comme dans une mission réelle.

### 5.3 Mini-cas complémentaires

Des situations plus courtes élargissent le transfert sans créer de second fil
rouge : chatbot client, automatisation documentaire, assistant RH et copilote
de support. Les usages sensibles sont traités pour apprendre à renoncer,
escalader ou renforcer les contrôles, jamais pour banaliser leur déploiement.

## 6. Livrable professionnel cumulatif

Le programme aboutit à un **dossier de pilotage et d'implémentation d'un SGIA**
comprenant :

- compte rendu de découverte et reformulation du besoin ;
- portefeuille de cas d'usage et matrice de priorisation ;
- note d'opportunité et décision `go/no-go` ;
- charte projet, gouvernance, responsabilités, roadmap et backlog ;
- cartographie du système, des données et des fournisseurs ;
- plan d'évaluation de l'assistant ;
- registre des risques et plan de traitement ;
- définition du contexte et du périmètre du SGIA ;
- inventaire des systèmes d'IA et registre des preuves ;
- diagnostic d'écart et feuille de route d'implémentation ;
- plan de déploiement et d'accompagnement du changement ;
- tableau de bord de valeur et de risque ;
- procédure d'incident, changement et retrait ;
- synthèse exécutive et présentation finale.

Chaque modèle est enseigné comme un outil à adapter. Le remplissage mécanique
d'un template ne constitue jamais une preuve de compétence.

## 7. Architecture cible

### Étape 1 — Adopter la posture du consultant IA

- Slug cible : `posture-consultant-ia`
- Charge indicative : 4 h 30
- Finalité : relier les fondamentaux utiles de l'IA générative à une démarche de
  découverte et de conseil.

Module `role-et-systemes-ia` — Rôle, langage commun et découverte

- Distinguer automatisation, ML et IA générative
  (`distinguer-automatisation-ml-ia-generative`)
- Comprendre le système, son cycle de vie et ses acteurs
  (`comprendre-systeme-cycle-vie-acteurs`)
- Conduire un entretien de découverte
  (`conduire-entretien-decouverte`)

Évaluation finale : simulation d'un premier entretien avec un commanditaire,
puis note de reformulation séparant faits, attentes, hypothèses, questions
ouvertes et prochaine décision.

Contribution au dossier : compte rendu de découverte et première carte des
parties prenantes.

Réemploi : le besoin et les hypothèses sont révisés aux étapes 2, 3, 5 et 8.

### Étape 2 — Identifier et prioriser les cas d'usage

- Slug cible : `selectionner-cas-usage`
- Charge indicative : 5 h 30
- Finalité : passer d'une envie générale d'IA à un portefeuille de cas d'usage
  comparables et contestables.

Module `decouverte-et-priorisation` — Processus, opportunités et choix

- Cartographier un processus, ses acteurs et ses irritants
  (`cartographier-processus-irritants`)
- Formuler un cas d'usage et ses alternatives non-IA
  (`formuler-cas-usage-alternatives`)
- Prioriser valeur, faisabilité, risque et maturité
  (`prioriser-valeur-faisabilite-risque`)

Évaluation finale : étude de cas produisant un portefeuille court, une matrice
de priorisation argumentée et le rejet explicite d'au moins une proposition
inadaptée.

Contribution au dossier : portefeuille de cas d'usage et décision de
priorisation.

Réemploi : le cas retenu devient l'objet du business case et du SGIA.

### Étape 3 — Cadrer la valeur et la faisabilité

- Slug cible : `cadrer-valeur-faisabilite`
- Charge indicative : 5 h 30
- Finalité : construire un cadrage assez précis pour décider, expérimenter et
  mesurer sans promettre un résultat non démontré.

Module `business-case-ia` — Objectifs, maturité et décision

- Définir objectifs, baseline et indicateurs
  (`definir-objectifs-baseline-indicateurs`)
- Évaluer la maturité des données et de l'organisation
  (`evaluer-maturite-donnees-organisation`)
- Arbitrer options, coûts, dépendances et `go/no-go`
  (`arbitrer-options-couts-go-no-go`)

Évaluation finale : note d'opportunité à destination d'un sponsor, comportant
hypothèses, bénéfices attendus, coûts, dépendances, critères d'arrêt et niveau
d'incertitude.

Contribution au dossier : note d'opportunité et cadre de mesure.

Réemploi : les indicateurs nourrissent le plan d'évaluation, puis le tableau de
bord opérationnel.

### Étape 4 — Concevoir et piloter la réalisation

- Slug cible : `piloter-realisation-ia`
- Charge indicative : 6 h 30
- Finalité : organiser un passage progressif de l'expérimentation à la
  production en intégrant l'évaluation d'un système génératif.

Module `du-poc-a-la-production` — Pilotage sous incertitude

- Adapter Agile aux incertitudes d'un projet IA
  (`adapter-agile-incertitude-ia`)
- Distinguer expérimentation, PoC, pilote et production
  (`distinguer-experimentation-poc-pilote-production`)
- Construire gouvernance projet, roadmap et backlog
  (`construire-gouvernance-roadmap-backlog`)

Module `conception-et-evaluation-genai` — Assistant, RAG et critères

- Cartographier un assistant fondé sur la recherche documentaire
  (`cartographier-assistant-rag`)
- Évaluer qualité, sécurité, coût et expérience utilisateur
  (`evaluer-qualite-securite-cout-experience`)

Évaluation finale : projet produisant charte, jalons, responsabilités,
architecture fonctionnelle, protocole d'évaluation et critères de passage au
pilote.

Contribution au dossier : dispositif de pilotage et plan d'évaluation.

Réemploi : les composants et fournisseurs cartographiés alimentent l'analyse
de risque et le périmètre du SGIA.

### Étape 5 — Maîtriser les risques, la conformité et la sécurité

- Slug cible : `maitriser-risques-conformite`
- Charge indicative : 6 h 30
- Finalité : transformer des préoccupations générales en scénarios, décisions,
  contrôles et responsabilités vérifiables.

Module `analyse-risques-ia` — Scénarios et traitement

- Construire des scénarios et un registre des risques
  (`construire-scenarios-registre-risques`)
- Évaluer impacts, vraisemblance et incertitude
  (`evaluer-impacts-vraisemblance-incertitude`)
- Choisir traitements, propriétaires et preuves
  (`choisir-traitements-proprietaires-preuves`)

Module `cadre-europeen-et-securite-genai` — Responsabilités et contrôles

- Situer RGPD, règlement européen sur l'IA et responsabilités
  (`situer-rgpd-reglement-ia-responsabilites`)
- Sécuriser les données et l'application générative
  (`securiser-donnees-application-generative`)
- Conduire la diligence fournisseur et préparer la réversibilité
  (`conduire-diligence-fournisseur-reversibilite`)
- Concevoir supervision humaine et mécanismes d'escalade
  (`concevoir-supervision-humaine-escalade`)

La diligence fournisseur couvre notamment la localisation et l'utilisation des
données, les responsabilités contractuelles, les sous-traitants, les changements
de modèle ou de service, la portabilité, la réversibilité et le plan de sortie.

Évaluation finale : étude de cas imposant de prioriser les risques, de proposer
des traitements proportionnés et de signaler les décisions nécessitant une
expertise juridique, sécurité ou protection des données.

Contribution au dossier : registre des risques, plan de traitement et matrice
de responsabilités.

Réemploi : ces risques et preuves sont intégrés au système de management de
l'étape 6.

### Étape 6 — Mettre en œuvre un SGIA inspiré d'ISO/IEC 42001

- Slug cible : `mettre-en-oeuvre-sgia`
- Charge indicative : 7 h 30
- Finalité : traduire les objectifs et risques de l'organisation en un système
  de management gouvernable, documenté, évalué et améliorable, au moyen d'une
  construction guidée et explicitement étayée.

Module `concevoir-sgia` — Contexte, gouvernance et planification

- Définir contexte, périmètre, politique et objectifs
  (`definir-contexte-perimetre-politique-objectifs`)
- Organiser rôles, compétences, communication et inventaire
  (`organiser-roles-competences-inventaire`)
- Planifier risques, impacts, contrôles et preuves
  (`planifier-risques-impacts-controles-preuves`)

Module `operer-et-ameliorer-sgia` — Processus et boucle de management

- Documenter cycle de vie, données et fournisseurs
  (`documenter-cycle-vie-donnees-fournisseurs`)
- Évaluer performance, conduire l'audit interne et préparer la revue
  (`evaluer-performance-audit-interne-revue`)
- Traiter écarts et améliorer le système
  (`traiter-ecarts-ameliorer-sgia`)

Évaluation finale : atelier guidé de construction produisant un périmètre, une
gouvernance cible, une première matrice de couverture, un registre de preuves
et une feuille de route d'implémentation priorisée. Des canevas et points de
contrôle restent fournis afin d'apprendre la méthode.

Contribution au dossier : architecture du SGIA et roadmap de mise en œuvre.

Réemploi : le SGIA encadre le déploiement, la surveillance et l'amélioration
des étapes 7 et 8.

### Étape 7 — Déployer, faire adopter et surveiller

- Slug cible : `deployer-adopter-surveiller`
- Charge indicative : 5 h 30
- Finalité : préparer un lancement maîtrisé, mesurer l'usage réel et savoir
  corriger, suspendre ou retirer le système.

Module `mise-en-production-et-adoption` — Passage en usage réel

- Préparer la décision et les conditions de mise en production
  (`preparer-decision-mise-en-production`)
- Conduire adoption, formation et changement
  (`conduire-adoption-formation-changement`)

Module `surveillance-et-amelioration` — Valeur, risque et incident

- Surveiller valeur, qualité, coûts et risques
  (`surveiller-valeur-qualite-couts-risques`)
- Gérer incident, changement et retrait
  (`gerer-incident-changement-retrait`)

Évaluation finale : simulation d'un comité de lancement suivie d'un incident
fictif. L'apprenant doit décider, communiquer et mettre à jour le dispositif de
contrôle.

Contribution au dossier : plan de déploiement, tableau de bord, procédure
d'incident et plan d'amélioration.

Réemploi : les preuves opérationnelles alimentent la soutenance finale.

### Étape 8 — Conduire une mission de Lead Implementer

- Slug cible : `mission-lead-implementer`
- Charge indicative : 6 h 30
- Finalité : intégrer les décisions du parcours dans une mission cohérente et
  défendable, puis consolider les connaissances utiles à une certification
  personnelle orientée implémentation.

Module `integration-autonome-et-preparation` — Vérifier et arbitrer

- Vérifier la cohérence du dossier SGIA
  (`verifier-coherence-dossier-sgia`)
- Arbitrer les écarts et les actions correctives
  (`arbitrer-ecarts-actions-correctives`)
- Préparer la revue et l'audit de certification de l'organisation
  (`preparer-revue-audit-organisation`)

Module `soutenance-et-consolidation` — Décider et expliquer

- Défendre le dossier devant un comité de direction
  (`defendre-dossier-comite-direction`)
- Consolider les acquis de type Lead Implementer
  (`consolider-acquis-lead-implementer`)

Évaluation finale du programme : cas intégrateur autonome, sans canevas pas à
pas. À partir du dossier construit et de nouveaux écarts imposés, l'apprenant
doit vérifier la cohérence du dispositif, prioriser les actions correctives,
produire une synthèse écrite et défendre ses arbitrages lors d'une soutenance
exécutive avec objections. Un quiz cumulatif distinct consolide le vocabulaire,
la logique de management, l'application des exigences et la gestion des risques
sans reproduire de questions d'examen protégées.

Contribution au dossier : version finale, synthèse exécutive et plan des
prochaines actions.

## 8. Progression du dossier cumulatif

| Étape | Décision principale | Artefact évalué |
| --- | --- | --- |
| 1 | Quel est le véritable besoin ? | Compte rendu de découverte |
| 2 | Quel cas d'usage mérite d'être étudié ? | Portefeuille priorisé |
| 3 | Faut-il poursuivre et comment mesurer ? | Note d'opportunité |
| 4 | Comment expérimenter et piloter ? | Charte, roadmap et plan d'évaluation |
| 5 | Quels risques accepter, traiter ou escalader ? | Registre et plan de traitement |
| 6 | Quel système de management mettre en place ? | Diagnostic et roadmap SGIA |
| 7 | Peut-on lancer, surveiller et réagir ? | Plan de déploiement et d'exploitation |
| 8 | Le dispositif est-il cohérent et défendable ? | Dossier final et soutenance |

Chaque artefact peut être corrigé après feedback. La version finale montre les
révisions et justifie les décisions modifiées ; elle ne masque pas les erreurs
initiales.

## 9. Stratégie d'évaluation

### 9.1 Diagnostic initial

Le programme commence par un diagnostic non certificatif portant sur gestion
de projet, IA générative, gouvernance, risque et vocabulaire des systèmes de
management. Il adapte les recommandations de révision, sans supprimer les
évaluations obligatoires.

### 9.2 Niveau leçon

- Toute notion obligatoire possède une mini-évaluation.
- Un quiz de leçon consolide plusieurs notions seulement lorsqu'il ajoute une
  intention distincte.
- Une ressource consultée ne valide aucune notion.
- Une activité productive est un exercice, pas une tâche binaire dupliquée.
- Le feedback détaillé apparaît après soumission et indique critères satisfaits,
  lacunes, arbitrages recevables et limites.

### 9.3 Niveau étape

Chaque étape possède une évaluation finale avec un seuil proposé de 70 %. Les
formes cibles sont :

| Étape | Type seed cible | Production |
| --- | --- | --- |
| 1 | `simulation` | Entretien et note de reformulation |
| 2 | `case_study` | Portefeuille priorisé |
| 3 | `written_assignment` | Note d'opportunité |
| 4 | `project` | Dispositif de pilotage |
| 5 | `case_study` | Analyse et traitement des risques |
| 6 | `project` | Diagnostic et roadmap SGIA |
| 7 | `simulation` | Comité de lancement et incident |
| 8 | `simulation` | Dossier et soutenance finale |

Une remédiation cible les notions ou artefacts insuffisants avant nouvelle
tentative. Les tentatives sont conservées.

### 9.4 Rubrique finale proposée

| Critère | Poids |
| --- | ---: |
| Cadrage du besoin, valeur et faisabilité | 20 % |
| Pilotage, architecture fonctionnelle et évaluation | 20 % |
| Gouvernance et mise en œuvre du SGIA | 25 % |
| Risques, conformité, sécurité et supervision | 20 % |
| Communication exécutive et amélioration | 15 % |

La grille détaillée devra décrire des comportements observables. Une mention
de norme ou un document volumineux ne rapporte aucun point s'il n'éclaire pas
une décision.

## 10. Flow pédagogique des futures leçons

Le moteur ne doit jamais regrouper automatiquement tous les contenus puis tous
les exercices. Chaque `PEDAGOGY_SPEC` authorera une séquence adaptée à la
notion. Un cycle courant, non obligatoire, sera :

```text
CONTENT — situation et question professionnelle
→ CONTENT — apport ciblé
→ RESOURCE — lecture ou outil guidé au point d'usage
→ CONTENT — exemple d'entreprise analysé
→ EXERCISE — production ou décision
→ CONCEPT_ASSESSMENT — validation de la notion
→ CONTENT — synthèse ou transfert
→ QUIZ — consolidation lorsque justifiée
```

Règles spécifiques au programme :

- les ressources obligatoires précisent objectif, périmètre, consigne, durée,
  langue, accès et alternative ;
- les documents normatifs ne sont jamais reproduits au-delà de leur licence ;
- les sources justifiant le cours restent attachées au bloc soutenu et ne sont
  pas placées dans la progression ;
- les exemples du cas Asteria sont marqués comme fictifs ;
- les contenus réglementaires portent une version et une date de vérification ;
- les consignes distinguent ce que le consultant peut décider, recommander ou
  doit escalader ;
- aucune correction ne révèle la réponse avant soumission ;
- chaque production du dossier est réutilisée à un niveau de difficulté
  supérieur.

## 11. Sources, ressources et contraintes de licence

### 11.1 Références et repères de cadrage

Ces références définissent la couverture générale du blueprint. Elles ne
sourcent pas à elles seules les futures leçons, qui exigeront des localisateurs
précis dans leurs sidecars.

1. Repère bibliographique non utilisé comme preuve d'authoring : International
   Organization for Standardization. (2023).
   *ISO/IEC 42001:2023 — Information technology — Artificial intelligence —
   Management system*. Édition 1, décembre 2023.
2. Repère bibliographique non utilisé comme preuve d'authoring : International
   Organization for Standardization. (2023).
   *ISO/IEC 23894:2023 — Information technology — Artificial intelligence —
   Guidance on risk management*. Édition 1, février 2023.
3. Tabassi, E. (2023). *Artificial Intelligence Risk Management Framework
   (AI RMF 1.0)*. National Institute of Standards and Technology.
   https://doi.org/10.6028/NIST.AI.100-1
4. Autio, C., Schwartz, R., Dunietz, J., Jain, S., Stanley, M., Tabassi, E.,
   Hall, P., & Roberts, K. (2024). *Artificial Intelligence Risk Management
   Framework: Generative Artificial Intelligence Profile*. NIST AI 600-1.
   https://doi.org/10.6028/NIST.AI.600-1
5. Parlement européen et Conseil de l'Union européenne. (2024). *Règlement
   (UE) 2024/1689 établissant des règles harmonisées concernant l'intelligence
   artificielle*. Journal officiel de l'Union européenne.
   Version consolidée au 27 juillet 2026 :
   https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A02024R1689-20260727
6. Commission nationale de l'informatique et des libertés. (2025).
   *Développement des systèmes d'IA : les recommandations de la CNIL pour
   respecter le RGPD*.
   https://www.cnil.fr/fr/developpement-des-systemes-dia-les-recommandations-de-la-cnil-pour-respecter-le-rgpd
7. Commission nationale de l'informatique et des libertés. (s. d.).
   *Les questions-réponses de la CNIL sur l'utilisation d'un système d'IA
   générative*.
   https://www.cnil.fr/fr/les-questions-reponses-de-la-cnil-sur-lutilisation-dun-systeme-dia-generative
8. OWASP Foundation. (2024). *OWASP Top 10 for LLM Applications 2025*.
   OWASP GenAI Security Project.
   https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/
   Édition volontairement figée pour la version 1.0 du parcours ; l’édition
   2026 publiée le 3 août 2026 devra faire l’objet d’une migration éditoriale
   séparée avant publication.
9. Schwaber, K., & Sutherland, J. (2020). *Le Guide Scrum — La définition
   officielle de Scrum*.
   https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-French.pdf
10. AFNOR Certification. (s. d.). *Certification ISO/IEC 42001 — Système de
   management de l'intelligence artificielle*.
   https://certification.afnor.org/numerique/certification-iso-42001
11. Pattison, A. (2025). *Managing AI Risk: A Practical Approach to
    Responsibly Managing AI with ISO 42001*. IT Governance Publishing.

Pages et versions web vérifiées le 9 août 2026. Le NIST indique que l'AI RMF
1.0 est en cours de révision ; toute future spec qui l'utilise devra figer la
version réellement consultée. La taxonomie OWASP 2025 est conservée comme
édition d’authoring ; sa migration vers l’édition 2026 devra revérifier les
catégories, exercices et localisateurs avant publication. Les recommandations
CNIL sur le développement étayent les activités liées aux données et à la
conception ; la FAQ sur l'IA générative étaye les usages et le déploiement. Leur
périmètre ne doit pas être extrapolé.

### 11.2 Norme ISO/IEC 42001

Le titre et l'édition sont conservés comme repères bibliographiques correspondant
à l'objectif déclaré par l'apprenant. Les pages ISO et le texte de la norme ne
sont pas utilisés comme preuves par les contenus authorés par IA. Ils ne sont ni
des ressources apprenant obligatoires, ni des substituts à une lecture autorisée
du texte intégral.

Les leçons qui enseignent une correspondance précise avec des exigences ou
contrôles resteront en brouillon tant que l'équipe ne dispose pas d'un accès
licite à l'édition applicable, du droit de l'utiliser dans le processus
d'authoring et de localisateurs vérifiés. Un exemplaire sous licence ne doit
jamais être transmis à un outil d'IA pour générer ou vérifier les leçons. Toute
correspondance précise avec une clause ou un contrôle doit être établie par une
personne compétente disposant des droits nécessaires, par une autorisation
explicite ou à partir d'une source publiquement réutilisable. Le texte de la
norme, les tableaux et les questions d'un organisme certificateur ne seront pas
reproduits.

### 11.3 Livre fourni

Le livre d'Andrew Pattison sert de ressource secondaire pour la stratégie de
risque, l'identification des risques, le développement d'un SGIA et
l'amélioration continue. Avant de l'ajouter comme ressource apprenant, il faut
vérifier :

- l'accès licite de l'apprenant ;
- l'édition et le statut de la traduction française fournie ;
- les pages exactes demandées ;
- la cohérence de la terminologie française avec les références officielles ;
- une alternative pour toute lecture obligatoire difficile d'accès.

Le livre ne justifie pas seul une exigence normative, réglementaire ou une
affirmation technique sensible.

## 12. Limites et garde-fous

Le programme :

- ne garantit ni réussite à un examen ni certification d'une organisation ;
- ne forme pas un auditeur tierce partie ;
- ne remplace pas un conseil juridique, un DPO, un RSSI ou un expert métier ;
- ne forme pas au développement approfondi de modèles de machine learning ;
- ne traite pas un score de risque comme une vérité objective ;
- ne présente pas ISO/IEC 42001 comme une preuve automatique de conformité au
  règlement européen sur l'IA ;
- n'autorise pas l'usage de données confidentielles réelles dans les exercices ;
- n'invente pas de jurisprudence, de calendrier réglementaire, de clause ou de
  question d'examen.

Une actualisation réglementaire et documentaire est obligatoire avant chaque
publication ou nouvelle cohorte.

## 13. Compatibilité LearnX et prochaines portes de validation

Ce blueprint reste compatible avec :

- la hiérarchie `Program > Stage > Module > Lesson` ;
- les types actuels de contenu, ressource, tâche, exercice, quiz et évaluation ;
- la séquence inter-types explicitement authorée ;
- une évaluation finale obligatoire par étape ;
- la distinction entre références éditoriales et ressources apprenant ;
- la publication personnelle sans validation scientifique, sous réserve des
  contrôles éditoriaux et techniques obligatoires.

Aucune modification de Prisma, de l'API, du backlog ou du moteur n'est requise
par le blueprint.

Les portes suivantes encadrent la production :

1. validation par Rayan de la finalité, des huit étapes et du cas fil rouge —
   réalisée le 9 août 2026 ;
2. création des huit étapes avec leurs `PEDAGOGY_SPEC` et évaluations finales —
   réalisée en brouillon le 9 août 2026 ;
3. retour de Neil sur la charge, le cas et la certification personnelle visée —
   à obtenir avant de figer le rythme ;
4. confirmation des droits d'accès et d'utilisation d'ISO/IEC 42001:2023 et du
   livre — requise avant les correspondances normatives détaillées ;
5. revue humaine éditoriale, métier et pédagogique du pilote — requise avant
   publication ;
6. intégration du bundle seed dans LearnX — réalisée en brouillon le 9 août
   2026 ; essai apprenant encore requis ;
7. revue croisée des cartes de preuves et des spécifications — première passe
   structurelle réalisée, validation humaine encore requise ;
8. adaptation finale au programme d'examen lorsque l'organisme est identifié.
