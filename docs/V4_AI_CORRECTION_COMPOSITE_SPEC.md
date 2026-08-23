# V4 — Contrat du pipeline de correction formative composite

- **Version** : 1.0.0
- **Date** : 12 août 2026
- **Statut** : décisions produit et direction artistique validées ; paramètres de
  calibration et valeurs économiques encore inactifs
- **Périmètre** : correctifs d'alignement V4-003 à V4-007, puis V4-009 à
  V4-011 et surfaces V4-016G
- **Autorité** : ce document complète l'ADR 003 et remplace ses formulations
  incompatibles avec l'amendement formatif du 12 août 2026

## 1. Finalité

LearnX fournit une correction formative fondée sur une rubrique authorée. Le
service aide l'apprenant à comprendre sa réponse et à l'améliorer ; il ne rend
pas de verdict académique et ne décide jamais de la progression.

Le pipeline peut employer un correcteur primaire et, sur des cas ciblés, un
vérificateur indépendant. Cette architecture n'est pas un vote entre IA : les
modèles produisent des observations structurées, puis LearnX valide les preuves,
calcule l'appréciation et applique une règle de consolidation versionnée.

## 2. Autorités et invariants

| Élément | Autorité |
| --- | --- |
| Critères, poids et niveaux | Contrat pédagogique publié et snapshoté |
| Niveau proposé par critère | Sortie structurée validée du rôle concerné |
| Citations de la réponse | Validation déterministe LearnX |
| Score et appréciation | Calcul serveur LearnX |
| Déclenchement du vérificateur | Règle serveur versionnée |
| État final de la correction | Consolidateur serveur versionné |
| Progression et achèvement | Moteur de progression existant, indépendant |
| Devis et plafond | Catalogue serveur versionné |
| Réservation, débit et libération | Ledger LearnX |

Invariants bloquants :

1. aucun modèle ne produit ni `PASS`, ni `FAIL`, ni décision de progression ;
2. aucun score reçu d'un modèle ne devient autoritaire ;
3. une faiblesse sur un critère n'abaisse pas un autre critère sauf dépendance
   explicitement authorée dans le contrat ;
4. une preuve apprenant provient exclusivement de la soumission évaluée ;
5. une sortie invalide, une erreur ou un résultat inutilisable n'est ni affiché
   comme correction, ni débité ;
6. le primaire et le vérificateur utilisent le même snapshot de rubrique ;
7. le vérificateur n'accède pas à la sortie du primaire avant de produire sa
   propre analyse ;
8. aucune correction V4 n'est attribuée à un humain ;
9. l'interface ne révèle ni modèle, ni fournisseur, ni token, ni mécanisme de
   vote ;
10. les campagnes historiques restent immuables et ne sont jamais requalifiées
    sous une nouvelle identité de pipeline.

## 3. Sortie attendue d'un rôle modèle

Chaque rôle ne retourne que :

- un niveau authoré et une confiance par critère ;
- un statut de preuve ;
- des extraits exacts de la réponse lorsque la preuve existe ;
- un feedback limité au critère ;
- un feedback général formatif.

Le modèle ne retourne pas : score final, bande d'appréciation, verdict global,
progression, coût, priorité de consommation des crédits ou décision de lancer
une autre analyse.

Le serveur canonicalise la sortie, vérifie l'exhaustivité des critères, résout
les extraits dans la soumission originale, rejette toute preuve provenant du
contexte ou d'une instruction hostile, puis calcule le score et l'appréciation
à partir du contrat snapshoté.

## 4. Identité immuable du pipeline

Une exécution reproductible persiste au minimum :

- identifiant et version du pipeline ;
- versions du protocole, du prompt et du consolidateur ;
- snapshot du contrat pédagogique ;
- rôle `PRIMARY` ou `TARGETED_VERIFIER` ;
- modèle et route fournisseur épinglés pour chaque rôle ;
- profil de requête complet et son empreinte ;
- version de la règle de déclenchement ;
- version de la règle de consolidation ;
- version du catalogue et identifiant du devis ;
- tentatives techniques, identifiants fournisseur, latence, usage et coût réel ;
- résultat brut conservé selon la politique de rétention, résultat canonicalisé
  et motifs de rejet ;
- ventilation de la réservation et écritures de règlement/libération.

