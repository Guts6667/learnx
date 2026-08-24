# ADR 003 — Correction IA, financement et frontières de confiance

- **Statut** : accepté pour l'architecture V4
- **Date** : 11 août 2026
- **Ticket** : V4-001
- **Décideur final** : Propriétaire LearnX
- **Consultations intégrées** : Produit & pédagogie, sécurité/exploitation et
  Finance & Pricing selon le backlog V4 1.0.1
- **Portée** : architecture et stratégie de migration uniquement

> **Addendum du 16 août 2026.** Les frontières serveur, ledger, réservation,
> idempotence et réconciliation de cet ADR restent autoritaires. En revanche,
> ses passages où le modèle choisit un niveau, où un score est recalculé depuis
> une sortie sémantique ou où une seconde passe est prévue sont historiques et
> supersédés par `docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`. Le modèle propose
> désormais seulement des relations candidates sur des spans LearnX ; elles ne
> peuvent alimenter score, niveau, maîtrise ou progression.

> **Réconciliation du 22 août 2026.** Le protocole evidence-assist 3.0 est
> l'unique autorité sémantique active. `EXPLICITLY_REFUTED` est un statut
> atomique canonique du successeur, décidé par les règles LearnX et jamais par
> une relation modèle seule. L'ancien pipeline composite, son modèle primaire et
> sa seconde passe sont `SUPERSEDED_HISTORICAL` : ils ne décrivent aucun chemin
> exécutable ou financement courant. Le gate Q1 Gemini 3.6 est clos en NO-GO
> technique après un HTTP 400 ; son autorisation est consommée, son coût reste
> à réconcilier et aucun pipeline n'est promu. Toute remédiation est hors ligne
> sous une nouvelle identité et exige ensuite Finance et un nouveau GO.

## 1. Contexte

LearnX corrige aujourd'hui de manière déterministe les quiz et les
mini-évaluations, conserve des productions textuelles d'exercices et permet une
revue des évaluations finales d'étape. V4 doit ajouter une correction assistée
par IA pour certaines productions libres, puis une économie d'usage fondée sur
des crédits LearnX. Cette évolution introduit simultanément des risques
pédagogiques, financiers, de confidentialité et d'exploitation.

Cette décision part de la baseline effectivement livrée après V3.5 :

- les identités, sessions, rôles et capacités sont contrôlés côté serveur ;
- les programmes, inscriptions et progressions sont multi-utilisateurs ;
- les soumissions d'exercice sont isolées par utilisateur, exercice et reprise
  de module ;
- les tentatives déterministes et les soumissions restent historisées ;
- le serveur calcule score, validation et progression ;
- les événements administratifs sont idempotents et ne peuvent pas contenir
  de métadonnée dont la clé évoque un secret, un mot de passe ou un token ;
- aucune table de correction IA, de devis, de réservation, de ledger ou de
  paiement n'existe ;
- aucune dépendance OpenRouter ou Revolut n'est installée ;
- les capacités `ai.assessment.correct` et `ai.program.generate` sont réservées
  mais ne sont attribuées à aucun rôle.

Le rapport de release V3.5 historique indique encore que sa validation humaine
était en attente sur son ancien commit candidat. La baseline V4 est néanmoins
le commit effectivement promu et validé sur `main`, et non ce candidat ancien.
V4-019 devra réconcilier le rapport de release avec les preuves finales de
production sans réécrire l'historique.

## 2. Forces de décision

L'architecture retenue doit garantir que :

1. le modèle n'invente ni rubrique, ni poids, ni seuil ;
2. une sortie textuelle du modèle n'est jamais directement autoritaire ;
3. aucun appel fournisseur ne peut créer un débit sans réservation valide ;
4. une panne ou un retry ne provoque ni double coût logique, ni double débit ;
5. les données envoyées aux tiers sont minimales et traçables ;
6. les corrections historiques restent reproductibles après changement de
   contrat, de prompt, de modèle ou de prix ;
7. les fonctionnalités IA et paiement peuvent être arrêtées séparément ;
8. le navigateur ne reçoit aucun secret, coût fournisseur ou droit d'écriture
   sur un solde, un score ou une progression ;
