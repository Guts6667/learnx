# Jeu de copie de la landing « Conversion Edition » — V4.5-220

Document de relecture, **pas encore intégré**. Le catalogue
`src/i18n/catalogs/landing.ts` sera réécrit à partir de ce fichier une fois que
Rayan l'aura validé, conformément au ticket (« validé par Rayan avant
intégration »).

## Comment lire ce document

- **FR est la langue de référence** : le site est en français par défaut,
  l'anglais est la bascule. La maquette Paper étant en anglais seulement, la
  colonne EN est une transcription de la maquette et la colonne FR une
  rédaction, pas une traduction littérale.
- **⚠ à confirmer** marque un passage que je n'ai pas pu lire avec certitude.
  Le quota MCP de Paper est épuisé pour six jours : j'ai travaillé depuis les
  exports haute résolution, où le corps de texte des cartes du produit est à la
  limite du lisible. Lire un **texte** sur une image n'est pas lire une
  **valeur**, mais l'erreur reste possible et je préfère la signaler que la
  cacher.
- **✎ arbitrage appliqué** marque un texte qui s'écarte volontairement de la
  maquette, en application d'une décision déjà prise.

---

## 1. Navigation

| Rôle | FR | EN |
| --- | --- | --- |
| Lien 1 | Comment ça marche | How it works |
| Lien 2 | Tarifs | Pricing |
| Lien 3 | Feuille de route | Roadmap |
| Lien 4 | Recherche | Research |
| Connexion | Se connecter | Sign in |
| Action | Demander un accès | Request access |

Bascule de langue « FR / EN » à droite de la navigation desktop et dans le pied
de page mobile (D1). Pas de menu hamburger ; les ancres vivent dans le pied de
page.

## 2. Hero — « Hero · Momentum »

| Rôle | FR | EN |
| --- | --- | --- |
| Eyebrow | APPRENDRE AVEC ÉLAN | LEARN WITH MOMENTUM |
| Titre | Savoir quoi apprendre ensuite. | Know what to learn next. |
| Accroche | LearnX transforme votre objectif en un chemin clair : des leçons, de la pratique et des retours — pour que vous sachiez toujours ce qui vient après. | LearnX turns your goal into a clear path of lessons, practice and feedback — so you always know what comes next. |
| Action primaire | Demander un accès anticipé → | Request early access → |
| Action secondaire | Voir le produit → | See the product → |
| Ligne de preuve ✎ | +20 % de crédits sur Journey après acceptation · Sans abonnement · Aucun paiement aujourd'hui | +20% credits on Journey after acceptance · No subscription · No payment today |

✎ La maquette écrit « +20% credits after acceptance », qui généralise le bonus
aux trois paliers. D2 le réserve à Journey : la phrase le dit maintenant.

### Aperçu produit (statique)

| Rôle | FR | EN |
| --- | --- | --- |
| Titre de carte | PILOTER UN PROJET EN ÉQUIPE | LEADING A TEAM PROJECT |
| Compteur ⚠ | 7 SUR 17 | 7 OF 17 |
| Salutation | Bonjour, Maya. | Hello, Maya. |
| Libellé progression | VOTRE PROGRESSION | YOUR PROGRESS |
| Valeur | 68 % | 68% |
| Libellé étape | VOTRE PROCHAINE ÉTAPE | YOUR NEXT STEP |
| Étape | Formuler un objectif de sprint | Write a sprint goal |
| Sous-texte ⚠ | Votre réponse et vos notes sont enregistrées. | Your answer and notes are safely saved. |
| Action | Reprendre l'activité → | Resume activity → |
| Statistique 1 | NOTES · 12 | NOTES · 12 |
| Statistique 2 | TENTATIVES · 8 | ATTEMPTS · 8 |
| Bandeau | TOUJOURS ENREGISTRÉ — Reprenez exactement où vous vous êtes arrêté | ALWAYS SAVED — Pick up exactly where you left off |

⚠ Le compteur « 7 sur 17 » et le sous-texte de l'étape sont les deux passages
les moins nets de l'export desktop.

## 3. Preuve produit — « Product proof · Resume Learn Improve »

