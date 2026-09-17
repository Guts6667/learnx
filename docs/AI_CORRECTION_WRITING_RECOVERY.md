# Rubrique explicative étroite — proposition 1.0.0

Statut : **OWNER_REVIEW_REQUIRED**. Reviewer de référence : Rayan.
Cette rubrique expérimentale n'est pas importée par le runtime apprenant.
Langue : français. Le dossier de chaque cas est la seule source de faits ;
il doit fournir faits nécessaires, conclusion causale permise et inconnue
pertinente. Une connaissance extérieure plausible ne comble pas le dossier.

## Trois critères et frontières

| Critère | Trois exigences | Rôles de preuve |
| --- | --- | --- |
| Fidélité au dossier | Faits/valeurs déterminants exacts ; conditions et périmètre conservés ; aucun résultat extérieur présenté comme établi | `claim` |
| Lien explicatif | Action/condition identifiée ; effet explicitement relié ; portée causale autorisée respectée | `cause`, `effect`, `link` |
| Limite de la conclusion | Inconnue nommée ; non supposée résolue ; observation nécessaire proposée | `unknown`, `resolution` |

Pour chaque critère : trois exigences établies = `mastered`, deux = `partial`,
une = `limited`. Une contradiction explicite ou zéro exigence établie avec
preuve complète = `insufficient`. Une exigence dont on ne peut décider la
satisfaction reste `UNCERTAIN` : **aucun niveau affiché**. Une preuve absente
de l'extraction n'est jamais assimilée à une absence dans la réponse.

Le vérificateur se prononce séparément sur chaque exigence et la complétude
des preuves. L'agrégateur calcule la frontière, puis exige l'accord du niveau
primaire avant de restituer. Il n'attribue aucune note globale ni réussite.

## Exemples de développement à revoir avant la campagne

Dossier fictif commun : « Dans deux salles identiques, un répartiteur a
attribué aléatoirement un nouvel écran de réservation à la moitié des séances.
Les réservations abandonnées sont passées de 20 sur 100 séances sans écran à
10 sur 100 avec écran. Aucune autre condition n'a changé. L'écran rend les
créneaux disponibles visibles. Cette comparaison permet une conclusion locale
sur ces séances, pas une généralisation aux autres sites. L'effet dans un
autre site est inconnu ; il faut y répéter la comparaison. »

Ces propositions **ne sont pas des labels validés** et ne rejoignent pas le
holdout. Rayan revoit les frontières et fournit les étiquettes absolues :

- « Ici, 10 séances sur 100 ont été abandonnées avec l'écran contre 20 sans.
  La visibilité des créneaux explique la baisse dans cette comparaison
  contrôlée. On ignore si elle se retrouve ailleurs ; il faut répéter l'essai
  dans un autre site. » — exemple candidat de trois exigences établies.
- « L'écran affiche les créneaux. Les abandons baissent dans les séances
  observées. » — le lien et la portée autorisée doivent être jugés selon les
  frontières ci-dessus ; une extraction superficielle ne doit pas inventer
  ce lien ni transformer une ambiguïté en niveau certain.
- « Les abandons passent de 10 à 20 avec l'écran ; cela prouve que tous les
  sites doubleront leurs abandons. » — contradiction factuelle et dépassement
  explicite de la portée, à distinguer d'un simple manque de détail.
- « L'effet ailleurs reste inconnu. » — la limite est nommée, mais
  l'observation nécessaire n'est pas donnée ; une mention de l'inconnue ne
  suffit pas automatiquement au niveau maximal.

Si ces frontières ne permettent pas des labels reproductibles, modifier la
version avant de sceller le holdout ; ne pas ajuster après les sorties mesurées.

## Entrée de préparation

Fournir un tableau JSON de **30 sources indépendantes**. Chaque source possède
une provenance explicite, un dossier complet, une consigne, les phrases
numérotées de la réponse et deux mutations ciblées. Exemple de structure
(illustratif seulement ; ni dossier complet ni jeu qualifiable) :