Changer un de ces éléments crée une nouvelle identité. Aucun routeur automatique,
alias `latest` ou fallback inter-modèle silencieux n'est autorisé.

## 5. Déclenchement ciblé du vérificateur

Le vérificateur n'est appelé que par une règle serveur préenregistrée. La règle
peut combiner des signaux génériques et mesurables :

- résultat suffisamment proche d'une frontière formative pour qu'un déplacement
  adjacent d'un critère change l'appréciation calculée ;
- critère sensible explicitement déclaré par le contrat ;
- confiance critérielle sous un seuil calibré ;
- avertissement de validation ou de sécurité qui laisse néanmoins une sortie
  exploitable ;
- échantillon aléatoire de contrôle pendant le pilote.

La confiance auto-déclarée ne peut pas être le seul déclencheur. Les seuils,
critères sensibles, taux d'échantillonnage et frontières exactes restent des
paramètres versionnés à calibrer par V4-003 ; ce document n'en invente aucune
valeur.

Une sortie structurellement invalide suit le retry technique décrit ci-dessous,
pas la vérification pédagogique.

## 6. Consolidation sans vote ni moyenne artificielle

Le primaire reste la proposition de correction. Le vérificateur sert à mesurer
sa stabilité, pas à remplacer automatiquement son résultat.

1. **Vérification non déclenchée** : la sortie primaire validée devient une
   correction utilisable calculée par LearnX.
2. **Accord matériel** : si le vérificateur ne révèle aucun écart matériel selon
   la règle versionnée, LearnX conserve la correction primaire et marque la
   vérification comme terminée.
3. **Écart non matériel** : LearnX conserve le résultat primaire, journalise
   l'écart et peut employer un libellé prudent. Il ne moyenne pas les niveaux et
   ne fabrique pas une troisième correction.
4. **Écart matériel** : LearnX publie l'état `UNCERTAIN`, retire tout score exact
   et conserve uniquement les constats compatibles avec les preuves validées.
   Une plage ne peut être affichée que si le serveur la calcule selon un contrat
   versionné.
5. **Aucun résultat exploitable** : état `UNUSABLE`, aucun score, aucune
   appréciation trompeuse et aucun débit.

Un écart matériel inclut nécessairement les écarts définis par la configuration
du pipeline. Ses seuils exacts et les règles permettant de conserver un constat
commun doivent être benchmarkés et validés avant activation ; ils ne sont pas
déduits par le frontend.

## 7. États persistés et libellés humains

Les états techniques minimums sont :

```text
RESERVED → PROCESSING_PRIMARY
  → VERIFYING
  → COMPLETED
  → PROVISIONAL
  → UNCERTAIN
  → RETRY_PENDING
  → UNUSABLE_RELEASED
  → FAILED_RELEASED
```

- `PROVISIONAL` : résultat exploitable mais traitement ou niveau de certitude
  encore incomplet selon le contrat ; ce n'est jamais un verdict scolaire.
- `UNCERTAIN` : analyses matériellement divergentes ; aucun score exact.
- `UNUSABLE_RELEASED` : aucun résultat suffisamment fiable ; aucun débit et
  réservation libérée.

Les transitions exactes seront implémentées et testées côté serveur. Les écrans
utilisent des formulations humaines, jamais les clés seules et jamais la couleur
seule : « Résultat provisoire », « À interpréter avec prudence » et « Correction
indisponible ».

## 8. Retry technique et nouvelle analyse volontaire

Le retry technique :

- réutilise le même rôle, le même modèle, la même route et la même identité ;
- est borné, idempotent, invisible et à la charge de LearnX ;
- ne répare jamais sémantiquement une sortie ambiguë ou deux doublons différents ;
- conserve l'échec initial dans les métriques ;
- libère la réservation si aucun résultat utilisable n'est obtenu.

La nouvelle analyse volontaire est une nouvelle action : nouveau devis, nouvelle
réservation et nouvelle version de correction. Sa structure finale, le nombre
autorisé de demandes et le traitement précis de l'argument de contestation
restent à arbitrer dans V4-011. Elle n'est ni un retry, ni une vérification
automatique incluse.

## 9. Devis, réservation et règlement

