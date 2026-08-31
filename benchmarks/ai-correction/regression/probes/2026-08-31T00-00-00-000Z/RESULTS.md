# Sonde faux accord — consignes A et B, 31 août 2026

**Le vérificateur n'est pas complaisant. Il ne calcule pas.**

| Consigne | Faux accords | Taux | Coût |
| --- | --- | --- | --- |
| A — runtime promue | **3/20** | 15,00 % | 0,008567 USD |
| B — adversariale | **2/20** | 10,00 % | 0,010877 USD |

Total dépensé : **0,019444 USD**. 40 appels vérificateur, aucun appel primaire.

## Les cinq échecs sont arithmétiques, tous les cinq

| Cas | Consigne A | Consigne B | Ce qu'il fallait voir |
| --- | --- | --- | --- |
| `arith-01` | **accord** | **accord** | 7 × 6 + 12 = 54, pas 44 |
| `arith-04` | **accord** | **accord** | 3 × 45 min = 2 h 15, pas 2 h |
| `arith-05` | **accord** | refus | 3 L/min = 180 L/heure, pas par jour |
| `arith-02`, `arith-03` | refus | refus | — |
| 15 cas non arithmétiques | refus | refus | — |

**15 sur 15 des faussetés non arithmétiques sont attrapées sous la consigne
actuelle** : affirmation absente des citations, citation qui dit le contraire,
périmètre plus étroit que le niveau revendiqué. Le vérificateur discrimine
partout où vérifier veut dire lire. Il échoue une fois sur deux là où vérifier
veut dire calculer.

## La consigne adversariale n'est pas le correctif

B récupère `arith-05` et laisse passer `arith-01` et `arith-04`. Or `arith-01`
**est** le raté de production : `7 × 6 € + 12 € = 44 €` certifié « les deux
calculs sont corrects » avec une confiance de 0,97, et le vérificateur d'accord.
Les deux consignes le laissent passer.

C'est cohérent : B change la *posture* du modèle — chercher la raison d'un refus
plutôt que d'un accord. Le défaut n'est pas une posture. Le modèle ne pose pas
la multiplication, quelle que soit la question qu'on lui adresse.

## Ce que cette mesure corrige dans les lectures précédentes

1. **« Un vérificateur qui dit oui à tout » était faux.** Je l'ai écrit après le
   5/7 de `checker-false-agree-rate`. Sur un dénominateur construit et vingt fois
   plus large, il refuse 15/15 hors arithmétique.
2. **Le 5/7 s'explique enfin, et à notre charge.** Ces occasions venaient de
   mutants de suppression : les citations retenues par le correcteur provenaient
   du texte *survivant* et soutenaient réellement le niveau. Le vérificateur
   avait raison d'être d'accord. C'est une preuve indépendante que quatre des six
   violations par suppression sont des défauts d'authoring de nos indices, pas
   des ratés du correcteur.
3. **Changer de modèle vérificateur viserait à côté.** Payer plus cher un modèle
   déjà juste sur 15/15 de ce qu'il peut vérifier ne corrige pas ce qu'il ne
   calcule pas.

## Provenance

Chiffres relevés sur la sortie console du lancement du 31 août : le runner de la
sonde ne persistait pas encore ses résultats. La persistance est ajoutée dans la
même PR, et le prochain lancement écrira son propre artefact au lieu d'être
recopié.
