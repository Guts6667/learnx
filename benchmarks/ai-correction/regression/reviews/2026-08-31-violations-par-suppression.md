# Revue des six violations par suppression — les indices tiennent

**Conclusion : les quatre indices que j'avais qualifiés de probables défauts
d'authoring sont sains. Ce sont des ratés du correcteur.** Je retire ma
classification précédente, et le taux de 14,89 % ne peut pas être escompté.

Méthode : pour chaque mutant, comparer la phrase supprimée au texte survivant,
puis lire ce que le correcteur a effectivement cité et écrit. Aucun achat.

## 1. `mechanism-link` — writing-v1-explanatory-analysis-complete-clear

**Supprimé :** « Le fait que les participants détournent moins le regard rend
plausible un mécanisme simple : la légende voisine maintient le repère visible
pendant le placement et réduit les allers-retours. »

**Survivant :** « Cela soutient une contribution de la proximité sans prouver
qu'elle cause seule la baisse, car le second passage peut aussi bénéficier de
l'entraînement. »

La phrase supprimée **était** le mécanisme. Ce qui reste parle de prudence
causale, ce qui n'est pas la même chose. Le correcteur a maintenu `mastered` en
citant cette prudence. **Indice sain, raté réel.**

## 2. `residual-risk-coverage` — holdout3-writing-roof-tender-successful

**Supprimé :** « L'inconnue principale est l'état du support sous les tuiles :
aucun des deux devis ne chiffre le remplacement des liteaux abîmés. »

**Survivant :** la précaution seule — visite contradictoire, avenant plafonné.

Le critère demande que l'inconnue soit nommée **et** couverte. Après suppression,
la précaution subsiste sans risque énoncé. Le correcteur a écrit : « L'inconnue
principale — le risque de dépassement budgétaire ou de travaux supplémentaires
non chiffrés — est couverte par une précaution concrète ».

**Il a inventé une inconnue que le texte ne contient plus, puis l'a déclarée
couverte.** Indice sain, raté réel, et le plus net des six.

## 3. `residual-risk-surfacing` — holdout2-writing-maintenance-contract-successful

**Supprimé :** « L'inconnue majeure reste la cause des pannes : le dossier ne
renseigne aucune des 5 immobilisations de 2025. »

**Survivant :** l'action corrective seule — documenter les causes dès 2026.

Le critère porte sur le fait de **faire apparaître** l'inconnue. Le correcteur a
écrit qu'elle est « clairement identifiée **en creux** (documentation à
construire) ». Ses propres mots disent l'inférence. Un critère de mise au jour
n'est pas satisfait par une déduction du correcteur. **Indice sain, raté réel.**

## 4. `context-fidelity` — domaine-ecrit-objectif-complet

**Supprimé :** « Aucune mesure de durée n'existe aujourd'hui, donc la baseline
reste à établir avant tout engagement chiffré. »

**Survivant :** deux hypothèses ouvertes, et le plafond de réaffectation présenté
comme une proposition à valider.

Le rapport du 30 août a jugé cet indice fautif au motif que le texte conserve
d'autres délimitations. **Je l'ai repris sans le vérifier ; c'était trop
rapide.** Les délimitations survivantes portent sur *autre chose*. La phrase
supprimée est la seule à dire qu'aucune baseline n'existe — alors que la réponse
s'engage sur « réduire de 30 % la durée médiane ». Sans elle, la réponse promet
un chiffre sans base reconnue.

L'indice est défendable. **Le jugement antérieur est retiré, y compris le mien.**

## Le motif commun

Dans les quatre cas, le correcteur **fournit depuis son propre raisonnement ce
que le texte a cessé de dire, puis en crédite le texte.** Une fois il invente
l'inconnue ; une fois il accepte une inconnue « en creux » ; une fois il prend
une prudence causale pour un mécanisme ; une fois il tient d'autres limites pour
la limite manquante.

C'est la même famille que le raté arithmétique : **affirmer ce qui n'est pas
là.** Ni la consigne D ni l'oracle arithmétique n'y touchent — les deux corrigent
le vérificateur. Ceci est le primaire.

## Conséquences

1. **`mutation-hints.v2` ne doit pas retirer ces quatre indices.** Les retirer
   supprimerait des tests valides et rendrait le gate vert sans que rien ne
   s'améliore.
2. **14,89 % est proche du réel.** Ma correction précédente à ~6,4 % est retirée.
3. **La règle de suffisance de preuve de 2.3.0 vise juste**, et elle vise le
   modèle primaire, pas le vérificateur.
