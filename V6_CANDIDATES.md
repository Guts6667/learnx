# Candidats V6 — Support utilisateur et conformité des données

## Statut

- Version : 0.1.0
- Statut : **orientation produit, aucun ticket d'implémentation autorisé**
- Dépendance : V5 officiellement clôturée et architecture réellement livrée
- Validation requise : produit, développement, sécurité et conseil juridique
  compétent avant transformation en backlog exécutable

Ce document conserve les intentions V6 sans anticiper son architecture. Il ne
remplace pas les obligations minimales de confidentialité, d'information et de
support nécessaires avant un pilote payant V4 ou une ouverture V5.

## Cap V6

V6 doit apporter :

- un canal de support intégré permettant de signaler et suivre un problème ;
- un espace administrateur sobre pour qualifier, répondre et clôturer les
  demandes ;
- une vision claire des données personnelles détenues par LearnX ;
- des parcours utilisateur pour exercer les droits applicables ;
- des politiques de conservation, suppression et traçabilité exécutables ;
- un audit complet des traitements liés à l'apprentissage, l'IA, la création de
  formations, au paiement, au marketing et au support.

V6 ne doit pas devenir :

- un CRM commercial ou un outil de vente ;
- une plateforme de chat temps réel ou un centre d'appel ;
- un système de surveillance des utilisateurs ;
- une promesse automatique de conformité juridique ;
- un stockage libre de captures, secrets, données médicales ou pièces sensibles.

## Principes structurants

1. Un ticket de support appartient à son demandeur et n'expose aucune donnée
   d'un autre compte ou programme.
2. L'administrateur accède uniquement aux informations nécessaires au traitement
   du problème ; les contenus pédagogiques et soumissions ne sont jamais joints
   automatiquement.
3. Les statuts, priorités et historiques sont calculés et audités côté serveur.
4. Les pièces jointes sont désactivées par défaut puis autorisées seulement après
   définition des formats, limites, analyse de sécurité et rétention.
5. Support, incident de sécurité, contestation de paiement et seconde correction
   IA restent quatre workflows distincts.
6. Toute suppression ou export respecte les contraintes d'intégrité du ledger,
   de facturation, de sécurité et de preuve sans conserver plus de données que
   nécessaire.
7. La conformité est vérifiée sur les flux réels et les fournisseurs réellement
   utilisés, pas uniquement dans des pages juridiques.

## Lot A — Cartographie et gouvernance des données

### V6-C01 — Inventaire des traitements et responsabilités

- Cartographier données de compte, accès, progression, notes, soumissions,
  corrections IA, programmes créés, contacts landing, paiements et support.
- Pour chaque donnée : finalité, base retenue à confirmer juridiquement, source,
  destinataires, localisation, durée, suppression, export et propriétaire interne.
- Identifier les rôles de LearnX et de chaque fournisseur sans les présumer.

### V6-C02 — Registre fournisseurs et transferts

- Inventorier Neon, Vercel, OpenRouter, modèles appelés, Revolut, fournisseur
  d'e-mail, analytics et futurs outils de support.
- Centraliser contrats, engagements de traitement, sous-traitants, régions,
  transferts éventuels, rétention et procédures de sortie.
- Bloquer l'ajout silencieux d'un nouveau fournisseur traitant des données.

### V6-C03 — Politique de conservation et moteur de cycle de vie

- Définir les durées par catégorie et les événements déclenchant archivage,
  anonymisation ou suppression.
- Automatiser les traitements répétables avec journal d'exécution, dry-run,
  reprise et exceptions justifiées.
- Ne jamais supprimer une écriture financière immuable ; minimiser ou dissocier
  les données personnelles lorsqu'une conservation obligatoire subsiste.

## Lot B — Centre de confidentialité utilisateur

### V6-C04 — Tableau de bord des données et préférences

- Montrer les catégories de données détenues, finalités et destinataires de
  manière compréhensible.
- Séparer préférences facultatives, consentements lorsqu'ils sont applicables et
  traitements nécessaires au service.
- Éviter les dark patterns et garantir la même facilité pour accepter ou retirer.

### V6-C05 — Demandes d'accès, export, rectification et suppression

- Permettre de déposer et suivre une demande authentifiée.
- Vérifier identité, périmètre, délais applicables et exceptions avant exécution.
- Produire des exports lisibles et structurés sans données d'un tiers, secrets,
  prompts internes ou informations financières d'autres comptes.
- Prévisualiser les conséquences d'une suppression sur progression, contenus
  créés, enrollments, crédits et historique.

### V6-C06 — Fermeture de compte et dissociation des données

- Définir une clôture explicite, réversible uniquement pendant une éventuelle
  période validée, puis suppression/anonymisation contrôlée.
