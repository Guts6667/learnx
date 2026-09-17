# Vérificateur atomique — lecture du run du 10 septembre 2026

Run `2026-09-09T22-50-08-321Z` (22 h 50 UTC, soit 0 h 50 à Paris le
10 septembre), lancé sur le mot du propriétaire. 720 appels, run complet,
**2,5976 USD** réels (l'API a renvoyé le coût de chacun des 720 appels ;
plafond 3 USD respecté ; estimation 1,65 USD dépassée à cause de Kimi, voir
plus bas). Empreintes sha256 (16 premiers caractères) : `ledger.jsonl`
9c6dc62c76c2a8fc, `responses.jsonl` 880143805526be0a, `summary.json`
c10bbdfbae2402c7, `cases.json` ea6a9f48156f01a4, `scoring-key.json`
8e41277aecce5561. Seuils : ceux de la pré-inscription amendée du
8 septembre, écrits avant le premier appel.

## Résultat contre les seuils

| modèle | paires gagnées / 30 | abîmé classé au-dessus | égalités | instables | rejet des abîmées | acceptation des originaux | lecture |
|---|---|---|---|---|---|---|---|
| Mistral medium 3.5 | 10 | 2 | 18 | 9 | 24 / 30 (80 %) | 11 / 30 (37 %) | **stop** |
| Haiku 4.5 | 12 | 3 | 15 | 0 | 25 / 30 (83 %) | 12 / 30 (40 %) | **stop** |
| Sonnet 4.6 | 12 | 7 | 11 | 4 | 18 / 30 (60 %) | 16 / 30 (53 %) | **stop** |
| Kimi K3 | — | — | — | — | — | — | **non mesuré** |

Seuil pour continuer : 27 paires gagnées. Seuil d'arrêt : moins de 24.
Les trois modèles mesurés sont très en dessous. Aucun taux absolu n'atteint
son plancher (86 % et 90 %).

**Kimi K3 n'est pas mesuré.** 124 réponses sur 180 sont vides : le modèle
a dépensé son budget de sortie (400 jetons) en raisonnement interne avant
d'écrire le JSON. C'est un défaut du run, pas un verdict sur le modèle : le
paramètre de raisonnement n'était pas désactivé pour lui. Coût de cette
erreur : 1,07 USD pour 56 réponses lisibles. Le corriger et relancer Kimi
seul coûterait environ 0,30 USD, sur le mot du propriétaire.

## Ce que ça veut dire

**La question absolue posée à une phrase seule ne sépare pas l'original de
l'abîmé.** Dans la majorité des paires, le modèle donne le même verdict aux
deux membres : « la phrase parle du sujet sans nommer le risque
explicitement » pour l'un comme pour l'autre. C'est le miroir exact de la
passe 1 humaine, qui avait dit « oui » aux deux membres dans 20 paires sur
37 : là où l'humain était généreux, les modèles sont sévères, mais ni l'un
ni les autres ne tiennent une frontière absolue d'« établit ». Le
propriétaire n'a retrouvé la différence qu'en comparant (passe 2, 30 / 37).

**Sonnet classe l'abîmé au-dessus de l'original 7 fois.** Deux mécanismes
lus dans ses raisons : une erreur de calcul du modèle (« 27 900 ne dépasse
pas 21 000 »), et la lecture des atomes CHAQUE : une phrase de l'original
qui nomme une inconnue est lue comme contredisant « chaque fait soutient le
choix ». Les atomes universels (ff.a4, cf.a3) sont déjà signalés comme
fragiles depuis le lot 1 du paquet à coller.

**Un signal secondaire, à ne pas sur-lire.** Sur les 12 paires où la
phrase est marquée (strates S1 à S3), Sonnet gagne 8 des 9 paires tranchées,
Haiku 7 sur 8, Mistral 6 sur 6 (p unilatérale 0,02 à 0,035, sur trois tests
et 12 paires : suggestif, pas établi). Sur les 18 paires où le modèle doit
lui-même citer les phrases dans la copie entière (S4 à S6), Sonnet gagne 4
et perd 6, Haiku gagne 5 et fait 11 égalités. La question étroite marche
mieux quand la phrase est donnée, et échoue quand il faut la trouver : ce
second travail est celui de l'extracteur, que cette mesure ne teste pas.
20 paires sur 30 sont gagnées par au moins un modèle, 8 par Haiku et Sonnet
ensemble.

**Accord avec la passe 1 du propriétaire** : 21 à 29 cartes sur 60, soit
le hasard. Les modèles et l'humain ne se trompent pas aux mêmes endroits.

## Conséquence, selon la pré-inscription

Lecture « stop » pour les trois modèles mesurés : la voie « un verdict
absolu, à l'aveugle, sur une phrase, majorité de trois » est fermée au prix
du run, comme prévu par KR4. Ce qui n'est pas fermé, et n'a pas été mesuré :

1. la même question posée en **comparaison** (les deux membres montrés,
   « lequel établit mieux ? »), qui est ce qui a permis à l'humain de
   retrouver la différence ; utile pour mesurer, mais l'architecture ne
   dispose pas d'un jumeau abîmé au moment de corriger une copie réelle :
   à trancher avec le Head of Development avant de dépenser ;
2. la strate « phrase marquée » seule, avec plus de paires ;
3. Kimi K3, une fois le raisonnement désactivé.

Aucune de ces trois mesures ne part sans le mot du propriétaire. Le corrigé
reste « relecteur unique, seconde lecture en attente ».