| Rôle | FR | EN |
| --- | --- | --- |
| Eyebrow | LE PRODUIT, PAS UNE PROMESSE | THE PRODUCT, NOT A PROMISE |
| Titre | Ouvrez LearnX. Continuez d'avancer. | Open LearnX. Keep moving. |
| Accroche | Une prochaine étape claire. Puis la suivante. Vos leçons, vos tentatives et vos notes restent liées. | One clear next step. Then the next. Your lessons, attempts and notes stay connected. |
| Étape 1 | REPRENDRE — Votre prochaine étape vous attend. | RESUME — Your next step is waiting. |
| Étape 2 | APPRENDRE — Faites le travail, pas seulement la lecture. | LEARN — Do the work, not just the reading. |
| Étape 3 | PROGRESSER — Un retour clair. Un nouvel essai. | IMPROVE — Clear feedback. Another try. |

### Carte parcours

| Rôle | FR | EN |
| --- | --- | --- |
| Libellé | VOTRE PARCOURS | YOUR JOURNEY |
| Titre | Piloter un projet en équipe | Lead a team project |
| Libellé suite | ENSUITE | UP NEXT |
| Étape | Formuler un objectif de sprint | Write a sprint goal |
| Sous-titre ⚠ | Étape 1 · Cadrer le travail | Step 1 · Frame the work |
| Action | Continuer → | Continue → |
| Mention | ✓ Progression enregistrée sur tous vos appareils | ✓ Progress saved across devices |

### Carte leçon

| Rôle | FR | EN |
| --- | --- | --- |
| Libellé | APERÇU DE LA LEÇON | LESSON PREVIEW |
| Sur-titre ⚠ | DONNER UNE DIRECTION COMMUNE | HOW THE TEAM FINDS A SHARED DIRECTION |
| Titre | Formuler un objectif de sprint | Write a sprint goal |
| Sous-titre | Un objectif unique et utile | One useful objective |
| Corps | Un objectif de sprint exprime le résultat que l'équipe cherche à obtenir. Il donne une direction commune tout en laissant de la souplesse sur la manière de l'atteindre. | A sprint goal states the outcome the team is working toward. It gives one shared direction while leaving room in how the work gets done. |
| Source | Source du contenu · The Scrum Guide 2020 — Ken Schwaber et Jeff Sutherland | Content source · The Scrum Guide 2020 — Ken Schwaber and Jeff Sutherland |
| Action | Passer à la pratique → | Continue to practice → |

Le corps de cette carte et sa source sont déjà en production et couverts par
`landing.spec.ts` ; le ticket 222 demande de les reprendre tels quels plutôt
que de les réécrire.

### Carte retour

| Rôle | FR | EN |
| --- | --- | --- |
| Libellé | ENTRAÎNEMENT ÉCRIT | WRITING PRACTICE |
| Titre | Votre retour | Your feedback |
| Étiquette | RELU | REVIEWED |
| Extrait de copie ⚠ | Réduire le temps que met un client à trouver sa prochaine étape. | Reduce the time it takes customers to find their next step. |
| Point à retravailler | Rendre ce résultat mesurable — Ajoutez une cible, pour que l'équipe sache à quoi ressemble la réussite. | Make this outcome measurable — Add a target so the team knows what success looks like. |
| Point acquis ⚠ | ✓ Direction claire — Le résultat est centré sur la valeur pour le client. | ✓ Strong direction — The outcome is centred on customer value. |
| Action | Améliorer et réessayer → | Improve and try again → |

## 4. Tarifs — « Pricing · Early adopter »

| Rôle | FR | EN |
| --- | --- | --- |
| Eyebrow ✎ | EARLY ADOPTER · JOURNEY +20 % | EARLY ADOPTER · JOURNEY +20% |
| Titre | Choisissez votre élan. | Choose your momentum. |
| Accroche | Des packs de crédits à achat unique. Vous ne payez qu'après acceptation. | One-time credit packs. Pay only after approval. |

**Aucun nom de pack, prix, nombre de crédits ou de corrections n'est écrit
ici** : ils viennent du catalogue (`GET /api/public/credit-packs`). Ce tableau
ne couvre que les textes fixes.

