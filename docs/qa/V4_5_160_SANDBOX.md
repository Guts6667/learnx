# V4.5-160 / 184 — passe en mode test Stripe

**Statut** : en attente des identifiants bac à sable (ADR_004 §8.4). Tant qu'ils
n'existent pas, l'intégration est développée et vérifiée contre des
enregistrements figés ; cette passe est la dernière étape et n'a pas été jouée.

## Ce que cette passe doit établir en premier

**Quels événements Stripe envoie réellement.** Toute l'attribution en dépend :
LearnX crédite à la réception de « payé » et marque lui-même la commande comme
honorée, parce que le fournisseur n'a aucune raison d'émettre un événement
d'attribution — il ignore si l'apprenant a reçu ses crédits. Si le nom de
l'événement de paiement diffère de celui attendu, la commande reste bloquée à
« en attente » : argent encaissé, rien attribué, et rien qui échoue bruyamment.

C'est le point le plus important de cette passe, avant la forme de la signature.

## Ce qui est déjà prouvé sans compte

Les propriétés que le fournisseur ne garantit pas sont testées hors ligne, en
cassant chacune pour vérifier qu'un test tombe :

- signature valide, falsifiée, absente, illisible, hors fenêtre ;
- comparaison en temps constant (assertion structurelle — une mesure de durée
  serait un test instable qui ne prouve rien) ;
- rejeu du même identifiant d'événement : enregistré une fois, attribué zéro
  fois ;
- événement désordonné : `PAID` après `FULFILLED` ne fait pas régresser ;
- encaissement coupé : rien n'est lu, rien n'est écrit.

## Ce que la passe réelle doit ajouter

Ce qu'un enregistrement figé ne peut pas montrer :

1. **La forme réelle de la signature.** L'algorithme et le format d'en-tête
   sont implémentés d'après la documentation ; seule une livraison authentique
   prouve que la vérification accepte ce que Stripe envoie vraiment — y compris
   le cas de plusieurs signatures `v1` pendant une rotation de secret.
2. **Les noms d'événements.** La table de correspondance vers les états
   d'ADR_003 §6.3 est écrite d'après la documentation. Un nom d'événement
   inconnu est traité sans être appliqué, donc une divergence ne casse rien —
   elle laisse simplement des commandes bloquées, ce qu'il faut voir.
3. **L'ordre et les reprises réels.** Combien de fois Stripe réessaie, à quel
   rythme, et dans quel désordre.
4. **Le retour de navigation.** Qu'il n'attribue rien, vérifié sur un vrai aller
   -retour et pas seulement par lecture du code.

## Déroulé

1. Renseigner `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET` et
   `LEARNX_PAYMENTS_ENABLED=true` dans l'environnement d'aperçu **uniquement**.
   `stripe listen --forward-to <url>/api/payments/webhook` donne une livraison
   authentique en local, ce qu'aucun enregistrement figé ne remplace.
2. Créer un ordre depuis l'application, payer avec une carte de test.
3. Vérifier : un `payment_orders` en `FULFILLED`, une suite de `payment_events`
   dont les identifiants sont distincts, aucun crédit attribué deux fois.
4. Rejouer manuellement une livraison déjà reçue : attendue en `DUPLICATE`,
   réponse 200, aucun crédit.
5. Consigner ici la trace réelle des événements observés, y compris leur ordre.