9. les données V3 restent lisibles pendant et après le déploiement V4 ;
10. l'ouverture commerciale reste impossible tant que les gates juridiques,
    fiscales, économiques et de rétention ne sont pas levés.

## 3. Inventaire des preuves et ordre de calibration

### 3.1 Corrigé par le moteur déterministe existant

Ces activités restent hors IA et ne consomment aucun crédit :

- quiz `TRUE_FALSE`, `SINGLE_CHOICE` et `MULTIPLE_CHOICE` ;
- mini-évaluations de notion équivalentes ;
- réponses courtes comparables à une liste explicite de réponses acceptées ;
- tâches binaires de lecture, visionnage, écoute ou checklist ;
- consultation d'une ressource ;
- activité sans production libre et sans contrat de correction publié.

### 3.2 Pilote V4A : exercices textuels libres

L'ordre initial de calibration est :

1. `WRITING` ;
2. `REFLECTION` ;
3. `PRACTICE` lorsque la preuve attendue est textuelle ;
4. `PROJECT` lorsque la preuve évaluée est entièrement textuelle.

Une valeur d'énumération ne suffit pas à rendre un exercice éligible. Il faut
un contrat publié et compatible, une production `contentMarkdown`, une rubrique
authorée et un corpus étalon approuvé. Les soumissions antérieures restent
inchangées et ne sont jamais corrigées rétroactivement sans demande explicite.

### 3.3 V4B : évaluations finales d'étape textuelles

Après preuve de fiabilité sur les exercices, les types suivants peuvent être
calibrés si leur preuve est strictement textuelle :

- `WRITTEN_ASSIGNMENT` ;
- `CASE_STUDY` ;
- `PROJECT` ;
- `PRACTICAL_EXERCISE` ;
- `SIMULATION` documentée ;
- `CUMULATIVE_EXAM` à réponses libres.

`ORAL`, fichiers, images, audio, vidéo et preuves multimodales restent hors
runtime V4. Un contrat pourra réserver ces catégories sans les activer.

### 3.4 Revue humaine historique

Le schéma actuel permet à un propriétaire autorisé de revoir une évaluation
d'étape et d'enregistrer score et feedback. V4 n'efface pas ces données. Les
revues historiques restent lisibles et auditables, mais aucune nouvelle
correction opérationnelle V4 ne peut être créée ou remplacée par un membre, un
créateur ou un administrateur. La désactivation du flux d'écriture concerné
sera livrée avec le moteur persistant et l'ouverture des évaluations V4B, pas
dans cet ADR.

## 4. Options examinées

### 4.1 Accès aux modèles

| Option | Avantages | Risques | Décision |
| --- | --- | --- | --- |
| Appel direct depuis le navigateur | Mise en œuvre courte | Clé exposée, budget et modèle manipulables, fuite de données | Rejetée |
| SDK direct pour chaque fournisseur | Contrôle fin | Couplage, tarification et erreurs fragmentés | Rejetée comme architecture principale |
| Adaptateur serveur OpenRouter remplaçable | Point de contrôle unique, modèles épinglés, usage normalisé | Dépendance à un intermédiaire supplémentaire | Retenue |
| Routeur automatique ou alias `latest` | Disponibilité apparente | Résultat non reproductible, changement silencieux | Rejetée |

OpenRouter est appelé exclusivement par un adaptateur serveur. Les modèles et
fournisseurs sous-jacents sont allowlistés et épinglés après benchmark. Le
contrat interne ne dépend pas du format public d'OpenRouter afin de permettre un
remplacement futur.

### 4.2 Contrat pédagogique

| Option | Décision |
| --- | --- |
| Réutiliser la rubrique JSON courante sans version | Rejetée : insuffisant pour reproduire une correction |
| Laisser le modèle déduire critères et score | Rejetée : autorité pédagogique déplacée au fournisseur |
| Contrat versionné, publié et snapshoté par correction | Retenue |

Le contrat publié est immuable. Il porte les critères, poids, niveaux,
attendus, variantes acceptables, erreurs fréquentes, seuil, sources autorisées
et règles mécaniques. Le serveur calcule le score uniquement depuis des
constats mécaniques authorés et indépendants. La sortie evidence-assist ne porte
que `elementKey`, relation candidate et `spanIds`; elle ne peut alimenter ce
calcul.