| Rôle | FR | EN |
| --- | --- | --- |
| Sous-titre Starter | Un premier objectif, bien cadré | A focused first goal |
| Sous-titre Journey | Le meilleur endroit pour commencer | The best place to start |
| Sous-titre Deep Dive | Pour un élan ambitieux | For ambitious momentum |
| Badge recommandé | NOTRE CHOIX | OUR PICK |
| Libellé crédits | TOTAL DES CRÉDITS | TOTAL CREDITS |
| Puce bonus (Journey seule) ✎ | Bonus early adopter de +20 % inclus | +20% early-adopter bonus included |
| Puce achat unique (autres paliers) | Pack de crédits à achat unique | One-time credit pack |
| Action de carte | Choisir {pack} → | Choose {pack} → |
| Bandeau de bas de section | Achat unique · Sans abonnement · Vous ne payez qu'après acceptation de votre accès | One-time purchase · No subscription · Pay only after access approval |
| Mention prix | Les prix restent {prix} | Prices stay {prix} |

✎ La maquette porte « One-time credit pack » sur Starter **et** Deep Dive, et
le bonus sur Journey. Attention : sur Starter, cette puce dit « pas un
abonnement », alors que la vraie contrainte de ce palier est **un seul achat
par compte, remboursement compris**. Ce sont deux idées différentes sous le
même mot. La phrase de la limite est déjà livrée et testée (V4.5-213) ; elle
doit rester sur la carte Starter, et la puce « achat unique » ne la remplace
pas.

## 5. Feuille de route — « Product roadmap »

| Rôle | FR | EN |
| --- | --- | --- |
| Eyebrow | FEUILLE DE ROUTE PRODUIT | PRODUCT ROADMAP |
| Titre | Construit pour gagner votre confiance. Une version à la fois. | Built to earn your confidence. One release at a time. |
| Accroche | Nous livrons une capacité utile, nous l'éprouvons en situation réelle, puis nous élargissons ce qui a fait ses preuves. | We ship one useful capability, test it in real learning, then expand what proves itself. |
| Jalon 1 · état | DISPONIBLE | AVAILABLE |
| Jalon 1 · titre | Des parcours qui gardent votre place | Guided paths that remember your place |
| Jalon 1 · corps | Apprenez, pratiquez, et reprenez exactement là où vous vous êtes arrêté. | Learn, practise, and return exactly where you stopped. |
| Jalon 2 · état | PILOTE BORNÉ | BOUNDED PILOT |
| Jalon 2 · titre | Un retour plus rapide sur vos écrits | Faster feedback on written practice |
| Jalon 2 · corps | Un accompagnement précis, adossé à ses sources, pour les early adopters acceptés. | Precise source-linked guidance for approved early adopters. |
| Jalon 3 · état | PROCHAINEMENT | NEXT |
| Jalon 3 · titre | D'autres formats de pratique. Des parcours conçus avec l'IA et sourcés. | More practice formats. Sourced AI-built paths. |
| Jalon 3 · corps | La correction d'abord, les nouveaux parcours ensuite — avec la même exigence de validation. | Broader correction first, then new paths — with the same validation standard. |

✎ Le lien « View the full roadmap → » est retiré en V4.5 (D3). Aucune copie
n'est prévue pour lui.

## 6. Recherche et transparence — « Research & transparency »

| Rôle | FR | EN |
| --- | --- | --- |
| Eyebrow | RECHERCHE ET TRANSPARENCE | RESEARCH & TRANSPARENCY |
| Titre | La confiance mérite des preuves. | Trust deserves receipts. |
| Accroche | Voyez les sources, les méthodes et les limites de la façon dont LearnX enseigne, évalue et corrige. | See the sources, methods and limits behind the way LearnX teaches, evaluates and gives feedback. |
| Action | Explorer nos publications → | Explore our research → |
| Titre de carte | Bibliothèque de recherche | Research library |
| Note · état | DERNIÈRE PUBLICATION · 24 AOÛT 2026 | LATEST PUBLICATION · 24 AUGUST 2026 |
| Note · titre | Évaluation Writing sous protocole scellé : résultats et décision de déploiement borné | Sealed-protocol Writing evaluation: results and bounded deployment decision |
| Mini-carte 1 | SOURCES — Les affirmations renvoient à leur origine | SOURCES — Claims link back |
| Mini-carte 2 | CE QUI EST INCLUS — Les limites sont dites | WHAT'S INCLUDED — Know the limits |
| Mini-carte 3 | DATÉ — Les méthodes évoluent | DATED — Methods evolve |
| Action de carte | Ouvrir la bibliothèque → | Open the research library → |

