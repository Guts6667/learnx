# `benchmark.v3_2-comparison.json` — pourquoi ce fichier existe

Copie de `benchmark.v3_2.json` (consigne **2.3.0**, inchangée), avec **une seule
différence** : `temperature` passe à `null` pour les candidats `gpt-5.6`.

## Ce qui l'a rendu nécessaire

Le premier run de comparaison sur `openai/gpt-5.6-terra` a échoué à **105
cellules sur 105**, toutes en `PROVIDER_HTTP_404`, pour **0,00 USD** — aucun
appel facturable n'a abouti.

Diagnostiqué en interrogeant le fournisseur directement, pas en supposant :

| corps envoyé | résultat |
| --- | --- |
| corps exact du runner | **404** — « No endpoints found that can handle the requested parameters » |
| le même sans `require_parameters` | OK |
| le même **sans `temperature`**, `require_parameters` conservé | **OK** |
| le même avec le tag minuscule `openai` | 404 — la route n'était pas en cause |

**`temperature` est la cause.** GPT-5.6 est un modèle de raisonnement qui ne
l'accepte pas, et `require_parameters: true` — choix délibéré de V4.5-115, pour
qu'aucun point de service n'ignore silencieusement nos paramètres — élimine alors
tous les points de service et renvoie 404.

L'identité promue envoie déjà `temperature: null`. C'est exactement pourquoi
Sonnet n'a jamais rencontré ce mur, et pourquoi personne ne l'avait vu : un seul
modèle a jamais été mesuré.

## Ce que ce fichier ne fait pas

Il **ne desserre pas** `require_parameters`. Le garde-fou reste en place ; c'est
le paramètre que le modèle refuse qui est retiré, pas la politique qui protège la
mesure. Aucun autre candidat n'est modifié : `kimi-k3` via Fireworks passe avec
le corps exact du runner (vérifié, 0,000885 USD).

## À savoir pour la suite

Le banc déclare douze candidats et un seul a jamais tourné. Tant qu'un candidat
n'a pas été essayé, rien ne garantit que son profil de requête est compatible —
et l'échec se présente comme une panne du modèle (`404`, zéro cellule valide)
plutôt que comme ce qu'il est : notre propre profil qui exclut tous les points de
service. Essayer un candidat coûte **une** requête ; le vérifier avant de lancer
105 cellules est gratuit.