### 4.3 Comptabilité d'usage

| Option | Décision |
| --- | --- |
| Champ `balance` mutable sur `User` | Rejetée : non reconstructible et sensible aux courses |
| Facturer après l'appel fournisseur | Rejetée : autorise le coût sans fonds garantis |
| Ledger append-only + réservations atomiques + projection de solde | Retenue |

Les montants sont des entiers. L'allocation offerte et les crédits achetés sont
des provenances distinctes. Une projection de solde peut accélérer la lecture,
mais le ledger est l'unique source de vérité et doit permettre une
reconstruction depuis zéro.

### 4.4 Paiement

| Option | Décision |
| --- | --- |
| Saisie ou stockage de carte par LearnX | Rejetée |
| Créditer depuis la page de retour navigateur | Rejetée |
| Checkout Revolut Merchant et webhook serveur signé | Retenue sous réserve de V4-013 et des gates externes |

Le webhook vérifié et idempotent est l'unique autorité de fulfillment. Aucun
paiement réel n'est ouvert par V4-001.

### 4.5 Orchestration distribuée

Une transaction PostgreSQL ne peut pas englober un appel fournisseur. LearnX
utilisera donc une machine d'états persistée : réservation atomique en base,
appel externe idempotent, validation du résultat, puis règlement ou libération
atomique. Un retry reprend l'état persistant ; il ne recrée pas l'opération.

Une file interne ou un worker pourra exécuter les appels, mais ne devient pas
source de vérité. Les états PostgreSQL et leurs clés d'idempotence restent
autoritaires.

## 5. Architecture retenue

### 5.1 Composants

```text
Navigateur authentifié
  └─ demande un devis serveur
       └─ Catalogue de prix versionné
            └─ réservation atomique dans le ledger
                 └─ Orchestrateur de correction
                      ├─ snapshot du contrat et de la soumission
                      ├─ adaptateur OpenRouter côté serveur
                      ├─ brut append-only puis validation de la sortie
                      ├─ résolution serveur des relations candidates
                      ├─ certificat et feedback déterministes
                      └─ règlement ou libération des crédits

Revolut Merchant
  └─ webhook signé → ordre vérifié → attribution append-only
```

### 5.2 Autorités

| Domaine | Autorité |
| --- | --- |
| Identité, capacité et accès | Session et politique serveur LearnX |
| Éligibilité IA | Contrat publié + allowlist serveur |
| Critères, poids et seuil | Contrat pédagogique authoré |
| Relations IA | Candidates seulement ; aucun statut, score, maîtrise ou progression |
| Score | Règles mécaniques authorées côté serveur, indépendantes des relations IA |
| Progression | Moteur de progression LearnX |
| Devis et plafond | Catalogue de prix serveur versionné |
| Solde et débit | Ledger LearnX |
| Coût fournisseur | Usage fournisseur réconcilié côté serveur |
| Paiement confirmé | Webhook Revolut vérifié |
| Remboursement ou ajustement | Écriture compensatoire auditée |

Le frontend affiche les états et demande des transitions. Il ne calcule ni ne
confirme aucune des autorités ci-dessus.

### 5.3 Identités et idempotence

Chaque opération utilise des identités stables distinctes :

- soumission et reprise de module existantes ;
- version du contrat ;
- correction logique ;
- tentative fournisseur du rôle candidate-only courant ;
- devis ;
- réservation ;
- entrée de ledger ;
- génération fournisseur ;
- ordre et événement de paiement.

Les clés d'idempotence sont uniques dans leur domaine et liées à l'utilisateur
et à la ressource autorisée. Une même clé avec un payload différent est un
conflit, pas une nouvelle opération.

## 6. États et transitions

### 6.1 Correction formative evidence-assist

```text
NOT_REQUESTED
  → RESERVED
  → PROCESSING
      → COMPLETED
      → RECONCILIATION_REQUIRED
      → RETRY_PENDING
      → FAILED_RELEASED
```