**Point à trancher.** La maquette écrit « RESEARCH NOTE 08 · 4 SOURCES ». D4
demande le dernier article réel avec son vrai nombre de sources — or
`writing-exam-bounded-pilot.html` (24 août 2026, le plus récent) **ne publie
aucun nombre de sources** : l'article n'a ni section « Sources » ni
bibliographie, ses sept sections sont Question de recherche, Protocole,
Résultats d'exécution, Résultats pédagogiques, Interprétation et limites,
Arbitrage de déploiement borné, Conditions d'une extension. Le titre et la date
ci-dessus sont donc réels ; le nombre de sources est remplacé par la date, qui
existe. Inventer « 4 sources » serait exactement la faute que cette section
prétend combattre.

## 7. « Your next step » — « Momentum CTA » (masquée en V4.5)

Section construite mais **non rendue** en V4.5 (D5). Copie livrée pour que le
code soit complet et pour l'affichage en V5.

| Rôle | FR | EN |
| --- | --- | --- |
| Eyebrow | VOTRE PROCHAINE ÉTAPE | YOUR NEXT STEP |
| Titre | Choisissez votre pack. Candidatez avant d'acheter. | Choose your pack. Apply before you buy. |
| Accroche | Indiquez le pack qui vous convient. Vous ne payez que si votre accès est accepté. | Select your preferred pack now. Pay only if your access is approved. |
| Action | Candidater avec {pack} → | Apply with {pack} selected → |
| Note | Votre choix est une préférence, pas un achat. | Your selection is a preference, not a purchase. |
| Libellé de carte | PACK {NOM} | {NAME} PACK |
| Sous-texte | crédits pour apprendre, pratiquer et progresser | credits to learn, practise and improve |
| Libellé prix | PRIX | PRICE |
| Étiquette | ACCÈS ANTICIPÉ | EARLY ACCESS |

## 8. Accès anticipé — « Limited early access »

| Rôle | FR | EN |
| --- | --- | --- |
| Eyebrow | ACCÈS ANTICIPÉ LIMITÉ | LIMITED EARLY ACCESS |
| Titre | Dites-nous ce que vous voulez apprendre. | Tell us what you want to learn. |
| Accroche | Si LearnX convient à votre objectif, nous vous enverrons une invitation. Vous ne payez qu'après acceptation. | If LearnX is right for your goal, we'll send a private invitation. You pay only after acceptance. |
| Bénéfice 1 | Un parcours construit autour d'un objectif réel | A path built around a real goal |
| Bénéfice 2 | Une prise directe sur le produit | Direct input into the product |
| Bénéfice 3 | Sans abonnement | No subscription |
| Étapes | COMMENT ÇA MARCHE · 01 Candidater · 02 Confirmer votre e-mail · 03 Recevoir votre invitation | HOW IT WORKS · 01 Apply · 02 Confirm your email · 03 Receive your invitation |

### Formulaire