```json
[
  {
    "sourceAnswerId": "source-001",
    "provenance": "Origine de cette réponse et date de collecte",
    "dossier": "Faits, portée causale et inconnue explicitement fournis",
    "instruction": "Expliquer le résultat et sa limite à partir du dossier.",
    "sentences": [{ "id": "s1", "text": "Réponse complète à revoir." }],
    "mutations": [
      {
        "kind": "FACT_INVERSION",
        "targetCriterion": "source-fidelity",
        "description": "Fait précis inversé ; le reste est conservé.",
        "sentences": [{ "id": "s1", "text": "Réponse avec le fait inversé." }]
      },
      {
        "kind": "EVIDENCE_DELETION",
        "targetCriterion": "mechanism-link",
        "description": "Lien précis supprimé ; le reste est conservé.",
        "sentences": [{ "id": "s1", "text": "Réponse restante." }]
      }
    ]
  }
]
```

Répartir les suppressions entre lien explicatif et limite pour couvrir les
trois critères ; revoir que les mutations ne modifient pas involontairement
le dossier ou un autre critère. Trente réécritures d'une même réponse ne sont
pas trente sources indépendantes. Le validateur repère les duplications
textuelles, mais l'indépendance sémantique exige l'attestation de Rayan.

```bash
pnpm ai:recovery prepare /chemin/30-sources.json /chemin/nouveau-pack
pnpm ai:recovery lock /chemin/nouveau-pack/pack.json /chemin/reference.json /chemin/reference.lock.json
pnpm ai:recovery evaluate /chemin/nouveau-pack/pack.json /chemin/reference.json /chemin/reference.lock.json /chemin/run.json /chemin/nouveau-rapport.json
```

`review.blind.json` masque les variantes et groupes. Rayan renseigne les
90 lignes absolues et les rôles de phrases de `reference.draft.json` ;
`REVIEW_REQUIRED` doit être remplacé par un niveau ou `null` explicitement
incertain. Les dix cas de `retest.blind.json` sont jugés lors d'une seconde
passe sans consulter les réponses précédentes. Conserver le fichier de
référence hors de la vue pendant ce retest : les IDs permettent de recoller
les résultats, pas de masquer automatiquement les anciens labels.

Les désaccords du retest sont conservés comme groupe d'incertitude au niveau
source × critère, y compris ses mutations. Ils restent au dénominateur ; tout
niveau affiché sur ce groupe bloque le pilote. Rayan renseigne la date UTC,
l'approbation de rubrique et les attestations. La commande `lock` valide et
empreinte les entrées ; committer pack, référence et lock avant les mesures.
La commande `evaluate` consomme le lock réel ; le run reprend son empreinte
`lockHash` et exactement son `lockedAt` dans `referenceLockedAt`. Les textes
du pack sont revérifiés au verrouillage, même après une édition manuelle.
Les attestations et dates sont auditables, pas des signatures cryptographiques
du propriétaire ni une preuve automatisée de l'ordre réel de lecture.

## Mesure et décision

Le schéma `recoveryRunSchema` décrit les sorties importées : deux bras,
90 cas × 3 répétitions par bras, identité des deux modèles, empreinte du prompt,
coût connu ou `null`, request IDs et empreinte de la requête aveugle exacte.
Un vérificateur sans request ID conservé laisse son bras `UNMEASURED`, même
si son coût est connu ; aucune identité de requête n’est inventée. Le taux
`structuralEvidenceCheckRate` mesure les contrôles structurels de livraison,
pas le rappel sémantique de toutes les preuves de référence.
Ne jamais remplir ce fichier avec des sorties inventées. Le chemin payant de
ce nouveau protocole doit utiliser le garde de budget partagé, après revue du
dossier et autorisation d'une enveloppe. Il n'est pas lancé par ces commandes.

Le rapport sépare preuve fournie / extraction complète et groupe les erreurs
par source. Il conserve les abstentions, répétitions, coûts inconnus et
incertitudes. Le plafond exige zéro niveau affiché erroné et au moins 70 %
de critères utilisables. Les rapports des gates de sécurité restent à relier
et examiner ; un hash seul ne les valide pas. Tout PASS numérique renvoie
`SAFETY_AND_RELEASE_REVIEW_REQUIRED`, jamais « pilote ouvert ».