- Traiter séparément programmes publiés, collaborations, places, crédits,
  paiements, support et contenus personnels.
- Interdire toute suppression en cascade non prévisualisée.

## Lot C — Support et ticketing

### V6-S01 — ADR support, catégories et niveaux de service

- Définir catégories minimales : accès, apprentissage, correction IA, crédits,
  paiement, création/publication, confidentialité et signalement de sécurité.
- Définir priorité, statuts, responsabilités, canaux, délais annoncés ou absence
  de délai garanti, escalades internes et règles de clôture.
- Distinguer question, bug, incident, demande de droit et litige financier.

### V6-S02 — Dépôt et suivi côté utilisateur

- Formulaire guidé, programme/page concernés, description, consentement avant
  inclusion d'informations techniques et confirmation traçable.
- Liste personnelle avec statut, réponses, dates et prochaine action.
- Réouverture bornée ou nouveau ticket lié ; aucune conversation infinie.
- Mobile, desktop, FR/EN, clavier, lecteur d'écran et erreurs réseau.

### V6-S03 — Boîte de traitement administrateur

- Filtres sobres par catégorie, statut, priorité et ancienneté.
- Détail du ticket, contexte strictement nécessaire, historique immuable,
  attribution interne, réponse et clôture motivée.
- Aucun scoring commercial, funnel, graphique décoratif ou accès global aux
  données privées du demandeur.

### V6-S04 — Notifications et communication

- Notifications dans l'application et e-mail pour réception, réponse, demande
  d'information et clôture selon préférences applicables.
- Modèles versionnés, liens authentifiés et aucune donnée sensible dans l'objet
  ou le contenu envoyé sans nécessité démontrée.
- Rebond, échec d'envoi, désactivation et historique sans doublon.

### V6-S05 — Pièces jointes et diagnostics sûrs, optionnel

- N'ouvrir ce ticket qu'après preuve qu'un formulaire textuel et des références
  de route ne suffisent pas.
- Formats allowlistés, taille bornée, analyse, chiffrement, URL temporaire,
  suppression et interdiction des secrets clairement expliquée.
- Collecte de diagnostics opt-in, minimale et inspectable avant envoi.

## Lot D — Incidents, contrôle et clôture

### V6-C07 — Gestion des incidents et violations de données

- Définir détection, qualification, confinement, journal de décisions,
  communication, responsabilités et preuves.
- Préparer les modèles et contacts nécessaires sans automatiser une décision
  juridique sensible.
- Tester des exercices de simulation et la disponibilité des journaux.

### V6-C08 — Analyse de risques et contrôle des traitements IA

- Réévaluer correction IA, seconde correction, génération V5, profilage de
  progression et décisions automatisées réellement livrées.
- Documenter nécessité, proportionnalité, risques, garde-fous, possibilité de
  nouvelle tentative et informations données à l'utilisateur.
- Déterminer avec un conseil compétent quelles analyses formelles sont requises.

### V6-C09 — Audit conformité, sécurité et GO/NO-GO

- Tester droits d'accès, exports, rectifications, suppressions, rétention,
  fermeture de compte, tickets, notifications, fournisseurs et incidents.
- Vérifier mobile/desktop, accessibilité, isolation multi-compte, chiffrement,
  journaux, sauvegardes, restauration et suppression réelle des copies prévues.
- Produire les écarts, responsables, échéances et un verdict explicite ; aucune
  mention `conforme` ne repose uniquement sur une auto-évaluation technique.

## Prérequis à ne pas reporter jusqu'à V6

Avant un pilote payant ou l'ouverture publique des fonctions IA, LearnX doit
déjà disposer au minimum :

- d'un moyen de contact support et paiement clairement indiqué ;
- d'une information de confidentialité correspondant aux fournisseurs réels ;
- de règles de minimisation, rétention et suppression pour soumissions et IA ;
- d'un mécanisme sûr de fermeture ou de demande de suppression manuelle ;
- d'une procédure de remboursement/litige et d'un contact de sécurité ;
- d'un inventaire initial des fournisseurs et traitements à risque.

V6 industrialise, unifie et audite ces capacités ; elle ne régularise pas
rétroactivement une collecte qui aurait été lancée sans garde-fous.

## Arbitrages futurs

1. Support réservé aux comptes ou formulaire public également disponible.
2. Possibilité et formats des pièces jointes.
3. Niveau de service annoncé selon offre ou sans différenciation commerciale.
4. Outil interne LearnX ou intégration d'un fournisseur de ticketing.
5. Conservation des tickets et séparation des demandes de confidentialité.
6. Sort des programmes créés lors de la fermeture du compte propriétaire.
7. Responsabilité opérationnelle du support à mesure que le nombre d'utilisateurs
   augmente.
