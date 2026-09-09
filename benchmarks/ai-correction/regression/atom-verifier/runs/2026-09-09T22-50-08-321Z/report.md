# Vérificateur atomique — mesure

Run complet. Dépense : 2.5976 USD.

Seuils déclarés avant le premier appel : ≥ 27/30 paires gagnées (majorité de 3), ≤ 2 paires instables, rejet des abîmées ≥ 86 %, acceptation des originaux ≥ 90 % ; arrêt sous 24 paires ou au-delà de 5 instables.

| modèle | paires gagnées | abîmé | égalité | indécises | instables | rejet abîmées | acceptation originaux | accord passe 1 | non lus | lecture |
|---|---|---|---|---|---|---|---|---|---|---|
| mistralai/mistral-medium-3-5 | **10** / 30 (p = 1.9e-2 sur 12 tranchées) | 2 | 18 | 0 | 9 | 24 / 30 (1 abst.) | 11 / 30 (0 abst.) | 21 / 60 | 0 | stop |
| anthropic/claude-haiku-4.5 | **12** / 30 (p = 1.8e-2 sur 15 tranchées) | 3 | 15 | 0 | 0 | 25 / 30 (2 abst.) | 12 / 30 (0 abst.) | 26 / 60 | 0 | stop |
| moonshotai/kimi-k3 | **2** / 30 (p = 2.5e-1 sur 2 tranchées) | 0 | 3 | 25 | 2 | 3 / 8 (0 abst.) | 10 / 10 (0 abst.) | 13 / 18 | 124 | stop |
| anthropic/claude-sonnet-4.6 | **12** / 30 (p = 1.8e-1 sur 19 tranchées) | 7 | 11 | 0 | 4 | 18 / 30 (2 abst.) | 16 / 30 (2 abst.) | 29 / 60 | 0 | stop |

Les deux taux absolus sont secondaires et toujours rapportés ensemble ; « accord passe 1 » compare le verdict majoritaire au verdict absolu du propriétaire sur la même carte.