`CALL_INTENT` et le manifeste assaini sont persistés avant dispatch ; le brut
est persisté avant validation. Une nouvelle analyse volontaire crée une
opération versionnée indépendante. Elle ne remplace pas le premier résultat et
n'a aucun effet sur score, maîtrise ou progression. Les anciens états
`AI_REVIEW_*` et le chemin composite sont conservés seulement pour compatibilité
historique ; ils ne sont pas activables dans le pipeline evidence-assist.

### 6.2 Réservation

```text
CREATED → REJECTED
       └→ RESERVED → SETTLED
                    → RELEASED
                    → EXPIRED_RELEASED
```

Une réservation porte un plafond. Le règlement réconcilie le coût réel de toute
tentative dispatchée et libère immédiatement la différence. Sans résultat
utilisable, tout le montant utilisateur est libéré même si LearnX a supporté un
coût fournisseur.

### 6.3 Paiement

```text
CREATED → PENDING → PAID → FULFILLED
              ├─ FAILED
              └─ EXPIRED

PAID | FULFILLED → REFUND_PENDING → REFUNDED
PAID | FULFILLED → DISPUTED → WON | LOST
```

Les événements désordonnés ou rejoués sont acceptés sans double attribution et
conservés pour réconciliation.

## 7. Frontières de données et confidentialité

### 7.1 LearnX

LearnX conserve les données métier nécessaires à l'historique : soumission,
snapshot du contrat, versions de prompt et modèle, relations candidates,
certificat déterministe, coûts, réservations et références de ledger. Ni score
proposé ni confiance de modèle ne font partie du contrat evidence-assist. Les
prompts et réponses brutes ne sont pas placés dans `AuditEvent.metadata`.

Les journaux techniques contiennent des identifiants internes, statuts,
latences, tailles, modèles, fournisseurs et coûts, jamais :

- e-mail ou identité civile ;
- cookie, token, secret ou clé fournisseur ;
- contenu intégral d'une soumission ou d'un prompt ;
- donnée de carte ;
- réponse brute du modèle.

### 7.2 OpenRouter et fournisseur de modèle

Le payload minimal autorisé contient :

- la production textuelle à corriger ;
- le snapshot du contrat nécessaire ;
- les instructions système versionnées ;
- un identifiant de corrélation pseudonyme sans identifiant utilisateur brut.

Il ne contient pas l'e-mail, le nom, le rôle global, le solde, les autres notes,
les autres programmes ou l'historique non requis. OpenRouter et le fournisseur
de modèle constituent deux destinataires potentiels à déclarer. En production,
les paramètres de non-entraînement et de rétention les plus restrictifs permis
par les contrats retenus sont obligatoires.

La durée exacte de rétention côté LearnX, OpenRouter et fournisseur demeure un
gate externe. Tant qu'elle n'est pas validée et affichée à l'utilisateur, le
rollout production reste fermé.

### 7.3 Revolut Merchant

LearnX transmet uniquement les données nécessaires au Checkout et à la
réconciliation : référence d'ordre opaque, montant, devise, pack versionné et
informations légalement requises. LearnX ne stocke ni numéro de carte, ni
cryptogramme. Les identifiants de paiement sont séparés des journaux IA.

### 7.4 Information utilisateur

Avant confirmation d'une correction, l'interface doit indiquer :

- qu'elle est assistée par IA et ne vaut pas validation humaine, scientifique
  ou professionnelle ;
- quelles catégories de données quittent LearnX et pour quelle finalité ;
- les tiers concernés et la politique de rétention validée ;
- le prix estimé, le plafond, la provenance des crédits et la règle de
  libération ;
- la portée exacte d'un appel evidence-assist et l'absence de seconde passe
  automatique dans le pipeline actif ;
- la voie de contestation et ses éventuels crédits propres.

## 8. Menaces et contrôles