L'apprenant accepte un devis unique exprimé en crédits LearnX. Le plafond couvre
le primaire et la vérification ciblée éventuelle. Aucun terme `token` et aucun
nom de modèle n'apparaît.

Après l'exécution :

- LearnX règle le coût facturable réel du workflow utilisable ;
- les retries techniques restent à la charge de LearnX ;
- la différence avec le plafond est libérée immédiatement ;
- le débit ne dépasse jamais le plafond accepté ;
- un échec ou un résultat `UNUSABLE` ne débite rien ;
- un dépassement fournisseur est absorbé, audité et peut déclencher un coupe-circuit.

La ligne synthétique de règlement reste toujours visible après correction. Le
détail est dépliable. Les règles financières exactes, la priorité entre crédit
offert et acheté, les périodes et les montants proviennent exclusivement des
contrats serveur validés.

## 10. Contrat d'interface Atlas validé

Références canoniques :

- architecture et flow annoté :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-correction-flow.html` ;
- surfaces crédits et correction :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-atlas-surfaces.html`.

Décisions fermes :

1. allocation offerte et crédits achetés sont les lignes principales ;
   « Disponible au total » reste secondaire ;
2. le règlement synthétique reste visible et son détail peut être déplié ;
3. les preuves apprenant sont nommées « Extrait de votre réponse » ; les sources
   externes sont séparées sous « Références mobilisées » ;
4. `UNCERTAIN` n'affiche aucun score exact ; une plage n'est affichée que si
   LearnX l'a réellement calculée ;
5. l'ajustement admin utilise un panneau latéral sur desktop et une surface
   plein écran sur mobile, avec récapitulatif avant validation.

La direction reste Atlas : bleu ardoise, laiton rare, surfaces mates et sobres,
aucun vert, aucune esthétique fintech, aucun gradient IA, aucun graphique
décoratif et aucune sur-cardification. Les critères couvrent 320/390 px,
1440/1920 px, zoom 200 %, clavier, focus visible, contrastes WCAG et
`prefers-reduced-motion`.

## 11. Benchmark et gate avant activation

Avant tout nouvel appel facturable, V4-003 doit figer : identité composite,
profils, règle de déclenchement, règle de consolidation, budget et échantillon
de contrôle. Le benchmark compare sur les mêmes cellules : primaire seul,
vérificateur seul et pipeline composite.

Le corpus de développement est exécuté en `24 × 3`. La revue humaine aveugle
couvre tous les écarts matériels, faux résultats, variations et un échantillon
d'accords. Le holdout reste scellé tant que le pipeline n'a pas franchi ce gate.
Les seuils et arbitrages ne sont pas modifiés après lecture du holdout.

Les métriques séparent au minimum : faux positifs et faux négatifs formatifs,
écarts ordinaux, variabilité, preuves invalides, injection, résultat finalement
inutilisable, retry, taux d'appel du vérificateur, latence et coût P50/P75/P90.
Le coût ne départage que des configurations pédagogiquement acceptables.

## 12. Migration depuis les fondations déjà livrées

Le correctif d'alignement doit :

1. conserver les tables, sorties et campagnes historiques sans les réécrire ;
2. déprécier le verdict binaire et la décision de seconde passe issue du modèle
   dans le chemin de production V4 ;
3. ajouter identité composite, rôles, tentatives et règle de consolidation aux
   données persistées ;
4. ajouter les états serveur manquants et leurs transitions autorisées ;
5. adapter le devis à un workflow composite unique ;
6. prouver par tests qu'aucun score IA n'affecte la progression ;
7. laisser le pipeline, les prix et les appels live désactivés jusqu'au GO
   explicite du Propriétaire.

## 13. Arbitrages volontairement différés

Ne sont pas fixés par ce document :

- valeurs financières, parité, prix, plafonds et marge ;
- ordre de consommation entre offert et acheté ;
- périodes, expiration, renouvellement et grâce ;
- bornes et double validation d'un ajustement admin ;
- règles exactes de score, de bande ou de plage ;
- seuils de `PROVISIONAL`, `UNCERTAIN` et `UNUSABLE` ;
- règle finale et nombre de contestations ;
- modèles définitivement promus.

Ces valeurs restent configurables, versionnées et inactives tant que les tickets
responsables et le Propriétaire ne les ont pas validées.