Les temps de fonction, flags effectifs, interruptions, règlements rejoués,
monitoring et rollback relèvent ensuite de la recette QA. Aucun changement
d'identité de production n'est induit par ce composant expérimental.


La complétude d'extraction est aussi rapportée contre les témoins sélectionnés
par Rayan : chaque rôle doit retrouver tous les IDs de phrases attendus.
Une preuve équivalente mais différente peut être valide ; ce compteur de rappel
ne la juge pas fausse et n'ajoute aucun niveau. Les rôles sans témoin de
référence sont non mesurables, avec dénominateur explicite. `sources.private.json`
conserve provenance et intention des mutations hors du matériel de revue aveugle.

Baseline d'ingénierie : primaire `anthropic/claude-sonnet-4.6`, vérificateur
`mistralai/mistral-medium-3-5`, identités épinglées existantes. Aucun résultat de
ce protocole ne les modifie implicitement.

Le rapport donne également les niveaux dérivés du vérificateur **avant**
comparaison avec le grade primaire, avec leurs propres erreurs et abstentions.
Le bras sur preuves fournies mesure ainsi la vérification elle-même, sans
qu'un désaccord du primaire puisse masquer ses erreurs derrière une abstention
d'affichage. La décision de livraison reste séparée.


## Runner du protocole (aucun appel sans `--execute`)

`pnpm ai:recovery:measure` prépare par défaut un manifeste hors ligne à partir
du pack revu, de la référence, du verrou réel, d'un rapport de sécurité joint
et de plafonds de prix sourcés. Les drapeaux prennent la forme `--nom=valeur` :

```bash
pnpm ai:recovery:measure --pack=/chemin/pack.json --reference=/chemin/reference.json --lock=/chemin/reference.lock.json --safety-report=/chemin/rapport-securite.json --price-caps=/chemin/plafonds-prix.json --out=/chemin/nouveau-preflight
```

Le JSON de plafonds contient `primary` et `verifier`, chacun avec
`promptUsdPerToken`, `completionUsdPerToken`, `source` et `recordedAt` UTC.
Ce sont des plafonds explicites appliqués au transport, jamais des prix actuels
inventés. Le manifeste conserve les modèles, routes, profils effectivement
émis, schémas et empreintes de prompts. Le nouveau profil est expérimental et
ne change pas l'identité du runtime de production.

Une mesure autorisée ajoute `--execute`, `--decision-id`, `--envelope-usd` et
`--run-cap-usd`, avec un nouveau répertoire de sortie. Exporter uniquement la
clé fournisseur nécessaire, sans sourcer une `.env`. Le verrou/enveloppe est
commun aux worktrees et aux nouveaux probes. Chaque appel réserve son coût
maximal avant envoi et conserve coût/request ID même si la sortie est invalide.
Deux appels de smoke vérifient d'abord transport/profil/schéma ; puis au plus
1 080 appels produisent 540 observations (90 cas × 3 répétitions × 2 bras).
Le smoke est facturé séparément des observations mesurées ; il reste inclus
dans le coût de campagne et ses plafonds.

Un coût inconnu, une réponse incompatible, une interruption ou un dépassement
arrête la mesure ; le journal de dépense et les résultats partiels restent
conservés. Aucun retry ni resume implicite. Le répertoire est créé exclusivement,
les événements et observations sont append-only et chaque checkpoint est
nouveau. Un processus tué peut laisser un verrou à réconcilier manuellement.

Le runner importe le rapport de sécurité avec `UNREVIEWED_APPLICABILITY` :
il ne confond jamais un fichier joint avec des gates passés. La preuve sur
l'ancien checker n'établit pas la qualité du nouveau prompt de vérification.
Le pilote exige encore la revue des gates applicables à cette identité exacte,
la recette cible et le GO propriétaire. Ni `run.json` ni le runner ne publient
une rubrique, ne changent une identité ou n'écrivent dans la progression.


Un niveau affiché sur un critère incertain bloque le pilote, mais le rapport
le compte séparément d'une erreur contre un label déterminé. Les cases non
mesurées sont séparées des abstentions observées, tout en restant dans le
dénominateur de couverture. Ces distinctions évitent de transformer une
ambiguïté de référence ou une interruption en erreur sémantique inventée.
