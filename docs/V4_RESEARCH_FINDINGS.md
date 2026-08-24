# Registre des trouvailles — correction assistée V4

## Portée

Ce registre sépare les preuves expérimentales, les décisions produit et les
travaux futurs. Les artefacts bruts et le journal append-only restent
autoritaires ; ce document les rend lisibles sans réinterpréter les verdicts.

## 1. Les seuils doivent respecter l'arithmétique de l'échantillon

Le corpus historique comptait 24 cas × 3 répétitions, soit 72 runs. À cette
taille, un seul premier résultat invalide représente `1/72 = 1,389 %` : un
seuil annoncé à 1 % constituait donc une tolérance réelle de zéro. De même, la
variabilité était quantifiée par 24 cas : deux cas instables donnaient 8,33 %,
trois 12,5 %, sans valeur intermédiaire.

Finding : les gates ultérieurs utilisent des budgets entiers compatibles avec
la taille, ou des intervalles statistiques explicites. Les métriques de sûreté
et les métriques de calibration sont séparées.

## 2. Un faux PASS et un faux FAIL n'ont pas le même risque

Les campagnes ont montré que Sonnet et le composite étaient surtout prudents,
tandis que Mistral produisait des faux PASS. Pour une correction formative
autonome, un résultat trop favorable peut induire l'apprenant en erreur ; un
résultat prudent peut être livré comme incertain ou « à retravailler ».

Finding : sécurité injection, preuves exactes et faux PASS sont des gates
forts ; prudence, abstention et variabilité restent visibles mais ne sont pas
automatiquement assimilées à une sortie dangereuse.

## 3. La livraison partielle évite l'échec tout-ou-rien

La relecture des sorties payées a projeté 212 critères livrables sur 216
(`98,15 %`) sous validation stricte, et 215/216 (`99,54 %`) avec une tolérance
typographique d'un caractère. Aucun workflow n'aurait été entièrement vide.

Décision produit : V4 livre les critères fiables et marque les autres « à
retravailler ». Un critère incertain supprime le score exact global. Le devis
reste entier, avec consentement explicite avant exécution ; le pilote utilise
uniquement des crédits offerts.

## 4. Les examens scellés ont produit des refus utiles

| Examen | Verdict conservé | Ce qu'il a appris |
| --- | --- | --- |
| Campagne générale quatre familles | `REJECTED` définitif | défaut Practice éliminatoire, gold Project contestable, erreurs réelles distinctes des défauts d'étalon |
| Examen avec recommandation interdite | `NO-GO` | mentionner une option pour l'exclure n'est pas la recommander ; une règle d'endorsement doit être préenregistrée |
| Pré-scellement Writing | `NO_GO_PRESEAL_CORPUS` | deux étalons trop sévères et trois fallbacks attribuant une agence absente du dossier |
| Examen Writing final | `NO-GO` | 72 primaires + 6 secondes passes valides, mais 7 faux PASS, 80,19 % d'accord critériel et un écart ordinal de deux niveaux |

L'examen Writing final a coûté `1,551831 USD`, sans erreur transport, retry ou
sortie inutilisable. Son coût et ses bons résultats de sécurité ne compensent
pas ses gates pédagogiques échoués.

## 5. Une garde ancrée sur le modèle ne mesure pas sa clémence

Le runtime déclenchait une seconde passe lorsque le score calculé depuis la
première sortie se trouvait à ±5 du seuil. Si le modèle surévalue déjà la
copie, son propre score peut l'éloigner artificiellement de la bande : le garde
ne se déclenche pas précisément quand la clémence devrait être détectée.

Finding : à l'examen, la garde doit être mesurée contre un gold scellé ; au
runtime réel, elle doit reposer sur des signaux indépendants et ne peut jamais
prétendre connaître le gold absent.

## 6. Bilan sécurité

Sur les campagnes conservées : aucune injection suivie, aucune preuve inventée
présentée comme extrait apprenant et aucune fuite de consigne. Ce bilan soutient
un pilote formatif borné ; il ne prouve ni exactitude pédagogique universelle,
ni maîtrise, ni qualité sur une autre famille ou langue.

## 7. Décision de livraison V4

Rayan autorise une V4 limitée avec la technologie actuelle malgré le NO-GO
scientifique : Sonnet 4.6, writing/fr-FR, faible risque, crédits offerts,
feedback critériel et score seulement indicatif. Le scope est refusé avant
devis pour toute autre famille. Aucun résultat IA n'écrit dans la progression.

Deux défauts sont explicitement surveillés :

1. une violation de contrainte dure peut être décrite sans être reflétée dans
   le niveau du critère ;
2. la garde de seuil actuelle ne détecte pas toute clémence du modèle.

Leur correction, un nouvel examen Writing et toute ouverture payante sont
reportés dans `V4_1_BACKLOG.md`.

## Références locales

- journal : `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` ;
- examen Writing :
  `benchmarks/ai-correction/hybrid/writing-only-fr-v1/exam-verdict.final.json` ;
- pré-scellement :
  `benchmarks/ai-correction/hybrid/writing-only-fr-v1/PRESEAL_REJECTION_REPORT_2026-08-24.md` ;
- identité runtime : `src/server/corrections/promoted-identity.ts` ;
- roadmap courante : `docs/V4_ROADMAP.md`.
