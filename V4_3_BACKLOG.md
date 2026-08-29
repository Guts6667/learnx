# Backlog V4.3 — expérience produit et pipeline de programmes

## Autorité et état

- Version : 0.1.0
- Date d'ouverture : 29 août 2026
- Baseline : `origin/main` à `9c35e9db` (V4.2 released et clôturée)
- Statut V4.3 : **PARQUÉ** — reporté par le propriétaire le 29 août 2026, au
  profit de V4.5 (correction IA assistée et ouverture commerciale). Aucun
  ticket n'est activable. Rien n'est commencé côté code : le report ne perd
  aucun travail.
- Reprise : ce fichier redevient le backlog d'exécution V4.3 lorsque le
  propriétaire rouvre le chantier et arrête le périmètre du lot 100.
- Autorité de design : `docs/DESIGN_SYSTEM.md`.

## Objet

V4.2 a rendu le système de design réel et l'a démontré sur la surface publique.
V4.3 l'applique au produit, et traite la seconde dette structurelle identifiée
pendant l'audit V4.1 : le coût d'ajout d'un programme.

V4.3 se place avant V4.5 : polir l'expérience et assainir le pipeline de contenu
avant d'ouvrir le cycle commercial et la nouvelle correction IA.

## Lot 100 — expérience apprenant

### V4.3-101 — Refonte des surfaces apprenant

- Priorité : P0 · Owner : Frontend + Design · Reviewer : Produit
- Statut : **PARQUÉ**

**Deux recommandations UX indépendantes ont été livrées et aucune ne fait
autorité.** Elles ont été produites contre le même brief du propriétaire, l'une
après l'autre, la seconde s'appuyant sur la première. Elles convergent sur
l'essentiel et se contredisent sur un point ; l'arbitrage appartient au
propriétaire et n'a pas eu lieu.

- Audit initial : `https://claude.ai/code/artifact/743545e4-4b59-45c4-bc3c-7058b2b917fb`
  — 9 problèmes d'usage, 6 problèmes visuels, 7 recommandations, maquettes
  leçon et arrivée.
- Recommandation « La boucle » :
  `https://claude.ai/code/artifact/00cd2ffb-e057-4ab5-8afc-92fb912180c8`
  — thèse : le produit n'a pas de boucle de retour. Écrans associés :
  `https://claude.ai/code/artifact/eca6e670-5b48-4c85-b667-1dfe162a93c5`.
- **Point de désaccord à trancher** : nombre de destinations en navigation
  basse — quatre selon le premier audit, trois selon le second, qui considère
  « Mes parcours » comme une section et non un onglet.

Constat majeur du second audit, vérifié dans le code et **non résolu** : il n'y
a pas de répétition espacée. Une notion échouée crée une révision à +1 jour et
`intervalDays` n'est jamais incrémenté ; « Réviser » est une file de reprise.
Corriger cela est une règle de progression, donc une décision du propriétaire.
- Mandat donné par le propriétaire : ne pas se limiter à appliquer le système
  existant, mais remettre en cause l'expérience et proposer mieux. L'audit est
  explicitement autorisé à contredire `EMOTIONAL_DESIGN_CONTRACT.md`,
  `UX_SPEC.md` et `docs/DESIGN_SYSTEM.md` s'il démontre qu'ils freinent le
  produit.
- Contraintes qui ne sont pas des conventions et restent valables :
  - produit pré-lancement, accès sur candidature, aucun utilisateur payant :
    ni témoignage, ni logo client, ni statistique d'usage, ni prix ;
  - le journal de recherche porte sur la correction IA uniquement ;
  - aucun contrat serveur, URL, règle de progression, pricing ou ledger n'est
    modifié par une refonte d'interface.

**Constats reportés de V4.2, non corrigés là-bas volontairement.** Ils viennent
de captures sur données de test : valables pour la structure, la hiérarchie et
la densité, pas pour le contenu éditorial réel.

- Écran de leçon — « 0 % » affiché deux fois sur une ligne, plus une barre de
  progression vide. Contredit `EMOTIONAL_DESIGN_CONTRACT.md` 5.2, qui exige de
  masquer toute métrique sans action. La même violation a été retirée des pages
  Étape et Module en V4.1 mais survit ici.
- Écran de leçon — le contenu est enterré sous trois niveaux d'étiquettes :
  eyebrow de section, titre « Contenu 1 », puis une carte intitulée
  « Contenu », pour un seul paragraphe.
- Écran de leçon — aucune source affichée, alors que la landing fait de
  « chaque leçon cite sa source » une promesse centrale et que le modèle de
  données porte ressources et références éditoriales. C'est le seul écart
  promesse/produit relevé.