| Menace | Contrôles obligatoires |
| --- | --- |
| Prompt injection dans la soumission | Délimitation des données, contrat système immuable, sortie structurée, aucun outil, validation stricte |
| Exfiltration de données | Payload minimal, pas de contexte inter-utilisateur, egress centralisé, logs expurgés |
| Fuite de clé | Secrets serveur par environnement, rotation, jamais dans bundle/réponse/log |
| Modèle ou fournisseur silencieusement changé | Allowlist et identifiants épinglés, benchmark et gate de promotion |
| JSON tronqué ou non conforme | Échec explicite, aucun score ni progression, libération des crédits |
| Double clic ou retry | Clé d'idempotence et machine d'états persistée |
| Double dépense | Isolation transactionnelle, ledger append-only, contrainte d'unicité, solde non négatif |
| Coût sans réservation | Interdiction d'appel hors réservation, sauf benchmark admin séparé et plafonné |
| Coût fournisseur orphelin | Corrélation génération/opération, alerte et réconciliation, jamais débit silencieux |
| Dépassement de budget | Plafonds utilisateur/action/période/global, kill switch, alerte solde fournisseur |
| Manipulation du score par le modèle | Relations candidates exclues du calcul ; règles mécaniques authorées et transitions allowlistées |
| Replay webhook | Signature, horodatage, identifiant événement unique, ordre persistant et fulfillment idempotent |
| Fausse attribution après redirect | Page navigateur informative ; webhook seul autoritaire |
| IDOR sur correction ou solde | Requêtes filtrées par utilisateur et politique d'accès programme |
| Suspension en cours d'opération | Nouvelles actions bloquées ; opération réservée résolue ou libérée par worker sûr |
| Suppression de compte avec obligations | Politique V6 et gate juridique avant commerce ; aucune suppression de ledger |

## 9. Responsabilités opérationnelles

| Responsabilité | Détenteur |
| --- | --- |
| Authoring du contrat, critères et seuils | Produit & pédagogie |
| Validation du corpus étalon | Produit & pédagogie |
| Adaptateur, sécurité, états et migrations | Développement |
| Sélection et promotion d'un modèle | Développement sur preuves, avec revue pédagogique |
| Catalogue, plafonds et marges | Finance & Pricing avec validation Propriétaire |
| Clés, kill switches, alertes et incidents | Développement / exploitation |
| Conditions Revolut, fiscalité et conformité | Propriétaire avec conseil externe |
| Autorisation finale de rollout | Propriétaire |

Un administrateur peut observer, arrêter, réconcilier et produire une écriture
compensatoire auditée. Il ne peut pas écrire un résultat pédagogique à la place
du moteur.

## 10. Stratégie de migration et rollout

### Phase 0 — ADR

Aucun schéma, secret, SDK, appel fournisseur, crédit ou paiement n'est ajouté.

### Phase 1 — Fondations additives

- ajouter contrats versionnés, corrections, passes et snapshots ;
- ajouter ledger, réservations, devis et catalogue sans modifier les tables V3 ;
- ajouter les actions d'audit nécessaires ;
- conserver toutes les fonctionnalités IA désactivées ;
- valider migrations et rollback applicatif sur clone Neon isolé.

### Phase 2 — Dual-read et pilote interne

- les soumissions V3 restent sources de la production utilisateur ;
- les corrections V4 sont des enfants versionnés, jamais des colonnes écrasant
  la soumission ;
- l'absence de correction V4 conserve exactement le comportement V3 ;
- les rubriques existantes sont inventoriées mais ne deviennent pas
  automatiquement des contrats publiés ;
- seuls contrats, modèles et utilisateurs allowlistés peuvent appeler l'IA.

### Phase 3 — V4A

- activer les exercices textuels calibrés avec allocation offerte ;
- conserver paiement et évaluations d'étape désactivés ;
- surveiller qualité, coût, retries, abstentions, sorties inutilisables et
  réservations orphelines.

### Phase 4 — V4B

- ouvrir progressivement les évaluations textuelles après benchmark ;
- ouvrir Checkout et crédits achetés seulement après sandbox, audit, gates
  juridiques/fiscaux et validation Propriétaire.

### Rollback

Le rollback prioritaire est un roll-forward contrôlé :

1. désactiver séparément appels IA, nouvelles réservations et paiements ;
2. laisser le worker régler ou libérer les opérations déjà réservées ;
3. conserver les écritures de ledger et les corrections historiques ;
4. redéployer le code N-1 uniquement si les migrations additives ont été
   vérifiées compatibles ;
