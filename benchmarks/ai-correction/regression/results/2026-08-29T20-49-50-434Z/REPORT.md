# Run de régression partiel — V4.5-121, 29 août 2026

**Promotion : refusée.** Ce run est **partiel et arrêté par décision du
Propriétaire** ; il ne peut promouvoir aucune identité, et la plupart des gates
n'ont pas de dénominateur suffisant pour être évalués.

- Pool : `learnx-fr-regression-pool-v1`, empreinte `c59a7ba5497b…`
- Profil demandé : `reduced` — 200 cellules
- Cellules exécutées : **49 sur 200**, toutes des cas de base ; **aucun mutant**
- Identité primaire : `claude-sonnet-4-6-openrouter-anthropic`
  (`anthropic/claude-sonnet-4.6`), `maxRetries: 0`
- Vérificateur : **jamais appelé** (voir §4)
- Arrêt : décision `owner-retry-policy-2026-08-29` — inutile de continuer à
  dépenser une fois le gate d'inexploitabilité franchi

Ce rapport mesure ce que 49 cellules permettent de mesurer. Il n'extrapole rien
au pool complet.

## 1. Le seul résultat que ce run établit

| Métrique | Numérateur / dénominateur | Taux | Gate | Statut |
| --- | --- | --- | --- | --- |
| Corrections finalement inexploitables | 3 / 49 | **6,12 %** | ≤ 3 % (bloquant) | **rouge** |

Codes : `MODEL_EVIDENCE_NOT_IN_RESPONSE` ×2, `MODEL_OUTPUT_CONTRACT_INVALID` ×1.

**Échec de transport, pas de qualité.** Aucune de ces trois corrections n'a
produit un niveau faux : elles n'ont produit aucun niveau exploitable. La
distinction compte, parce qu'un lecteur qui voit « 6 % » conclut spontanément
que le modèle se trompe une fois sur seize, ce que ce chiffre ne dit pas.

**Ce gate mesure la politique de reprise autant que le modèle.** L'identité
promue fixe `maxRetries: 0` : une réponse malformée perd la cellule
définitivement, là où une seule reprise l'aurait probablement récupérée. Le
chiffre est donc une propriété de l'identité telle qu'elle est promue
aujourd'hui, et non une propriété du modèle seul.

**Conséquence produit, et non artefact de benchmark.** À ce taux, environ
**un apprenant sur seize** reçoit « indisponible » et un crédit rendu au lieu
d'une correction. C'est exactement le signal que le coupe-circuit de V4.5-140
surveille : `BREAKER_THRESHOLDS.unusable = 0,05` sur une fenêtre glissante de 50
corrections — vérifié dans `src/lib/ai-correction-breaker.ts`, non repris de
mémoire. Les 49 cellules de ce run forment presque exactement une fenêtre de
coupe-circuit, et elles la franchissent. La suite hors ligne et le moniteur de
production concluent ici la même chose, avant qu'aucun apprenant ne le subisse.

La décision qui en découle — passer `maxRetries` de 0 à 1 sur l'identité promue,
avec son coût dans la borne — appartient au Propriétaire et a été prise
(V4.5-124). Ce n'est pas un réglage de seuil : aucun gate n'est retuné sur ce
run.

## 2. Gates non mesurés

Un gate sans dénominateur ne passe pas : il est déclaré non mesuré, jamais vert.

| Gate | Pourquoi |
| --- | --- |
| Violations de direction de mutation | **Aucun mutant exécuté.** Le profil `reduced` place la passe du pool complet en premier ; le run s'est arrêté avant la passe de mutants. Non pas faiblement mesuré : pas mesuré du tout. |
| Dérive de critères non liés | Idem — les oracles de dérive dépendent des mutants. |
| Bascules de deux pas à `HIGH` | Une seule répétition exécutée par cas ; la stabilité exige au moins deux observations du même critère. |
| Accord du vérificateur à `HIGH` | Le vérificateur n'a jamais été appelé (§4). |
| Taux de faux accord du vérificateur | Idem. |
| Part de critères `LOW` | La confiance dépend du verdict du vérificateur ; sans lui, toute distribution publiée serait un artefact du câblage. |
| Preuve inventée présentée | Métrique non branchée (V4.5-121 devait la brancher depuis le résumé existant). |
| Injection suivie ou fuite de canari | Aucun cas d'injection dans les 49 cellules exécutées. |

## 3. Ce qui est mesuré, et son dénominateur réel

**Accord avec l'étalon `MODEL_AUTHORED` — rapporté, jamais bloquant.**