| Rôle | FR | EN |
| --- | --- | --- |
| Titre | Demander votre invitation | Request your invitation |
| Sous-titre | Moins d'une minute. Aucun paiement aujourd'hui. | Takes less than a minute. No payment today. |
| Étiquette | SANS CARTE BANCAIRE | NO CREDIT CARD |
| Champ 1 | Prénom | First name |
| Champ 1 · exemple | Votre prénom | Your first name |
| Champ 2 | Adresse e-mail | Email |
| Champ 2 · exemple | vous@exemple.com | you@example.com |
| Champ 3 | Qu'avez-vous envie d'apprendre ? | What do you want to learn? |
| Champ 3 · exemple | Cadrer un objectif d'équipe et le tenir | Lead a product team goal and hold it |
| Champ 4 | Qu'est-ce qui vous ralentit d'habitude ? (facultatif) | What usually slows you down? (optional) |
| Champ 4 · exemple | Dites-le en une phrase | Tell us in one sentence |
| Case à cocher | Recevoir occasionnellement des nouvelles du produit LearnX. Désinscription à tout moment. | Send me occasional LearnX product updates. Unsubscribe anytime. |
| Bouton | Demander un accès anticipé → | Request early access → |
| Encart | Aucun compte créé. Aucun paiement prélevé. Nous vous demanderons d'abord de confirmer votre e-mail, puis nous étudierons votre candidature. | No account created. No payment taken. We'll first ask you to confirm your email, then review your application. |
| Mention légale ⚠ | En candidatant, vous acceptez de recevoir des e-mails concernant votre candidature LearnX. Vous pouvez demander la suppression de vos données à tout moment. | By applying, you agree to receive emails about your LearnX application. You can ask for your data to be deleted at any time. |

La case des nouvelles est **décochée par défaut**, et ce défaut est la
décision : un consentement se donne, il ne se déduit pas d'un silence.

### États

| Rôle | FR | EN |
| --- | --- | --- |
| Envoi en cours | Envoi de votre candidature… | Sending your application… |
| Succès | Candidature reçue. Vérifiez votre boîte e-mail : nous venons de vous envoyer un lien de confirmation. | Application received. Check your inbox — we've just sent you a confirmation link. |
| Erreur générale | Votre candidature n'a pas pu être envoyée. Réessayez dans un instant. | Your application could not be sent. Try again in a moment. |
| E-mail invalide | Cette adresse e-mail ne semble pas valide. | That email address does not look valid. |
| Prénom manquant | Indiquez votre prénom. | Enter your first name. |
| Objectif manquant | Dites-nous ce que vous voulez apprendre. | Tell us what you want to learn. |
| Déjà candidat | Une candidature existe déjà pour cette adresse. Vérifiez votre boîte e-mail. | An application already exists for this address. Check your inbox. |

Les messages d'erreur ci-dessus sont une proposition : le contrat exact de
l'API (`firstName`, `friction`, codes de refus) arrive avec V4.5-228, et je
les alignerai sur la PR du Head of Development.

## 9. « Not ready to apply? »

| Rôle | FR | EN |
| --- | --- | --- |
| Eyebrow | PAS ENCORE PRÊT ? | NOT READY TO APPLY? |
| Titre | Suivez le lancement. Rien de bruyant. | Follow the launch. Nothing noisy. |
| Champ | Adresse e-mail | Email |
| Bouton | Me tenir informé → | Keep me posted → |
| Mention | Seulement les informations importantes sur l'ouverture de LearnX. Désinscription à tout moment. | Only what matters about LearnX opening up. Unsubscribe anytime. |

## 10. Pied de page

| Rôle | FR | EN |
| --- | --- | --- |
| Signature | LearnX — Apprendre avec une direction. © 2026 | LearnX — Learning with direction. © 2026 |
| Lien 1 | Produit | Product |
| Lien 2 | Recherche | Research |
| Lien 3 | Se connecter | Sign in |
| Lien 4 | Confidentialité | Privacy |

Les ancres de section et le lien Confidentialité vivent dans le pied de page
(D1), ainsi que la bascule de langue sur mobile.

---

## Clés mortes à retirer à l'intégration

La bande de principes a été supprimée du DOM en V4.5-219 ; ses six clés
subsistent et n'ont plus de rendu :
`landing.product.structuredTitle`, `landing.product.structured`,
`landing.product.practiceTitle`, `landing.product.practice`,
`landing.product.evidenceTitle`, `landing.product.evidence`.

## Ce qui reste à confirmer

1. Les six passages marqués **⚠**, tous dans les cartes de la section preuve
   produit et dans l'aperçu du hero — le corps de texte y est le plus petit de
   la maquette et l'export ne le rend pas nettement. Une relecture dans Paper
   les lèvera en une minute quand le quota reviendra.
2. Le remplacement du **nombre de sources** par la date sur la carte recherche
   (section 6), faute d'un nombre réel à afficher.
3. La cohabitation de la puce « achat unique » et de la phrase de limite par
   compte sur la carte Starter (section 4).