5. sinon restaurer conjointement code et branche Neon pré-déploiement pendant
   une fenêtre de maintenance ;
6. ne jamais supprimer ou réécrire un ledger pour simuler un rollback ; utiliser
   des écritures compensatoires.

Chaque promotion de phase exige sauvegarde/branche Neon, rehearsal de migration,
smoke authentifié, vérification des agrégats et procédure d'incident testée.

## 11. Observabilité et arrêt d'urgence

Les métriques minimales sont :

- corrections par état, contrat, modèle et environnement ;
- latences, timeouts, 402/429/5xx et réponses invalides ;
- tokens et coût fournisseur internes, jamais affichés à l'utilisateur ;
- prix estimé, plafond, coût final et montant libéré ;
- réservations expirées ou orphelines ;
- écart entre ledger reconstruit et projection ;
- taux d'abstention, relations non résolues, contestation et résultat
  techniquement indisponible ;
- marge projetée et solde fournisseur ;
- replays et échecs de webhooks.

Les kill switches indépendants couvrent :

1. nouveaux appels IA ;
2. modèle ou fournisseur précis ;
3. nouvelles réservations ;
4. achat de crédits ;
5. fulfillment automatique.

Arrêter un composant ne doit pas masquer l'historique ni empêcher la libération
des fonds réservés.

## 12. Décisions différées et gates bloquants

Les paramètres suivants ne sont pas décidés par cet ADR :

- candidat evidence-assist et éventuel futur falsificateur en campagne
  séparée, choisis par V4-003 après gain mesuré ; aucun composite n'est actif ;
- schéma exact du contrat, livré par V4-002 ;
- coefficients, P90, prix et packs publiables, calibrés par V4-003/V4-007/V4-018 ;
- politique exacte de rétention LearnX/OpenRouter/fournisseur ;
- politique d'anonymisation du corpus étalon ;
- qualification BIC/BNC, TVA, versement libératoire et réserve fiscale ;
- contrat, frais et moyens réellement disponibles sur Revolut Merchant ;
- rétractation, remboursement, litiges et fermeture de compte ;
- domaine applicatif séparé éventuel.

Aucun de ces paramètres ne doit être codé en dur depuis les valeurs
commerciales provisoires du backlog. Leur absence bloque la fonctionnalité
concernée, pas les migrations additives désactivées.

## 13. Conséquences

### Positives

- scores, progression et argent restent sous autorité LearnX ;
- correction et coût sont reproductibles et auditables ;
- le fournisseur est remplaçable ;
- l'historique V3 est préservé ;
- V4A peut être pilotée sans paiement réel ;
- les incidents peuvent être contenus par fonction.

### Coûts et contraintes

- plusieurs états persistants et une réconciliation sont indispensables ;
- aucun appel synchrone « simple » ne peut contourner devis et réservation ;
- le benchmark et l'authoring des contrats précèdent toute correction ;
- la comptabilité append-only exige des écritures compensatoires ;
- V4B dépend de validations externes non techniques.

### Options explicitement rejetées

- appel IA client ;
- score, solde ou prix calculé par le frontend ;
- modèle choisi dynamiquement sans benchmark ;
- rubrique ou seuil inventé par le modèle ;
- correction humaine opérationnelle ;
- paiement crédité depuis un redirect ;
- balance mutable comme source de vérité ;
- suppression des historiques lors d'un rollback ;
- IA pour une activité déterministe ou sans contrat publié.

## 14. Validation de l'ADR

La revue croisée doit confirmer avant V4-002/V4-006 :

- **Produit & pédagogie** : périmètre des preuves, ordre de calibration,
  immutabilité du contrat et absence de correction humaine opérationnelle ;
- **Sécurité/exploitation** : frontières, minimisation, menaces, idempotence,
  kill switches, observabilité et rollback ;
- **Finance & Pricing** : append-only, deux provenances, réservation/règlement,
  absence de solde négatif et séparation coût/prix ;
- **Propriétaire** : acceptation finale et maintien des gates externes.

La validation de cet ADR autorise la conception des tickets dépendants. Elle
n'autorise aucun appel fournisseur, achat, secret, migration ou rollout.