| Famille | Accord critériel | |
| --- | --- | --- |
| writing | 31 / 33 | 93,9 % |
| reflection | 34 / 36 | 94,4 % |
| practice | 30 / 36 | 83,3 % |
| project | 31 / 33 | 93,9 % |
| **Total** | **126 / 138** | **91,3 %** |

Cet étalon a été rédigé par un modèle. Un écart est un signal de dérive, pas une
erreur démontrée ; le contrat qualité §4 interdit explicitement d'en faire un
gate. La famille `practice` est la plus basse des quatre, sur 36 critères — trop
peu pour conclure, assez pour regarder au prochain run.

**Distribution de coût — première mesure réelle, utile à V4.5-114.**

| Mesure | Valeur |
| --- | --- |
| Coût P50 par correction | 0,01904 USD |
| Coût P90 par correction | 0,02284 USD |
| Minimum / maximum | 0,01467 / 0,02546 USD |
| Latence P50 | 1 468 ms |
| Latence P90 | 2 299 ms |

Sur 49 corrections, le coût par correction varie d'un facteur 1,7 seulement.
C'est la première distribution réelle dont dispose la tarification ; elle porte
sur le modèle primaire uniquement, sans part vérificateur.

**Borne contre réel.** La borne du dépôt est délibérément conservatrice — un
jeton par unité de code UTF-16 du prompt, plus une enveloppe de 2 048 jetons,
plus la limite de sortie du profil — et appliquée de la même façon aux deux
moitiés de la facture. Sur ces 49 cellules elle vaut 2,58 USD pour 0,9375 USD
réellement facturés, soit une surestimation d'un facteur **2,8**. Une borne
n'est pas une prévision : elle autorise un run, elle ne le prédit pas.

## 4. Le vérificateur n'a jamais été appelé

Les appels au vérificateur ont lieu **après** la totalité des appels primaires,
au moment de l'analyse, et leurs verdicts ne sont écrits nulle part avant elle.
Ce run s'étant arrêté pendant la phase primaire, aucun appel vérificateur n'a eu
lieu : les 0,9375 USD sont entièrement du modèle primaire.

Deux conséquences, l'une pour ce rapport, l'autre pour la conception :

1. `checkerAgreementAtHigh`, `checkerFalseAgreeRate`, `lowShare` et la
   distribution des confiances sont **irrécupérables** pour ce run sans payer
   une seconde fois. Ils sont déclarés non mesurés plutôt que reconstruits.
2. La forme actuelle — tout le primaire, puis tout le vérificateur — est
   mauvaise pour un run plafonné et interruptible. Les verdicts devraient être
   produits au fil de l'eau et persistés avec les tentatives, pour la même
   raison que les tentatives elles-mêmes le sont désormais : une interruption ne
   doit pas effacer ce qui a été payé.

## 5. Dépense de la nuit et réconciliation

| Poste | Montant | Enregistré |
| --- | --- | --- |
| Run de fumée (`20-05-54-878Z`) | 0,0188 USD | oui |
| Run interrompu (`20-27-32-978Z`) | 0,0165 USD | oui |
| Run dupliqué, tué (`20-49-52-847Z`) | 0,6400 USD | oui |
| Ce run partiel (`20-49-50-434Z`) | 0,9375 USD | oui |
| Run tué par un délai d'attente trop court | ≈ 1,0 USD | **non** |
| **Total** | **≈ 2,61 USD** | |

Le poste non enregistré est une **défaillance de la méthode, pas une
approximation acceptable** : ce run a été tué avant que les tentatives ne soient
persistées, et aucun instantané de l'usage fournisseur n'avait été pris avant
son démarrage. Il ne peut être ni prouvé ni rapproché ; il est déclaré tel quel.
Les deux correctifs qui l'empêchent de se reproduire — persistance incrémentale
et réconciliation bilatérale contre l'usage fournisseur — ont été livrés le même
soir, et le run suivant a laissé une trace exploitable là où celui-ci n'avait
rien laissé.

Trois répertoires `21-02-*` contiennent un préflight sans registre : trois
processus démarrés à quelques secondes d'intervalle, tués avant tout appel,
0 USD. Ils sont conservés au titre de l'append-only et exclus de l'analyse.

## 6. Ce que ce run ne prouve pas

Il ne prouve rien sur la cohérence, la stabilité, la sûreté ni la calibration du
système : les oracles correspondants n'ont pas tourné. Il établit un taux
d'inexploitabilité sur 49 corrections et une distribution de coût sur les mêmes
49. Tout le reste attend le run sur l'identité corrigée par V4.5-124.

Aucun article public n'accompagne ce rapport : un run partiel donne une entrée
de journal, pas une publication.