- Écran de leçon — hiérarchie visuelle plate : titre, section et corps ont
  presque le même poids.
- Navigation basse — mêle contexte (module, « Activité 1 sur 4 ») et actions
  (Sommaire, Précédent, Continuer) sans hiérarchie claire. C'est le geste le
  plus répété du produit.

### V4.3-102 — Reprise de la passe UX en stash

- Priorité : P2 · Statut : **DRAFT**
- `stash@{0}` conserve une passe sur notes, profil et découvrir, faite sur une
  branche périmée et non rejouable telle quelle. À réimplémenter dans le
  périmètre de V4.3-101, qui touche les mêmes écrans.

## Lot 200 — pipeline de programmes

Audit réalisé pendant V4.2. Conclusion : **le rendu est réellement générique**
— zéro slug de programme dans les composants, les huit types de bloc passent par
un seul chemin de rendu, le schéma Prisma et l'importeur sont agnostiques. Le
coût est entièrement dans l'authoring et le seed.

### V4.3-201 — Registre de seed par convention

- Priorité : P1 · Statut : **DRAFT**
- `prisma/seed.ts` tient un registre à la main : sept fonctions quasi
  identiques plus un tableau `seedDefinitions`. Cinq des sept fichiers suivent
  déjà `seed/<slug>-program.json` ; deux héritages cassent la convention
  (`fondamentaux-psychologie` → `sample-program.json`,
  `platform-apm-entretien-tryhackme` → `platform-apm-interview-program.json`).
- Normaliser les deux noms, puis remplacer le registre par un manifeste ou un
  parcours de répertoire. Ajouter un programme redevient « ajouter un fichier ».

### V4.3-202 — Parité spec/seed généralisée

- Priorité : P1 · Statut : **DRAFT**
- Les tests de parité sont dupliqués à la main dans `prisma/seed.test.ts` et
  appliqués de façon incohérente : complets pour trois programmes, partiels
  pour un, absents pour deux. Deux validateurs CI portent des signatures
  calculées à la main et ne couvrent que 2 programmes sur 7.
- Remplacer par une boucle unique sur le registre.

### V4.3-203 — Compilateur `content/` vers `seed/`

- Priorité : P1 · Statut : **DRAFT**
- Aucun compilateur n'existe entre les specs éditoriales versionnées et les
  bundles que l'application importe. Un humain recopie chaque leçon dans un
  fichier allant jusqu'à 54 000 lignes et doit les garder identiques. C'est le
  coût d'authoring dominant.

### V4.3-204 — Formats de contenu extensibles

- Priorité : P1 · Statut : **DRAFT**
- Demande du propriétaire : pouvoir étendre les formats — code, images, vidéos
  intégrées, vidéos générées. Trois obstacles, aucun n'étant le schéma :
  - **les types ne portent aucun comportement** : `EMBED` n'est pas un embed,
    les huit types rendent une étiquette et du markdown, `DIVIDER` étant la
    seule branche. Il faut un registre de rendu par type ;
  - **la CSP bloque tous les formats visés** : `vercel.json` pose
    `default-src 'self'` sans `frame-src` ni `media-src`, et
    `img-src 'self' data: blob:`. Contradiction latente déjà présente :
    `SafeMarkdown` autorise les images `https:` que la CSP refuse ;
  - **il n'existe aucun pipeline d'assets** : les 14 images actuelles sont des
    SVG committés dans `public/`, ce qui ne s'étend ni à la vidéo ni à des
    médias fournis par un auteur.
- La décision CSP et le stockage d'assets sont des arbitrages sécurité à rendre
  **avant** qu'un format média soit livré.

### V4.3-205 — Outil de remplacement de programme

- Priorité : P2 · Statut : **DRAFT**
- `src/server/api/admin/sourcelab-program-replacement.ts` code en dur deux slugs
  dans le serveur — seule entorse à la règle « ne pas coder en dur un sujet ».
  Il n'est référencé que par son propre test et un script déjà signalé comme
  reliquat. Retirer, ou généraliser si « remplacer un programme par une nouvelle
  version » doit se reproduire.

## Hors périmètre

- Paiement, packs, remboursements, nouvelle qualification IA : V4.5.
- Authoring de programme par interface admin : possible seulement après le lot
  200 ; le modèle de données et le rendu le supporteraient déjà, mais aucune
  route de création n'existe et la question du rapport à `seed/` n'est pas
  tranchée.

## Définition de terminé V4.3

Périmètre arrêté par le propriétaire, tickets promus un par un avec revue
indépendante, `pnpm quality:v4.1:final` et la matrice e2e verts, références
visuelles acceptées écran par écran, et GO explicite avant promotion.
