# Backlog V4 — Corrections IA et économie d'usage LearnX

## Statut et autorité

- Version : 1.6.1
- Statut : **pilote V4 writing-only autorisé par le Propriétaire — raccord et finition en cours**
- Dernière consolidation : 24 août 2026 — livraison limitée avec technologie actuelle et Totem approuvé
- Baseline : V3.5 officiellement clôturée et son système visuel documenté
- Sources de cadrage : décisions produit sur la correction IA, OpenRouter,
  crédits LearnX, modèle économique, séparation V4/V5 et direction artistique
  Atlas sans vert validée le 10 août 2026

Le contrat composite historique est conservé dans
`docs/V4_AI_CORRECTION_COMPOSITE_SPEC.md` comme preuve de recherche, sans
autorité sur le runtime limité défini par l’amendement du 24 août. Les deux
références Atlas historiques pour les crédits et la correction sont :

- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-correction-flow.html` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-atlas-surfaces.html`.

### Amendement d’exécution autoritaire — 24 août 2026

Cet amendement prime sur les passages expérimentaux antérieurs lorsqu’ils
décrivent le pipeline à activer ou le design à implémenter. Ils restent
consultables comme historique de recherche et ne doivent pas être effacés.

- La V4 est livrée comme pilote **strictement formatif, writing/fr-FR et faible
  risque**, sans effet sur la progression ni prétention de validation de
  maîtrise.
- L’identité runtime est figée sur Sonnet 4.6, prompt 2.2.0, protocole 3.0.1,
  route Anthropic sans fallback ni retry. Une seconde passe du même modèle est
  déclenchée dans la bande inclusive de ±5 points autour du seuil.
- La campagne Writing finale demeure scientifiquement `NO-GO` : sept faux PASS
  et 80,19 % d’accord critériel. L’ouverture limitée relève d’un arbitrage
  produit explicite, avec défauts surveillés ; elle ne doit jamais être décrite
  comme une promotion scientifique.
- Les résultats sont livrés critère par critère. Un critère non fiable est
  présenté « à retravailler » sans score exact ; le prix du devis reste entier,
  conformément à la décision du Propriétaire. Le pilote initial consomme des
  crédits offerts et n’ouvre pas un achat public de correction.
- Le scope exercice writing/fr-FR est bloqué au devis et à l’exécution. L’identité modèle,
  fournisseur, prompt, benchmark et couverture de seconde passe doit concorder
  avec le catalogue actif avant toute réservation.
- Aucun nouvel appel de benchmark, examen, changement de seuil, gold, prompt ou
  modèle n’est autorisé pour cette livraison.
- Le langage visuel ferme est désormais défini par
  `docs/V4_TOTEM_IMPLEMENTATION_MAP.md` et les paquets Totem mobile/desktop
  approuvés le 24 août. Ils remplacent Atlas comme autorité d’implémentation ;
  Atlas reste une référence historique.
- Ordre de livraison : raccord runtime → Totem mobile → validation mobile →
  Totem desktop → validation desktop → surfaces correction/crédits/admin →
  recherche publique → gate de release.

Ce document fixe le périmètre et l'ordre de livraison de V4. Un ticket ne
devient une instruction d'implémentation qu'après :

1. clôture officielle de V3.5 ;
2. réaudit du code et du schéma réellement livrés ;
3. reformulation détaillée du ticket actif avant tout code.

La validation produit du scope a été donnée le 11 août 2026. Toute modification
de périmètre exige désormais un amendement explicite, versionné et approuvé ;
les paramètres de calibration et gates externes listés en fin de document ne
rouvrent pas le scope.

## Historique expérimental — non exécutoire depuis le 24 août 2026

Les amendements et tickets ci-dessous conservent les hypothèses, campagnes et
critères qui ont conduit à la décision actuelle. Toute phrase indiquant
« aucun pipeline promu », « holdout fermé », pipeline composite prioritaire ou
`HARD_OFF` décrit son époque et ne doit pas annuler l'amendement d'exécution du
24 août placé en tête de ce document. La file courante et ses derniers
blocages sont dans `docs/V4_ROADMAP.md`.

### Amendement historique — notation formative et pipeline composite expérimental

Le 12 août 2026, le Propriétaire a validé l'exploration prioritaire d'une
correction formative à deux modèles. Cet amendement remplace les anciennes
contraintes incompatibles de modèle unique, de verdict binaire faisant autorité
et de seconde passe nécessairement exécutée par le même modèle.

- L'expérience apprenant n'affiche plus un verdict académique binaire
  « validé/rejeté » pour les productions libres. Elle présente des niveaux par
  critère, un score **indicatif** calculé côté serveur, une appréciation
  formative, les preuves issues de la réponse et une amélioration prioritaire.
- Le score IA n'autorise, ne bloque et ne termine jamais la progression. La
  soumission et la progression restent gouvernées par leurs règles serveur
  indépendantes.
- V4-003 doit comparer un modèle unique et un pipeline composite versionné. La
  piste prioritaire à éprouver est un correcteur primaire économique, puis un
  vérificateur plus conservateur uniquement sur les résultats sensibles selon
  une règle serveur préenregistrée. Aucun routeur fournisseur ne choisit les
  rôles silencieusement.
- Un désaccord mineur peut produire une appréciation prudente ; un désaccord
  important ne doit jamais être transformé en précision artificielle. Il
  produit un état `UNCERTAIN` ou une fourchette explicitement indicative selon
  le contrat UX qui sera validé par V4-010.
- Les noms de modèles, les tokens et une logique de « vote d'IA » ne sont pas
  exposés à l'apprenant. L'interface indique seulement qu'une vérification peut
  être déclenchée dans le plafond accepté.
- La vérification automatique fait partie du même workflow, du même devis et de
  la même réservation. Elle n'est ni un retry technique, ni une nouvelle action
  vendue séparément.
- Les campagnes historiques restent inchangées et non promues. Leur simulation
  composite est directionnelle, car les prompts/protocoles diffèrent. Le
  pipeline final devra recevoir une identité propre et être évalué comme un
  produit unique avant activation.
- Aucun modèle ni pipeline n'est encore promu ; le holdout scellé reste fermé
  tant que la configuration composite n'a pas franchi son gate de développement.

V4 ne doit jamais être anticipée dans un ticket V3 ou V3.5. Un ticket V4
correspond idéalement à un commit ou une pull request autonome.

## Responsabilités et validation

### Rôles

- **Propriétaire** : arbitrages et validation finale du scope, des prix, du
  lancement et du GO de release.
- **Produit & pédagogie** : contrats de correction, règles pédagogiques,
  priorisation, critères d'acceptation et cohérence du backlog.
- **Développement** : architecture technique, schéma, API, sécurité,
  implémentation, migrations, tests et déploiement. Il est le seul responsable
  de l'écriture du code applicatif.
- **Direction artistique** : spécifications et revues Atlas des nouvelles
  surfaces. Elle ne modifie ni règles métier, ni prix, ni code.
- **Finance & Pricing** : coûts, crédits, devis, marges, packs, réconciliation et
  scénarios économiques. Elle ne modifie ni code, ni critères pédagogiques.
- **Conseil externe** : validation juridique, fiscale, comptable ou conformité
  lorsqu'elle est exigée ; il ne constitue pas un agent d'implémentation.

`Pilote` signifie responsable de faire aboutir le ticket et son dossier de
preuve. `Implémentation` identifie qui produit le code. `Consultation obligatoire`
signifie qu'un ticket ne peut être déclaré terminé sans la revue indiquée. Le
Propriétaire conserve le dernier arbitrage pour toute contradiction.

### Matrice par ticket

| Ticket | Pilote | Implémentation | Consultation obligatoire | Validation finale |
| --- | --- | --- | --- | --- |
| V4-001 | Développement | Développement | Produit & pédagogie, Finance & Pricing | Propriétaire |
| V4-002 | Produit & pédagogie | Développement | Développement | Propriétaire |
| V4-003 | Produit & pédagogie | Développement | Finance & Pricing | Propriétaire |
| V4-004 | Développement | Développement | Produit & pédagogie | Propriétaire |
| V4-005 | Développement | Développement | Produit & pédagogie | Propriétaire |
| V4-006 | Développement | Développement | Finance & Pricing | Propriétaire |
| V4-007 | Finance & Pricing | Développement | Produit & pédagogie | Propriétaire |
| V4-008 | Développement | Développement | Finance & Pricing, Produit & pédagogie | Propriétaire |
| V4-008A | Produit & pédagogie | Développement | Finance & Pricing, Direction artistique | Propriétaire |
| V4-009 | Développement | Développement | Finance & Pricing, Produit & pédagogie | Propriétaire |
| V4-009B | Produit & pédagogie | Développement | Finance & Pricing, Développement | Propriétaire |
| V4-009C | Produit & pédagogie | Développement | Finance & Pricing, Développement | Propriétaire |
| V4-010 | Développement | Développement | Produit & pédagogie, Direction artistique | Propriétaire |
| V4-011 | Produit & pédagogie | Développement | Finance & Pricing, Direction artistique | Propriétaire |
| V4-012 | Finance & Pricing | Développement | Produit & pédagogie | Propriétaire |
| V4-013 | Développement | Développement | Finance & Pricing, conseil externe | Propriétaire |
| V4-014 | Développement | Développement | Finance & Pricing, Direction artistique, conseil externe | Propriétaire |
| V4-015 | Finance & Pricing | Développement | Développement, conseil externe | Propriétaire |
| V4-016 | Produit & pédagogie | Développement | Direction artistique | Propriétaire |
| V4-016A | Direction artistique | Développement | Produit & pédagogie, Finance & Pricing | Propriétaire |
| V4-016B | Direction artistique | Développement | Produit & pédagogie | Propriétaire |
| V4-016C | Produit & pédagogie | Développement | Direction artistique | Propriétaire |
| V4-016G | Direction artistique | Développement | Produit & pédagogie, Finance & Pricing | Propriétaire |
| V4-017 | Développement | Développement | Produit & pédagogie, Finance & Pricing | Propriétaire |
| V4-018 | Finance & Pricing | Développement | Produit & pédagogie | Propriétaire |
| V4-018A | Finance & Pricing | Développement | Produit & pédagogie | Propriétaire |
| V4-019 | Développement | Développement | Produit & pédagogie, Direction artistique, Finance & Pricing, conseil externe selon les gates | Propriétaire |

### Règles de passage entre agents

1. Le pilote reformule le ticket actif et rassemble ses décisions avant code.
2. Développement réaudite les hypothèses et signale toute incompatibilité
   technique avant d'implémenter ; il n'invente ni barème, ni prix, ni design.
3. Les agents consultés rendent leur avis sur les critères relevant de leur
   domaine avant la clôture du ticket, pas après le merge.
4. Direction artistique et Finance & Pricing produisent spécifications, mesures
   et revues ; leurs recommandations deviennent exécutoires seulement après
   arbitrage produit/propriétaire et transmission à Développement.
5. Aucun ticket nécessitant un conseil externe ne peut ouvrir la fonctionnalité
   concernée sur la seule base d'une auto-évaluation interne.

### Gates de consultation et preuves obligatoires

La matrice ne constitue pas à elle seule une consultation. Pour qu'une
consultation obligatoire soit considérée comme réalisée, le dossier du ticket
doit contenir, dans le rapport de l'agent de développement ou dans un artefact
explicitement cité :

- l'agent ou le conseil consulté, la date et le périmètre transmis ;
- la réponse reçue et les décisions qui en résultent ;
- les désaccords ou inconnues encore ouverts ;
- l'arbitrage du Propriétaire lorsque la réponse fixe un prix, une règle
  pédagogique, une promesse marketing, un design ou un gate externe ;
- la traduction de ces décisions en critères d'acceptation vérifiables.

Les statuts de consultation sont `NOT_REQUESTED`, `REQUESTED`, `RECEIVED`,
`ARBITRATED` et `BLOCKED`. `REQUESTED` ne vaut pas validation. Un ticket ne peut
pas être déclaré terminé tant que chaque consultation obligatoire n'est pas
`RECEIVED`, puis `ARBITRATED` lorsque le Propriétaire doit trancher.

Avant de coder, l'agent de développement doit publier un **registre de
consultation du ticket** contenant les lignes de la matrice applicables et leur
statut. Il peut construire un squelette technique réversible pendant une attente
uniquement si :

- aucune valeur métier, tarif, formulation ou décision visuelle n'est inventée ;
- la fonctionnalité concernée reste désactivée ;
- les hypothèses sont marquées explicitement comme non validées ;
- aucun commit de clôture ni push présenté comme ticket terminé n'intervient.

Avant commit de clôture, le rapport doit inclure une section **Consultations et
arbitrages**. Une phrase telle que « le backlog a été lu » ou « l'agent sera
consulté » ne constitue pas une preuve. Pour V4-001 à V4-006 déjà livrés, les
preuves manquantes sont inventoriées rétrospectivement avant la clôture de
V4-007 ; un conflit matériel ouvre un correctif séparé, sans réécrire
silencieusement l'historique.

### Livrables attendus des consultations à partir de V4-007

| Ticket | Livrable externe obligatoire avant clôture |
| --- | --- |
| V4-007 | Finance & Pricing : unité de crédit, actions facturables, coût prudent, marge de sécurité, arrondis, plafonds, version/date d'effet et règle anti-vente à perte. Produit & pédagogie : libellés apprenant, différence entre modes, vérification ciblée automatique, nouvelle analyse volontaire et contenu du devis. Aucun prix actif sans mesures et arbitrage du Propriétaire. |
| V4-008 | Finance & Pricing : allocation offerte, renouvellement, report, limites et ordre de consommation. Produit & pédagogie : compréhension des deux soldes, alertes et demande d'augmentation sans promesse trompeuse. |
| V4-008A | Produit & pédagogie : identité, déclenchement, consolidation et états du pipeline composite. Finance & Pricing : coût, plafond et retries absorbés du workflow. Direction artistique : conformité du contrat aux surfaces Atlas validées. Aucun appel facturable avant gel de l'identité. |
| V4-009 | Finance & Pricing : réservation, règlement, libération, retries absorbés et réconciliation. Produit & pédagogie : consentement, absence de débit surprise et historique compréhensible. |
| V4-009B | Produit & pédagogie : protocole préenregistré, panel représentatif et revue aveugle du pipeline intégré. Finance & Pricing : budget maximal, coût complet par correction utilisable et règle d'arrêt. Développement : répétition Neon, instrumentation et identité technique reproductible. Aucun `24×3` ni holdout sans GO du mini-panel. |
| V4-009C | Produit & pédagogie : panel Gemini modernisé, grille formative et revue aveugle. Finance & Pricing : plafond R&D et coût par correction utilisable. Développement : enveloppe de sécurité déterministe, manifeste, runner et traçabilité append-only. Aucun appel facturable sans GO distinct. |
| V4-010 | Produit & pédagogie : flow complet de correction, critères, nouvelle tentative et nouvelle analyse. Direction artistique : états et hiérarchie des surfaces mobile/desktop avant validation visuelle. |
| V4-011 | Produit & pédagogie : formats éligibles, même grille, autorité du second résultat et absence de revue humaine. Finance & Pricing : coût/devis de la nouvelle analyse. Direction artistique : comparaison des résultats et états incertains. |
| V4-012 | Finance & Pricing : définitions des coûts, marge, réconciliation et alertes. Produit & pédagogie : métriques de qualité interprétables sans réduire la pédagogie à une moyenne. |
| V4-013 | Finance & Pricing : flux marchand et hypothèses de trésorerie. Conseil externe : validation juridique, fiscale, comptable et conditions Revolut avant toute activation. |
| V4-014 | Finance & Pricing : packs, capacités moyennes et absence de vente à perte. Direction artistique : checkout et confiance. Conseil externe : paiement, facturation, rétractation et moyens de paiement autorisés. |
| V4-015 | Finance & Pricing : remboursements, litiges et clôture. Développement : faisabilité et réconciliation. Conseil externe : règles comptables, fiscales et de remboursement. |
| V4-016 | Produit & pédagogie : promesse V5 exacte et placement dans Parcours. Direction artistique : vue d'annonce sans contrôle factice. |
| V4-016A | Direction artistique : landing commerciale. Produit & pédagogie : promesses et preuves produit. Finance & Pricing : seules offres et capacités réellement validées. |
| V4-016B | Direction artistique : gabarits desktop des surfaces V4. Produit & pédagogie : maintien des flows et de la hiérarchie pédagogique. |
| V4-016C | Produit & pédagogie : reprise multi-programmes et priorités. Direction artistique : représentation mobile/desktop sans surcharge. |
| V4-016G | Direction artistique : présentation correction/crédits/paiement. Produit & pédagogie : confiance, limites de l'IA et compréhension du résultat. Finance & Pricing : exactitude des devis, soldes et historiques. |
| V4-017 | Produit & pédagogie : comportements sûrs et messages en cas de blocage. Finance & Pricing : budgets, seuils, kill switch et abus économiques. |
| V4-018 | Finance & Pricing : coûts observés, marges, scénarios et recommandation GO/NO-GO. Produit & pédagogie : qualité minimale et analyse des désaccords. |
| V4-018A | Finance & Pricing : budgets et coût d'acquisition par cohorte. Produit & pédagogie : compréhension de l'essai, absence de promesse trompeuse et séparation public/famille-amis/early adopters. |
| V4-019 | Produit & pédagogie, Direction artistique et Finance & Pricing : rapports finaux de leur domaine. Conseil externe : preuves exigées par les gates paiement/conformité. Le Propriétaire rend seul le GO final. |

## Cap V4

V4 livre :

- la correction assistée par IA des productions textuelles libres non
  déterministes ;
- des contrats de correction pédagogiques versionnés et auditables ;
- un fournisseur IA central OpenRouter, appelé uniquement côté serveur ;
- un benchmark reproductible pour sélectionner et mettre à jour les modèles ;
- une comptabilité d'usage LearnX exprimée en crédits, jamais en tokens pour
  l'utilisateur ;
- des allocations offertes et des crédits achetés strictement séparés ;
- un devis ou plafond visible avant chaque action payante ;
- une réservation atomique, un règlement au coût LearnX final et la libération
  immédiate de la différence ;
- un tableau de bord administrateur sur coûts, usages, marge et incidents ;
- l'achat de packs via Revolut Merchant, avec les moyens de paiement disponibles
  dont carte, Revolut Pay, Apple Pay et Google Pay lorsque l'appareil et le
  compte commerçant les permettent ;
- les protections de sécurité, confidentialité, budget et exploitation
  nécessaires à un service IA payant ;
- une vue « Créer une formation » explicitement non fonctionnelle annonçant V5 ;
- l'enrichissement commercial de la landing V3.5 avec capacités IA et tarifs
  réellement validés ;
- l'intégration des nouvelles surfaces V4 dans les gabarits, tokens et
  primitives mobile/desktop livrés et documentés par V3.5.

V4 ne livre pas :

- de chatbot, tuteur conversationnel ou assistant omniprésent ;
- d'explication IA libre en dehors de la correction structurée ;
- de génération de programme, étape, module, leçon, quiz ou exercice ;
- d'éditeur Créateur, de brouillon généré ou de publication assistée ;
- de marketplace, abonnement illimité, transfert ou retrait de crédits ;
- de correction automatique des quiz déjà déterministes ;
- de validation scientifique ou professionnelle par l'IA ;
- de revue ou correction opérationnelle par un étudiant, un administrateur, un
  créateur ou un autre humain ;
- de correction audio, image, vidéo ou autre preuve multimodale, préparée dans
  les contrats mais reportée à une version ultérieure ;
- de promesse de note fiable sans contrat, calibration et garde-fous ;
- de modèle ou tarif fournisseur codé en dur dans l'interface.

La génération guidée de formations, son questionnaire adaptatif, le funnel
auteur → contrôles → réviseur, la détection des parcours existants, l'analyse
des compétences manquantes, la composition de contenus réutilisés et la
publication de contenu généré appartiennent à V5.

## Responsabilités transférées à V3.5

La création de `BACKLOG_V3_5.md` retire de V4 les fondations qui doivent être
visibles et stabilisées avant l'IA et le billing :

| Ancien cadrage V4 | Source de vérité | Rôle restant en V4 |
| --- | --- | --- |
| V4-016D marque et tokens | V3.5-001 | Aucun ; V4 consomme les tokens validés |
| V4-016E primitives | V3.5-002 | Aucun ; V4 réutilise les primitives |
| Shells/navigation | V3.5-003 | V4 réutilise les shells sans navigation IA/finance parallèle |
| V4-016F apprentissage mobile | V3.5-004 | Revue des seules nouvelles surfaces V4 |
| V4-016B desktop global | V3.5-005 | V4-016B adapte correction, admin et paiement |
| V4-016A landing initiale | V3.5-006 | V4-016A ajoute capacités et offres validées |
| Contacts landing | V3.5-007 | Aucun CRM V4 ; cette vue reste le suivi simple |
| Icône application | V3.5-006B | Aucun redesign V4 ; manifestes et variantes sont réutilisés |
| V4-016H QA/design system | V3.5-008 et V3.5-009 | V4-019 contrôle l'intégration finale |

Les identifiants V4-016D, V4-016E, V4-016F et V4-016H restent volontairement
inutilisés dans V4 après ce transfert. Ils ne doivent pas être recréés.

## Références Atlas héritées de V3.5

- **A1 — Pack principal** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-screen-pack.html` ;
- **A2 — Contrat de composants** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-component-contract.html` ;
- **A3 — Pack complémentaire** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-screen-pack-two.html` ;
- **A4 — Administration Contacts** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-admin-contacts.html` ;
- **A5 — Landing avec preuves produit** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-landing-product.html` ;
- **A6 — Icône Atlas papier** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-icon-paper-option.html`.

Ces références fixent Atlas sans vert. V4 consomme les tokens, primitives,
shells et règles de QA clôturés en V3.5 sans rouvrir la palette, les fontes ou
la grammaire visuelle.

## Invariants produit, pédagogie et finance

1. Le serveur reste l'unique autorité de solde, réservation, règlement, score,
   validation, progression et droits d'accès.
2. L'utilisateur ne voit jamais de tokens. Il voit des crédits LearnX, une
   allocation, un prix estimé, un plafond et un historique compréhensible.
3. Une correction n'est possible que si l'activité possède un contrat de
   correction publié, versionné et compatible.
4. Le modèle ne choisit ni les critères, ni leurs poids, ni le seuil de réussite.
   Il applique un contrat pédagogique authoré et le serveur recalcule le score.
5. La sortie IA cite les éléments de la réponse justifiant chaque appréciation ;
   elle ne doit pas inventer de preuve absente.
6. Le modèle, le prompt, le contrat, le catalogue de prix et le résultat sont
   versionnés afin de rendre toute correction reproductible et auditable.
7. Aucun routeur automatique ne choisit silencieusement un modèle pour une
   correction évaluée. V4 peut promouvoir un modèle unique ou un pipeline
   composite dont chaque rôle, modèle, fournisseur, profil, prompt et règle de
   déclenchement est épinglé et évalué par V4-003. Un changement de composant ou
   de règle crée une nouvelle identité et exige une nouvelle promotion.
8. Une correction IA est étiquetée comme telle et ne vaut jamais validation
   scientifique, professionnelle ou humaine.
9. Toute évaluation dont la correction est déterministe conserve le moteur
   actuel et ne consomme aucun crédit IA. Cela inclut les quiz et
   mini-évaluations, y compris une réponse courte comparée à une liste de
   réponses acceptées. Une production libre évaluée par rubrique relève en
   revanche de la correction IA V4.
10. **Doctrine de livraison partielle (décision du Propriétaire, 23 août 2026,
    remplaçant la règle historique de remboursement intégral).** La correction
    est livrée critère par critère. Un critère dont les preuves ne peuvent pas
    être vérifiées avec exactitude est livré en état « à retravailler :
    analyse non fiable — modifier cette partie et resoumettre ». Le devis
    accepté avant paiement est débité en intégralité, quel que soit le nombre
    de critères livrés ; il n'existe aucun remboursement, compensation,
    relance gratuite ni crédit de service. Le devis doit l'énoncer
    explicitement avant le consentement (des critères peuvent revenir en état
    « à retravailler » sans compensation). Pour que la resoumission reste
    économique, l'analyse suivante d'une même production peut être un devis
    partiel portant sur les seuls critères « à retravailler », au prorata de
    leurs poids — une action nouvelle et facturée, jamais une compensation.
    LearnX n'endosse aucune responsabilité financière envers l'apprenant pour
    un incident modèle, au-delà de l'information honnête de l'état livré.
11. Le ledger est immuable, idempotent, lié à l'utilisateur et ne permet jamais
    un solde négatif ni une double attribution.
12. L'allocation offerte et les crédits achetés restent séparés jusque dans la
    ventilation des réservations et règlements. Leur ordre de consommation est
    une politique serveur versionnée encore à arbitrer. Les crédits achetés sont
    non transférables, non convertibles en espèces et utilisables uniquement
    dans LearnX ; leur éventuelle expiration n'est pas inventée par V4-008.
13. Les crédits vendus représentent une obligation future d'exécution : la
    trésorerie correspondante ne peut pas être considérée intégralement comme
    marge disponible.
14. Le prix utilisateur inclut coût fournisseur, frais, incidents,
    infrastructure, prélèvements et marge cible. Le coût fournisseur et le prix
    utilisateur restent deux données distinctes.
14A. Le coût fournisseur d'un workflow est la somme des coûts OpenRouter réels
    de tous ses appels utilisables ou absorbés. Il n'est jamais reconstruit à
    des fins de règlement à partir d'un nombre de tokens affiché publiquement.
15. Les exemples commerciaux d'usage utilisent la médiane observée ; les prix
    et plafonds utilisent un percentile prudent, initialement P90.
16. Aucune action ne devient « illimitée ». Des limites globales, individuelles,
    temporelles et par action existent côté serveur.
17. Les secrets fournisseurs et paiements ne sont jamais exposés au navigateur,
    journalisés ou inclus dans une réponse API.
18. La page V5 « Créer une formation » ne lance aucun appel IA, ne réserve aucun
    crédit et ne simule aucune fonctionnalité inexistante.
19. L'application installée ouvre toujours l'origine applicative : page d'accueil
    authentifiée si la session est valide, connexion sinon. Elle n'ouvre jamais
    la landing page marketing par défaut.
20. Toute correction opérationnelle est soit déterministe, soit réalisée par
    IA. Aucun étudiant, administrateur, créateur ou autre utilisateur ne peut
    attribuer, confirmer ou remplacer un score.
21. Une contestation déclenche une nouvelle analyse IA versionnée et
    argumentée ; elle ne transforme pas la correction en conversation libre.
22. Après un résultat composite toujours insuffisamment fiable, LearnX ne
    fabrique ni note précise ni verdict : l'apprenant peut soumettre une
    nouvelle tentative.
23. La seconde correction utilise exactement le même snapshot immuable de la
    grille, des critères, des poids et du seuil que la première.
24. Toute seconde correction demandée par l'apprenant fait l'objet d'un devis
    proportionnel à son coût estimé, d'une réservation et d'un règlement comme
    une autre action IA. Une erreur technique reste à la charge de LearnX.
25. Une nouvelle analyse volontaire valide produit une nouvelle version du
    score indicatif et du feedback ; elle ne réécrit pas la première et n'a
    aucun pouvoir bloquant sur la progression. Le nombre, la forme et les
    conditions de contestation restent une politique versionnée à arbitrer.
26. Lorsque LearnX déclenche automatiquement un vérificateur ou une passe de
    contrôle, son coût prudent est inclus dans le plafond du devis initial.
    Aucun débit ou consentement surprise n'intervient ; la part non consommée
    est libérée.
26A. Le débit final ne dépasse jamais le plafond accepté. Un dépassement de coût
    fournisseur est absorbé par LearnX, audité et déclenche le seuil d'alerte ou
    la coupure configurée ; il ne crée jamais un débit complémentaire silencieux.
27. Les identités produit globales sont `Membre` et `Administrateur`. Le rôle
    technique `CREATOR` reste transitoirement compatible mais aucune nouvelle
    fonctionnalité V4/V5 ne doit dépendre directement de sa valeur.
28. Apprenant, propriétaire, auteur, éditeur et futur distributeur sont des
    relations ou capacités contextuelles à un programme. Tout membre actif peut
    apprendre et, en V5, créer un brouillon ; créer, publier et commercialiser
    restent des permissions distinctes.

## Décisions produit validées

- Ligne directrice de marque et d'interface V4 :

  > L'image à construire est celle d'un produit éditorial sérieux et calme, à
  > mi-chemin entre un environnement personnel d'apprentissage et une plateforme
  > de formation structurée — pas celle d'un « AI learning copilot » générique.

  Cette direction s'applique à la landing, à l'application mobile installée, au
  desktop, aux corrections, au billing et aux surfaces d'administration. Elle
  implique une hiérarchie claire, une densité maîtrisée, des formulations
  précises, des preuves visibles et une présence de l'IA limitée aux endroits où
  elle rend un service explicite.
- V4 hérite intégralement des invariants, tokens, primitives, gabarits et usages
  interdits de `BACKLOG_V3_5.md`. Un ticket V4 peut appliquer ou étendre ce
  système aux nouvelles surfaces, jamais réinventer silencieusement la marque.
- V4 couvre les productions textuelles qui nécessitent un jugement par rubrique :
  exercices libres puis évaluations d'étape textuelles. Audio, image, vidéo et
  autres preuves multimodales sont reportés, sans empêcher un contrat extensible.
- Les quiz et mini-évaluations dont la réponse peut être corrigée par le moteur
  déterministe existant n'appellent jamais l'IA.
- Il n'existe aucune file de correction humaine. L'apprenant peut contester un
  retour en donnant un argument ; LearnX lance alors une seconde correction IA
  indépendante et conserve les deux résultats sans écrasement.
- Les deux passes appliquent la même version de rubrique. L'argument de
  contestation sert à signaler une interprétation contestée ; toute information
  nouvelle destinée à améliorer la réponse exige une nouvelle tentative dans
  laquelle l'apprenant resoumet l'intégralité du devoir, et non un complément
  isolé rattaché à l'ancienne réponse.
- Les campagnes Terra, Sonnet, Gemini Flash, Mistral, Opus et autres candidats
  documentés sont des preuves de sélection, jamais des choix implicites de
  production. V4-003 évalue désormais aussi une architecture composite
  explicite, avec correcteur primaire et vérificateur ciblé épinglés.
- La piste composite prioritaire est exploratoire : le primaire produit les
  niveaux et le feedback ; le serveur calcule le score indicatif ; le
  vérificateur intervient selon une règle déterministe sur les résultats
  sensibles et un échantillon de contrôle. Aucun désaccord ne devient
  automatiquement une validation ou une moyenne.
- Une nouvelle analyse volontaire est facturée en crédits selon son devis propre
  et son coût final. Elle produit une nouvelle version formative sans effacer la
  première correction ni devenir une autorité de progression.
- Si une vérification est imposée par le pipeline, elle est couverte par la
  réservation du devis initial. Si l'apprenant conteste un résultat utilisable,
  la nouvelle analyse constitue une nouvelle action avec devis et confirmation
  propres.
- LearnX n'expose pas deux statuts globaux et exclusifs `Étudiant`/`Créateur`.
  Tout compte actif est un membre capable d'apprendre ; les droits sur un
  programme proviennent de relations et capacités contextuelles. `ADMIN` reste
  un rôle global de gouvernance et `CREATOR` un mécanisme transitoire à migrer.
- La page Parcours devient le point d'entrée vers « mes parcours », la découverte
  des parcours et « créer une formation ».
- En V4, « créer une formation » ouvre uniquement une annonce honnête. En V5,
  cette même entrée ouvrira une nouvelle session conversationnelle de conception.
- En V5, aucune génération ne commence avant une recherche des parcours publiés
  pouvant satisfaire tout ou partie du besoin. Une couverture partielle doit
  conduire à proposer un parcours composite et la génération des seuls manques,
  jamais à copier silencieusement un programme existant.
- Le domaine public principal présente LearnX et son lancement ; l'application
  et sa PWA utilisent une entrée dédiée. L'architecture recommandée est un
  sous-domaine applicatif afin d'isoler routes, session, service worker et cache.

## Décisions commerciales provisoires

Ces valeurs servent à concevoir le système ; elles restent configurables et ne
doivent être publiées qu'après benchmark et validation fiscale/comptable.

- Unité lisible envisagée : `1 crédit LearnX = 0,01 €` de prix utilisateur.
- Cette parité, équivalente à 100 crédits par euro, est une hypothèse non
  validée. Elle reste configurable, versionnée et inactive tant que le
  Propriétaire ne l'a pas explicitement arbitrée.
- Recharges initiales envisagées, sans différence fonctionnelle :
  `Essentiel` 1 000 crédits / 10 €, `Régulier` 2 500 / 25 € et
  `Intensif` 5 000 / 50 €.
- Aucun bonus de volume au lancement.
- Marge de contribution cible initiale : 10 % ; alerte sous 8 % ; revue
  tarifaire sous 5 %. Ne parler de marge nette qu'après déduction des coûts
  fixes, CFE, comptabilité et autres charges réellement applicables.
- Le stress-test utilise provisoirement le scénario micro-BNC prudent. BIC ou
  BNC dépend de la qualification réelle de l'activité et ne constitue pas un
  paramètre commercial librement choisi.
- Le calcul de marge de contribution intègre cotisations et CFP, VFL seulement
  s'il est applicable et choisi, frais de paiement, coût OpenRouter chargé,
  change, TVA non récupérable si elle est confirmée, infrastructure variable et
  erreurs ou incidents absorbés.
- Aucun prix ne dépend de l'inactivité supposée des utilisateurs ni d'une
  promotion fournisseur temporaire.
- Coefficients de sensibilité à tester : environ 2,6 fois le coût fournisseur
  brut agrégé dans le scénario central prudent et jusqu'à 2,9–3,0 dans le
  scénario défavorable. Aucun coefficient ne devient une constante définitive.
- Les crédits achetés sont reportables et sans expiration au lancement sous
  réserve de validation juridique/comptable. L'allocation offerte ne se reporte
  pas et sa période de renouvellement est explicite.
- Recharge OpenRouter centralisée et suffisamment grande pour amortir les frais
  fixes de recharge.
- Points externes bloquants avant vente : qualification BIC/BNC, éligibilité au
  versement libératoire, traitement TVA des factures OpenRouter, conditions
  Revolut Merchant, qualification fiscale/juridique des crédits fermés et
  obligations de facturation, rétractation et remboursement.

### Baseline OpenRouter de simulation — 12 août 2026

Cette baseline sert aux stress-tests et au dimensionnement des benchmarks. Elle
ne constitue ni un catalogue LearnX actif, ni une garantie fournisseur. Les
prix prudents ignorent les promotions temporaires.

| Candidat | Identifiant canonique épinglé | Entrée prudente / M | Sortie / M | Cache read / M | Particularité |
| --- | --- | ---: | ---: | ---: | --- |
| GPT-5.6 Terra | `openai/gpt-5.6-terra-20260709` | 2 $ | 12 $ | 0,20 $ | tarif hors promotion 50 % |
| Claude Sonnet 4.6 | `anthropic/claude-4.6-sonnet-20260217` | 3 $ | 15 $ | 0,30 $ | cache write 3,75 $, ou 6 $ pour 1 h |
| Gemini 3.6 Flash | `google/gemini-3.6-flash-20260721` | 1,50 $ | 7,50 $ | 0,15 $ | recherche web 0,014 $ |
| GPT-5.6 Luna, V5 seulement | `openai/gpt-5.6-luna-20260709` | 0,20 $ | 1,20 $ | 0,02 $ | tarif hors promotion 50 % |
| GPT-5.6 Sol, V5 seulement | `openai/gpt-5.6-sol-20260709` | 5 $ | 30 $ | 0,50 $ | recours exceptionnel à démontrer |

- Les identifiants d'appel non datés peuvent être conservés dans une table de
  découverte, mais les benchmarks et résultats utilisent le slug canonique.
- Les recherches web sont budgétées séparément : hypothèse prudente de 0,01 $
  pour OpenAI/Sonnet et 0,014 $ pour Flash.
- L'approvisionnement OpenRouter ajoute 5,5 %, avec minimum de 0,80 $ par achat.
- Le scénario TVA défavorable reste une sensibilité séparée : coût fournisseur
  × 1,055 × 1,20 = × 1,266, hors change.
- Au-delà de 272k tokens d'entrée sur les modèles OpenAI, une grille majorée est
  déclarée ; la conception de programmes longs V5 doit donc travailler par lots.

Pour V4-003, les profils théoriques de passage unique sont :

| Taille hypothétique | Terra médiane/P90 | Sonnet médiane/P90 | Flash médiane/P90 |
| --- | ---: | ---: | ---: |
| Courte, 4k/2k puis 8k/4k entrée/sortie | 0,032/0,064 $ | 0,042/0,084 $ | 0,021/0,042 $ |
| Moyenne, 15k/4k puis 30k/8k | 0,078/0,156 $ | 0,105/0,210 $ | 0,053/0,105 $ |
| Longue, 60k/8k puis 120k/16k | 0,216/0,432 $ | 0,300/0,600 $ | 0,150/0,300 $ |

Ces coûts théoriques ne remplacent jamais `usage.cost`, les répétitions du
benchmark ou les mesures live. Le prix seul ne sélectionne pas le modèle.

## États principaux à spécifier

### Correction

```text
NOT_REQUESTED
    ↓ devis accepté + crédits réservés
RESERVED
    ↓ correcteur primaire
PROCESSING_PRIMARY
    ├── vérification ciblée ──► VERIFYING
    ├── résultat utilisable ──► COMPLETED
    ├── résultat provisoire ──► PROVISIONAL
    ├── erreur récupérable ──► RETRY_PENDING
    └── échec final ──► UNUSABLE_RELEASED | FAILED_RELEASED

VERIFYING
    ├── écart non matériel ──► COMPLETED
    ├── écart matériel ──► UNCERTAIN
    └── aucun résultat exploitable ──► UNUSABLE_RELEASED
```

`COMPLETE` ou la réussite pédagogique ne provient jamais directement du texte
libre du modèle. Le serveur valide la structure, applique la rubrique et décide
la transition autorisée. Une nouvelle analyse volontaire produit une nouvelle
version et ne modifie jamais silencieusement la première. Aucun résultat IA,
initial ou ultérieur, ne devient une autorité de progression.

### Réservation de crédits

```text
CREATED
    ├── fonds insuffisants ──► REJECTED
    └── fonds bloqués ──► RESERVED
                              ├── succès ──► SETTLED + différence RELEASED
                              ├── annulation ──► RELEASED
                              └── expiration ──► RELEASED
```

### Paiement

```text
CREATED → PENDING → PAID → FULFILLED
              ├── FAILED
              └── EXPIRED

PAID/FULFILLED → REFUND_PENDING → REFUNDED
PAID/FULFILLED → DISPUTED → WON | LOST
```

Le webhook serveur vérifié fait autorité. Une page de retour navigateur ne peut
jamais créditer un compte.

## Ordre de livraison proposé

```text
Lot cadrage et preuves
V4-001 → V4-002 → V4-003

Lot fournisseur et moteur de correction
V4-003 → V4-004 → V4-005

Lot crédits et tarification
V4-001 → V4-006 → V4-007 → V4-008

Lot alignement composite correctif
V4-003 + V4-004 + V4-005 + V4-007 + V4-008 → V4-008A

Lot correction apprenant
V4-008A → V4-009 → V4-009B (NO-GO documenté) → V4-009C → V4-010 → V4-011

Lot administration et exploitation
V4-009 → V4-012
V4-004 + V4-006 → V4-017

Lot paiement
V4-006 + V4-008 → V4-013 → V4-014 → V4-015

Lot annonce V5
V4-016, indépendant du moteur IA mais postérieur à la clôture V3.5

Lot acquisition et lancement
V3.5-006 fournit la landing et la collecte initiale ; V4-016A ajoute les
capacités IA et les tiers après V4-018, puis ouvre l'achat après V4-014

Lot polish desktop
V3.5-005 fournit les gabarits ; V4-016B les applique aux surfaces V4-010,
V4-012, V4-014, V4-016, V4-016A et V4-016G

Lot accueil multi-programmes
V4-016C après clôture V3.5, indépendant du moteur IA ; son rendu desktop est
revu par V4-016B

Lot expérience correction et finance
V3.5-009 + surfaces V4-007/V4-010/V4-011/V4-014 → V4-016G

Lot sortie
V4-001…V4-017 + V4-016A + V4-016B + V4-016C + V4-016G
→ V4-018 → V4-019
```

### Gates de livraison validées

- **V4A — correction pilote sans paiement réel** : V4-001 à V4-010, y compris
  le correctif V4-008A, la preuve V4-009B et le gate V4-009C, V4-012,
  V4-016, V4-016C, V4-016G pour les surfaces disponibles et V4-017 au niveau
  requis. Elle livre corrections d'exercices textuels, allocations gratuites,
  ledger, administration et mesure des coûts. Les évaluations d'étape et les
  achats restent désactivés.
- **V4B — évaluations, commerce et clôture** : V4-011, V4-013 à V4-015,
  compléments V4-016A/B/G, V4-018 et V4-019. Elle ouvre les évaluations d'étape
  textuelles, packs et paiement seulement après validation économique, fiscale,
  juridique, sécurité et exploitation.
- V4A peut être testée et déployée à un groupe pilote sans attendre V4B. V4 ne
  reçoit toutefois son verdict final qu'après V4B et V4-019.

## Jalons livrables et changements visibles

Le découpage doit permettre de tester V4 avant que l'ensemble du billing soit
ouvert. Un jalon n'autorise pas à contourner les dépendances de ses tickets.

### Jalon A — Fondations contrôlables

Tickets principaux : V4-001 à V4-008A et V4-017 au niveau requis par le pilote.

- Les contrats, modèles, coûts, crédits et limites sont testables par
  l'administration, sans paiement réel.
- Les utilisateurs ne voient encore aucune promesse de correction payante.
- La vue V4-016 peut être livrée dès ce jalon : c'est le premier changement
  visible, mais elle demeure strictement informative.
- La landing, la liste d'attente, les primitives et les gabarits V3.5 sont la
  baseline ; V4-016A n'affiche encore aucun prix ou achat non validé.
- V4-016B peut préparer l'intégration desktop des nouvelles surfaces dès que
  leurs contrats sont stables.
- L'accueil multi-programmes V4-016C peut être livré indépendamment de l'IA :
  chaque programme suivi redevient visible et reprenable depuis Aujourd'hui.

### Jalon B — Première correction utilisable

Tickets principaux : V4-009 et V4-010.

V4-009 ne commence qu'après clôture de V4-008A. Le jalon ne peut donc pas
réutiliser le chemin mono-modèle ou binaire des anciennes fondations.

- Un utilisateur pilote peut faire corriger un exercice textuel éligible avec
  une allocation offerte.
- Il voit le coût maximal avant confirmation, puis la correction, le montant
  réellement débité et la différence libérée.
- Aucun achat n'est encore nécessaire : ce jalon valide la qualité et
  l'économie réelle avant d'accepter de l'argent.

### Jalon C — Supervision et évaluation élargie

Tickets principaux : V4-011 et V4-012.

- Les cas incertains peuvent recevoir une seconde correction IA indépendante ;
  aucun humain ne corrige ou n'arbitre la soumission.
- L'administrateur suit qualité, coûts, incidents, soldes et marge projetée.
- Les évaluations d'étape sont ouvertes après preuve de fiabilité sur les
  exercices textuels. Cette progression réduit le risque de lancement mais ne
  les repousse pas hors de V4.

### Jalon D — Achat de crédits

Tickets principaux : V4-013 à V4-015.

- Les packs et moyens de paiement validés sont disponibles à un groupe pilote.
- L'attribution repose exclusivement sur les webhooks vérifiés et le ledger.
- Remboursements, litiges et clôture sont opérationnels avant élargissement.

### Jalon E — V4 publiable

Tickets principaux : V4-016A, V4-016B, V4-016G, V4-018 et V4-019.

- Les prix sont issus des mesures, le pilote respecte les seuils stop/go et les
  parcours critiques disposent d'un rollback.
- La landing affiche uniquement le catalogue commercial validé et distingue
  clairement inscription au lancement, candidature pilote et création de compte.
- L'audit final confirme que landing, correction, administration et paiement
  respectent la baseline V3.5 avec des données réalistes.
- V4 n'est officiellement terminée qu'après audit GO explicite.

---

## V4-001 — ADR correction IA, financement et frontières de confiance

**Priorité : P0. Dépendances : V3.5 officiellement clôturée.**

### Périmètre

- Réauditer les soumissions, rubriques, rôles, capacités, progression, audit,
  confidentialité, environnements et déploiement réellement livrés par V3.
- Comparer et arrêter l'architecture du fournisseur central, des contrats de
  correction, du ledger, des réservations, du catalogue de prix et des paiements.
- Définir les frontières de données entre LearnX, OpenRouter, les fournisseurs
  de modèles et Revolut.
- Documenter les menaces : prompt injection, exfiltration, double dépense,
  replay webhook, concurrence, fuite de clé, dépassement de budget et résultat
  non conforme.
- Inventorier toutes les productions non déterministes à couvrir dans V4 et
  définir l'ordre de calibration de leurs formats de preuve.

### Hors périmètre

- Migration, SDK, secret, appel fournisseur, paiement ou UI.

### Critères d'acceptation

- L'ADR contient options rejetées, décisions, états, responsabilités, stratégie
  de migration et rollback.
- Les données envoyées au fournisseur, leur rétention et l'information de
  l'utilisateur sont explicites.
- Les quiz et mini-évaluations corrigibles de manière déterministe, ainsi que
  les activités sans contrat, restent hors IA.

### Tests et risques

- Revue produit, pédagogique, sécurité, finance et exploitation.
- Risque principal : concevoir un wallet ou un score piloté par le frontend.

---

## V4-002 — Contrat de correction pédagogique versionné

**Priorité : P0 pédagogie. Dépendances : V4-001.**

### Clôture de livraison V4-002-PUBLISH — 24 août 2026

- L'activité `fondamentaux-psychologie / formuler-question-delimitee /
  activity-2` porte la consigne exacte validée, avec `PCC` et les deux
  scénarios synthétiques séparés.
- Le bundle seed porte le contrat immuable
  `v4-writing-framework-selection-fr@1.0.0`, `PUBLISHED`, `writing/fr-FR` et
  `TEXT` uniquement.
- La projection runtime conserve trois critères et dix éléments attendus, sans
  compensation entre A et B. Le seuil de 70 n'est qu'un seuil de routage pour
  la seconde passe ; il ne constitue ni un verdict académique ni une preuve de
  maîtrise.
- Le seed valide le contrat avec le schéma serveur puis le persiste dans
  `Exercise.rubric`. Une activité sans contrat valide et publié reste masquée.
- Le contrat atomique v2, ses oracles et ses campagnes restent conservés comme
  recherche historique et dette V4.1 ; ils ne sont ni supprimés ni décrits
  rétroactivement comme le runtime livré.

### Périmètre

- Définir un schéma versionné de contrat de correction pour toute production
  non déterministe : exercice libre, projet, étude de cas, exercice pratique,
  devoir écrit, oral documenté, simulation documentée ou examen cumulatif.
- Inclure objectifs, critères, poids, niveaux de performance, éléments attendus,
  variantes acceptables, erreurs fréquentes, sources autorisées, exemples
  étalonnés, seuil et règles de seconde correction IA.
- Définir la sortie structurée minimale du modèle : niveau et confiance par
  critère, statut de preuve, citations issues de la réponse et feedback. Le
  serveur calcule le score indicatif, l'appréciation générale, les états de
  vérification et toute décision de routage ; le modèle ne produit pas de
  verdict académique.
- Étendre le guide d'authoring sans imposer un nombre arbitraire de critères.
- Préparer un inventaire des activités existantes éligibles, incomplètes ou
  explicitement non compatibles.
- Limiter l'exécution V4 au texte. Le contrat peut réserver des types de preuve
  futurs — fichier, image, audio, transcription ou données structurées — sans
  les rendre acceptables tant qu'un ticket ultérieur ne les autorise pas.

### Hors périmètre

- Génération automatique de rubriques, migration globale et correction live.

### Critères d'acceptation

- Les poids totalisent 100 % et sont authorés, jamais inférés au runtime.
- Les bandes d'appréciation et règles d'affichage du score sont versionnées ;
  elles ne créent aucun verrou de progression.
- Le contrat publié est immuable ; une nouvelle version n'altère pas les
  corrections historiques.
- Une activité sans contrat valide ne peut pas proposer une correction IA.
- Les informations éditoriales de preuve restent compatibles avec les règles
  de sourcing existantes.

### Tests et risques

- Fixtures valides/invalides, compatibilité avec les rubriques existantes et
  revue pédagogique humaine.
- Risque : transformer une rubrique vague en fausse précision chiffrée.

---

## V4-003 — Corpus étalon et banc d'essai des modèles

**Priorité : P0. Dépendances : V4-002.**

### Périmètre

- Constituer un corpus anonymisé de réponses étalonnées pour le développement
  avec validation pédagogique humaine : réussies,
  partielles, erronées, ambiguës, hors sujet et potentiellement injectées.
- Comparer au moins trois candidats sur français, accord par critère,
  hallucination, calibration, sécurité, latence et coût complet.
- Mesurer médiane, P75, P90, taux de retry, taux de seconde correction IA,
  désaccord entre modèles et variabilité.
- Mesurer la qualité formative du pipeline : erreur absolue de score, écarts
  ordinaux par critère, écarts d'au moins deux niveaux, stabilité du score et de
  l'appréciation, exactitude des preuves, qualité du feedback et taux de
  résultats `UNCERTAIN`/`PROVISIONAL`.
- Définir les seuils de promotion, régression et rollback d'un modèle.
- Produire un rapport sans envoyer de donnée réelle non anonymisée.
- Conserver les campagnes mono-modèle comme baselines et évaluer séparément un
  pipeline composite épinglé. La piste prioritaire est Mistral primaire puis
  Sonnet vérificateur sur règle serveur ; ces rôles restent non promus tant que
  le benchmark composite et sa revue aveugle ne sont pas terminés.
- Préenregistrer avant appel la règle de déclenchement du vérificateur, la règle
  de désaccord, le budget, les profils et un échantillon aléatoire de contrôle.
- Mesurer séparément correction automatique composite, retry technique et
  nouvelle analyse volontaire. Aucun de ces workflows ne partage abusivement
  ses métriques ou son identité de promotion.

### Hors périmètre

- Choix intuitif fondé seulement sur une réputation ou un benchmark public.
- Déploiement en production.
- Vote à la majorité, moyenne naïve des scores, sélection automatique du modèle
  le plus sévère ou vérification croisée systématique de toutes les réponses.
- Benchmark de conception ou de génération de formations V5.

### Critères d'acceptation

- Un pipeline final est choisi par preuve. Son primaire, son vérificateur, sa
  règle de déclenchement, sa résolution des écarts et son coût sont versionnés
  dans une identité unique ; aucune combinaison ad hoc n'est autorisée.
- Les identifiants exacts sont épinglés ; aucun alias `latest` ou routeur auto.
- Le jeu de régression est réutilisable lors de tout changement.
- Les gates durs portent sur la sécurité, les preuves et l'utilisabilité finale.
  Pour la bêta, `eventualUnusableRunRate` doit rester ≤ 2 % et aucune sortie
  invalide ne peut être montrée ou débitée. `firstAttemptInvalidRate` devient un
  indicateur opérationnel avec cible ≤ 10 %, sans masquer les retries.
- L'accord exact par critère vise ≥ 85 %. Les écarts adjacents et matériels sont
  distingués par une règle préenregistrée et calibrée. Aucun seuil d'état ou de
  score n'est inventé dans le ticket : il doit être mesuré, versionné et validé
  avant activation.
- La campagne composite doit inclure la revue aveugle de tous les écarts
  importants, un échantillon d'accords et une mesure hors déclenchement. Le
  holdout reste scellé jusqu'au GO de ce gate de développement.

### Tests et risques

- Échantillon suffisant par type d'activité et analyse humaine du corpus et des
  désaccords pendant le benchmark uniquement ; ce contrôle qualité interne
  n'est pas une correction opérationnelle d'un exercice utilisateur.
- Risque : suradapter le prompt à un corpus trop petit.

### État au 23 août 2026 — gate de développement franchi (identité v2-2)

Amendement de statut (détails et décisions dans
`docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` §6 et
`docs/V4_AI_MODEL_BENCHMARK_REPORT.md`, amendement du 23 août) :

- politique de gate v2 préenregistrée (`benchmarks/ai-correction/benchmark.v2*.json`) :
  sécurité bloquante (faux PASS = 0, écart deux niveaux = 0, échec final ≤ 2 %,
  accord décision certain ≥ 85 %), incidents récupérables surveillés ;
- l'identité `learnx-french-text-correction-v2-2` (Sonnet 4.6, route Anthropic
  épinglée, prompt 2.1.0, protocole 3.0.1, retries bornés 2) passe tous les
  gates automatiques et la revue aveugle déléguée (APPROVED, moyenne 91,
  digest SHA-256 lié aux tentatives) ; `promotionEligible = true` ;
- le résumé revu (`results/2026-08-23T20-10-38-564Z.attempts.json.reviewed-summary.json`)
  sert de baseline de régression pour `benchmarkRegressed` ;
- **holdout scellé ouvert une fois le 23 août (identité
  `learnx-french-text-correction-holdout-v2-2`, 1,750782 USD) : NO-GO
  production** — 4/72 runs inutilisables (5,56 % > 2 %), tous par citations
  non exactes sur deux cas denses ; la qualité pédagogique, la sûreté et
  l'absence de fuite d'injection généralisent (92,16 % d'accord sur cas
  inconnus, 0 faux PASS) ; le corpus holdout est consommé, aucun retuning ;
- **identité v3 (contrat de livraison partielle, doctrine « prix plein sans
  compensation » du 23 août soir) : promue au gate de développement** —
  campagne 24×3 sans aucun échec de gate (3/216 critères « à retravailler »,
  0 run inutilisable, 1,268637 USD), revue aveugle APPROVED (91/100, digest
  lié). Règle 10 amendée : devis débité en intégralité, aucun remboursement ni
  compensation, consentement préalable explicite, devis partiel possible pour
  la resoumission des critères « à retravailler » ;
- **holdout n°2 exécuté une fois le 24 août (1,681095 USD) : NO-GO
  production sur un unique défaut** — 3 écarts de deux niveaux sur un seul cas
  ERRONEOUS déterministe (double pénalisation : les erreurs de faits
  débordent sur le critère d'arbitrage orthogonal) ; toutes les autres
  métriques au vert sur grilles inédites (93,27 % d'accord, décision certaine
  100 %, 0 faux PASS, 0 run inutilisable, « à retravailler » 3,70 % ≤ 5 %).
  Le corpus n°2 est consommé ;
- **décision ouverte pour le Propriétaire** : (a) remédier l'indépendance des
  critères (nouvelle identité + campagne dev ~1,30 USD + nouveau holdout n°3
  rédigé et approuvé avant exécution), ou (b) GO pilote Jalon B sur la
  promotion de développement v3 (allocations offertes, défaut documenté et
  surveillé), ou les deux en parallèle ;
- toute modification de composant (modèle, prompt, protocole, seuils, retries)
  crée une nouvelle identité préenregistrée ; les identités v1 et v2/v2-1/v2-2
  figées ne sont jamais réécrites.

### État autoritaire au 24 août 2026 — campagne générale close, examen Writing préenregistré

- La campagne générale v3-1 à quatre familles est `NO-GO` définitif et son
  holdout est consommé. La revue autonome canonique liée par digest a confirmé
  des erreurs modèle en Reflection, Practice et Writing, ainsi qu'un gold
  Project trop indulgent ; elle ne simule aucune approbation humaine.
- Le défaut Practice est éliminatoire hors du périmètre Writing : toute
  promotion suivante doit refuser `activityType != writing` avant devis,
  réservation et appel fournisseur.
- Le seul chemin de promotion encore ouvert est l'identité neuve
  `learnx-french-writing-correction-sonnet-v3-1-guarded-v1`, en `fr-FR`, sur
  24 cas frais × 3 répétitions, dans le plafond fournisseur restant de
  `2.18 USD`.
- Le préenregistrement, la matrice à deux auteurs, le seuil de désaccord
  inter-auteurs de 15 %, les trois sondes de contraintes dures et la garde
  inclusive ±5 sont définis dans
  `benchmarks/ai-correction/hybrid/writing-only-fr-v1/`.
- Aucun cas ni gold ne peut être rédigé avant le commit de ce
  préenregistrement. Seuls les étalons convergents sont conservés ; au-delà de
  15 % de désaccord, ou si une cellule reste sans étalon convergent, le travail
  s'arrête et revient au Propriétaire.
- Après une unique exécution, le verdict est `GO` ou `NO_GO`, puis arrêt. Un GO
  autorise seulement la proposition d'un plan de scellement runtime ; il ne
  constitue pas une activation automatique de V4-010.

---

## V4-004 — Adaptateur OpenRouter central et sortie structurée

**Priorité : P0 technique. Dépendances : V4-001 et V4-003.**

### Périmètre

- Implémenter un adaptateur serveur isolé, remplaçable et testé sans appel réel.
- Gérer modèles épinglés par rôle, timeouts, annulation, idempotence, limites de
  contexte, réponses structurées, erreurs normalisées et coût `usage`.
- Séparer strictement configuration dev, preview et production.
- Mettre en place secrets, rotation, allowlist modèle/fournisseur et kill switch.
- Autoriser un fallback de capacité seulement selon la politique validée, sans
  changement silencieux de modèle pour un résultat évalué.

### Hors périmètre

- Ledger, paiement, UI et génération de formation.

### Critères d'acceptation

- Aucun secret ou prompt sensible ne revient au client ou aux logs.
- Une réponse non conforme au schéma est un échec, jamais une correction valide.
- Le coût, le modèle, le fournisseur, la latence et l'identifiant de génération
  sont disponibles pour la comptabilité interne.
- Les tests utilisent un faux fournisseur déterministe ; les tests live sont
  séparés, plafonnés et désactivés par défaut.

### Tests et risques

- Timeouts, 402/429/5xx, réponse tronquée, JSON invalide, retry et kill switch.
- Risque : double facturation lors d'une nouvelle tentative non idempotente.

---

## V4-005 — Moteur persistant de correction et score serveur

**Priorité : P0. Dépendances : V4-002 et V4-004.**

### Périmètre

- Persister requête, état, soumission, snapshot du contrat, identité du pipeline,
  prompts, modèles et rôles, résultats structurés, score indicatif recalculé,
  état de vérification et historique.
- Rendre la création et les transitions idempotentes et concurrent-safe.
- Recalculer côté serveur le score pondéré et l'appréciation formative ; aucun
  modèle ne peut décider d'une validation ou modifier la progression.
- Préserver les soumissions, historiques antérieurs et redémarrages existants ;
  aucune nouvelle correction manuelle ne peut être créée dans le flow V4.
- Distinguer correction déterministe, correction IA et validation scientifique.

### Hors périmètre

- Crédit utilisateur, paiement et exposition UI complète.

### Critères d'acceptation

- Une même clé d'idempotence ne crée ni double correction ni double coût logique.
- Le texte, le score et l'appréciation IA ne peuvent pas modifier directement
  la progression ou terminer l'activité.
- Les corrections historiques restent lisibles après évolution du contrat.
- Les cas nécessitant vérification ou présentant un désaccord passent par des
  états serveur explicites (`VERIFYING`, `UNCERTAIN`, `PROVISIONAL` ou
  `UNUSABLE`) et ne deviennent jamais une tâche attribuée à un humain.

### Tests et risques

- Transactions, concurrence, replay, contrats obsolètes, modèle indisponible et
  coexistence avec les historiques antérieurs sans nouveau flow manuel.
- Risque : valider rétroactivement une activité sur un nouveau barème.

---

## V4-006 — Ledger immuable, deux soldes et réservations atomiques

**Priorité : P0 finance. Dépendances : V4-001.**

### Périmètre

- Concevoir et migrer un ledger append-only avec montants entiers, devise de
  crédit, provenance, référence, idempotence et audit.
- Séparer allocation offerte et crédits achetés ; définir ordre de consommation,
  renouvellement et report.
- Implémenter réservation, règlement, libération, expiration et ajustement
  administratif compensatoire sans mutation silencieuse.
- Fournir un solde serveur cohérent, recalculable depuis le ledger.
- Garantir aucune double dépense sous requêtes concurrentes.

### Hors périmètre

- OpenRouter live, catalogue de prix, pack et paiement Revolut.

### Critères d'acceptation

- Aucun montant flottant ; aucun solde négatif ; aucune suppression d'écriture.
- Les crédits achetés ne sont ni transférables ni convertibles en espèces.
- Une allocation expirée n'efface jamais les crédits achetés.
- Toute correction administrative produit une écriture inverse ou compensatoire
  liée à une raison et un acteur audité.

### Tests et risques

- Property tests, concurrence, retry, expiration, fuseaux UTC et reconstruction
  du solde depuis zéro.
- Risque : traiter un cache de solde comme source de vérité.

---

## V4-007 — Catalogue de prix versionné et devis serveur

**Priorité : P0 finance/produit. Dépendances : V4-003 et V4-006.**

### Gate de consultation avant clôture

- **Finance & Pricing — pilote** : fournir par écrit les décisions économiques
  listées dans la table des livrables. Sans mesures V4-003 exploitables, toutes
  les versions de catalogue restent `DRAFT` ou `INACTIVE` et aucun montant n'est
  présenté comme validé.
- **Produit & pédagogie — consultation obligatoire** : utiliser les libellés
  apprenant « Correction standard », « Correction détaillée », « Correction
  renforcée » et « Demander une nouvelle analyse ». Une option plus chère ne
  change jamais la grille, le seuil ou la probabilité de réussite ; elle ne peut
  promettre que la profondeur ou la vérification effectivement fournie.
- **Propriétaire — arbitrage** : valider toute unité, valeur, marge, activation
  d'action et formulation commerciale avant passage à `ACTIVE`.
- **Gate économique** : tant que V4-003 reste `NO-GO`, seuls schéma, états et
  catalogue générique `DRAFT` sont autorisés. Aucun prix, capacité, abonnement,
  pack, SKU ou endpoint de devis utilisable ne peut être activé.

### Périmètre

- Définir des actions facturables versionnées : correction standard, détaillée,
  renforcée et futures catégories réservées sans les activer. À ce stade,
  `DETAILED` et `REINFORCED` restent des possibilités de catalogue, pas des
  offres approuvées ; `REINFORCED` exige un gain supplémentaire benchmarké.
- Distinguer dans le devis : correction primaire avec vérification ciblée
  potentielle incluse dans le plafond, et nouvelle analyse volontaire comme action
  séparée avec son propre devis.
- Calculer prix estimé, plafond, plancher, coefficient de sécurité, modèle et
  expiration du devis à partir de données mesurées.
- Segmenter les plafonds P90 par type d'action et classe de taille d'entrée ; un
  document court et un travail long ne partagent pas un P90 global artificiel.
- Fournir un devis signé ou identifié côté serveur avant chaque réservation.
- Conserver coût fournisseur, prix LearnX, frais et marge comme dimensions
  distinctes visibles seulement par l'administration.
- Rattacher au catalogue les hypothèses et la date du tarif fournisseur. Les
  prix prudents et plafonds utilisent les tarifs hors promotion, jamais une
  remise temporaire observée le jour du calcul.
- Préparer le calcul des capacités moyennes des packs à partir des médianes.
  Pour un pack de `Q` crédits et une médiane observée `M_action`, afficher au
  plus `floor(Q / M_action)` comme estimation, jamais comme maximum garanti.

### Hors périmètre

- Affichage de tokens, tarif illimité ou prix définitif sans benchmark.

### Critères d'acceptation

- Le client ne peut modifier action, quantité, version ou plafond du devis.
- Un devis expiré ou incompatible doit être recalculé.
- Les prix historiques restent attachés aux opérations historiques.
- Un changement de modèle ou de prompt invalide les métriques concernées.
- Le coût interne agrège tous les appels du workflow. Le règlement utilisateur
  agrège uniquement le primaire et le vérificateur ciblé d'un résultat
  utilisable ; les retries techniques et incidents restent à la charge de
  LearnX et demeurent visibles dans les mesures internes.
- Le devis apprenant expose dans cet ordre : action et portée, estimation,
  maximum réservé dominant, inclusion éventuelle de la vérification ciblée
  automatique, règle de libération du reliquat et expiration locale.
- La vérification ciblée automatique n'est ni une action ni un consentement
  séparé ; son coût prudent est inclus dans le maximum initial. Une nouvelle analyse
  volontaire utilise `RECONSIDERATION`, un nouveau devis et une confirmation.
- Il n'existe aucune action de « réparation gratuite ». Une erreur technique ou
  un résultat inutilisable libère la réservation ; une nouvelle analyse
  volontaire est une nouvelle action facturable.
- `STANDARD`, `DETAILED`, `REINFORCED` et `RECONSIDERATION` restent des clés
  internes localisables. `REINFORCED` n'est activable qu'après preuve d'une
  vérification supplémentaire réellement implémentée et benchmarkée.
- En l'absence de prix actif, l'API renvoie un état indisponible explicite et ne
  retourne ni zéro, ni « gratuit », ni estimation fictive.
- La parité crédit/euro est configurable et versionnée ; `100 crédits/€` reste
  une hypothèse sans effet commercial tant qu'elle n'est pas arbitrée.
- Les recharges `10 €/1 000`, `25 €/2 500` et `50 €/5 000` restent des fixtures
  de simulation sans SKU ni paiement actif dans ce ticket.
- L'apprenant ne voit jamais tokens, fournisseur, modèle, coefficient de
  sécurité, percentile, coût fournisseur ou marge. Ces dimensions restent
  réservées à l'administration.

### Tests et risques

- Arrondis, bornes, changement de catalogue, prix plancher et marge négative.
- Risque : publier une capacité moyenne comme garantie contractuelle.

---

## V4-008 — Administration des allocations, limites et budgets

**Priorité : P1. Dépendances : V4-006 et RBAC V3.**

### Périmètre

- Permettre à Admin d'accorder, réduire par compensation et renouveler une
  allocation offerte avec raison, période et plafond.
- Représenter les attributions et ajustements par lots et écritures immuables ;
  les montants disponibles, réservés, consommés et expirés sont des projections
  dérivées, jamais une deuxième source de vérité mutable.
- Définir limites par utilisateur, capacité contextuelle, action et période,
  plus plafond global. Un rôle transitoire ne constitue pas une tarification.
- Exposer solde offert, solde acheté, réservations et historique à l'utilisateur.
- Ajouter alertes de seuil et demande d'augmentation sans l'accorder
  automatiquement.
- Auditer toute mutation administrative.

### Hors périmètre

- Paiement, transfert entre utilisateurs et allocation autoréglée par le client.

### Critères d'acceptation

- Aucun utilisateur ne voit le coût, le solde ou l'historique d'un autre.
- Une modification de rôle ou capacité n'altère aucun crédit acheté.
- Les plafonds s'appliquent côté serveur avant tout appel fournisseur.
- « Allocation offerte » et « Crédits achetés » sont les deux informations
  principales ; « Disponible au total » est une donnée dérivée secondaire.
- L'ajustement admin est préparé pour un panneau latéral desktop et une surface
  plein écran mobile, avec récapitulatif obligatoire avant validation.
- Les règles de période, expiration, renouvellement, grâce, ordre de consommation,
  montant et bornes restent configurables et inactives tant que leurs arbitrages
  ne sont pas validés. Le ticket ne leur attribue aucune valeur fictive.

### Tests et risques

- RBAC, IDOR, concurrence admin/utilisateur, renouvellement UTC et suspension.
- Risque : confondre autorisation métier et capacité financière.

---

## V4-008A — Alignement composite des fondations déjà livrées

**Priorité : P0 corrective. Dépendances : V4-003 à V4-008 ; commence après
V4-008 et bloque V4-009.**

### Gate de consultation avant code

- **Produit & pédagogie — pilote** : fournir la version approuvée de
  `docs/V4_AI_CORRECTION_COMPOSITE_SPEC.md` et vérifier que modèle, serveur et
  progression conservent leurs autorités respectives.
- **Finance & Pricing — consultation obligatoire** : confirmer le périmètre du
  devis unique, les appels inclus, les retries absorbés, le règlement et les
  dimensions de coût à mesurer sans activer de prix.
- **Direction artistique — consultation obligatoire** : confirmer que les
  états et données du contrat suffisent aux deux références Atlas validées,
  sans créer de nouvelle règle métier.
- **Propriétaire — arbitrage** : autoriser explicitement l'identité et le budget
  avant tout nouveau benchmark facturable. La construction et les tests hors
  ligne peuvent précéder ce GO.

### Périmètre

- Réauditer les livraisons V4-003, V4-004, V4-005 et V4-007 contre la spec
  composite et documenter les écarts sans réécrire l'historique.
- Déprécier dans le chemin V4 toute autorité binaire, score, confiance globale
  ou décision de seconde passe provenant directement du modèle.
- Ajouter une identité composite immuable : primaire, vérificateur ciblé,
  profils, prompts, routes, règle de déclenchement et consolidateur versionnés.
- Étendre l'adaptateur à des rôles épinglés et indépendants, sans routeur auto,
  alias `latest` ou fallback inter-modèle silencieux.
- Étendre le moteur persistant aux tentatives par rôle et aux états
  `VERIFYING`, `PROVISIONAL`, `UNCERTAIN` et `UNUSABLE_RELEASED`.
- Implémenter hors ligne la règle de déclenchement et la consolidation définies
  dans la spec : le primaire reste la proposition, le vérificateur signale la
  stabilité et un écart matériel produit `UNCERTAIN`, jamais un vote ou une
  moyenne.
- Adapter le devis inactif pour inclure primaire et vérification ciblée dans un
  seul plafond, tout en excluant les retries techniques du règlement utilisateur.
- Préparer le benchmark composite sous une identité neuve ; ne lancer aucun
  appel facturable sans le GO explicite du Propriétaire.

### Hors périmètre

- Interface apprenant finale, prix actifs, paiement, promotion implicite d'un
  modèle, ouverture du holdout avant gate de développement.

### Critères d'acceptation

- Le registre d'écarts nomme chaque incompatibilité livrée et sa résolution.
- Les campagnes mono-modèle historiques restent lisibles et non comparables à
  la nouvelle identité composite.
- Le modèle ne produit ni verdict de réussite, ni score faisant autorité, ni
  décision de progression ou de routage.
- Le vérificateur reçoit la soumission et le même contrat, mais jamais la sortie
  primaire avant son analyse.
- Un retry conserve l'échec initial dans les métriques, reste invisible et à la
  charge de LearnX ; après échec final, la réservation est libérée.
- Une sortie `UNCERTAIN` n'expose aucun score exact ; une plage exige un calcul
  serveur versionné. `UNUSABLE_RELEASED` n'expose ni score ni débit.
- Le coût interne conserve tous les appels ; le règlement utilisateur n'inclut
  que les rôles utiles du workflow et reste borné au plafond accepté.
- L'ensemble reste désactivé en production tant que benchmark, consultations et
  GO du Propriétaire ne sont pas réunis.

### Tests et risques

- Tests unitaires des autorités, transitions, déclencheurs, désaccords,
  idempotence, retries, preuves et absence d'effet sur la progression.
- Test d'intégration hors ligne primaire seul, primaire + vérificateur, écart
  matériel, sortie invalide, timeout et règlement/libération simulés.
- Risque principal : adapter la persistance au nouveau vocabulaire tout en
  laissant un ancien chemin binaire continuer à faire autorité.

---

## V4-009 — Orchestration correction, réservation et règlement

**Priorité : P0. Dépendances : V4-005, V4-007, V4-008 et V4-008A.**

### Périmètre

- Orchestrer devis accepté, réservation, correction, validation structurée,
  règlement final, libération de différence et historique.
- Exécuter le correcteur primaire puis, lorsque la règle versionnée le demande,
  le vérificateur ciblé dans la réservation initiale sans nouvelle confirmation.
  Régler uniquement le coût réellement consommé et libérer la différence.
- Définir la politique de retry et l'absorption du coût en cas d'échec sans
  résultat utilisable.
- Protéger contre double clic, rechargement, reprise réseau et requête concurrente.
- Gérer insuffisance de crédit, devis expiré, kill switch et budget fournisseur.
- Réconcilier le coût OpenRouter avec l'opération LearnX.
- Régler à partir de la somme des coûts réels OpenRouter de tous les appels du
  workflow facturables, sans reconstruire le coût final depuis les tokens. Les
  retries techniques restent mesurés séparément et absorbés par LearnX.
- Réserver au plafond prudent du workflow composite, jamais à son coût moyen.
  Le devis utilisateur reste unique et n'expose ni noms de modèles ni vote.

### Hors périmètre

- Paiement pour acheter de nouveaux crédits.

### Critères d'acceptation

- Aucun appel fournisseur ne part sans réservation valide, sauf outil admin de
  benchmark explicitement séparé et plafonné.
- Un succès ne peut régler qu'une réservation ; un échec libère les crédits.
- Le devis, la réservation et le règlement forment une seule opération visible,
  même lorsque la vérification ciblée est appelée.
- La différence entre plafond et prix final revient immédiatement au bon solde.
- Le débit final est borné au plafond accepté. Tout dépassement fournisseur est
  absorbé par LearnX, audité et déclenche une alerte ou le kill switch prévu.
- Un coût orphelin déclenche une alerte et une réconciliation, jamais un débit
  silencieux de l'utilisateur.
- Après correction, le résumé plafond accepté / montant réglé / montant libéré
  reste disponible ; sa ventilation par origine est consultable séparément.

### Tests et risques

- Pannes à chaque frontière transactionnelle, replay et récupération après crash.
- Risque : impossibilité de transaction distribuée avec le fournisseur externe.

---

## V4-009B — Validation intégrée et progressive du pipeline composite

**Priorité : P0 gate. Dépendances : V4-003, V4-008A et V4-009. Bloque
l'activation de V4-010.**

### Périmètre

- Répéter les migrations et les scénarios de V4-009 sur une branche Neon
  jetable : devis, réservation, primaire, vérificateur éventuel, consolidation,
  règlement ou libération, reprise et idempotence. Aucune donnée de production
  ne doit être modifiée.
- Figer avant tout appel facturable l'identité complète du pipeline : modèles et
  routes épinglés, profils, prompts, règles de déclenchement, consolidation,
  désaccord, retry, budget et version du protocole.
- Vérifier hors ligne la chaîne complète avec des fournisseurs déterministes
  simulés, notamment primaire seul, vérification ciblée, désaccord matériel,
  sortie invalide, timeout, dépassement absorbé et résultat inutilisable.
- Exécuter ensuite un mini-panel réel plafonné de six cas représentatifs avec
  deux répétitions : réponse clairement réussie, clairement insuffisante,
  proche du seuil, critères mixtes, réponse concise et tentative d'injection.
- Mesurer qualité formative, faux positifs et faux négatifs, stabilité,
  citations, sorties invalides, sécurité, états incertains, latence, appels du
  vérificateur et coût complet du workflow par correction utilisable.
- Soumettre toutes les sorties du mini-panel à une revue pédagogique réellement
  aveugle, sans modèle, fournisseur, prix, catégorie ni gold exposés.
- Si et seulement si le mini-panel reçoit un GO explicite du Propriétaire,
  exécuter le `24 cas × 3 répétitions` sous la même identité, puis sa revue
  aveugle. Le holdout scellé reste une étape ultérieure et irréversible.
- Documenter les campagnes historiques et expliquer pourquoi elles ne peuvent
  pas être recombinées comme preuve de promotion lorsque leurs prompts,
  protocoles ou identités diffèrent.

### Hors périmètre

- Activation publique de la correction ou branchement de V4-010 sur des appels
  réels.
- Assouplissement silencieux du corpus, des golds ou des seuils pour faire passer
  un candidat.
- Ouverture du holdout après un mini-panel seulement.
- Benchmark exhaustif de nouveaux modèles sans hypothèse ni budget préenregistré.
- Décision tarifaire, packs ou parité définitive des crédits.

### Critères d'acceptation

- La répétition Neon est documentée et réussit sans toucher à la base partagée ;
  les migrations, le règlement et la libération sont rejouables et idempotents.
- Le mini-panel possède une enveloppe de run, une empreinte et un budget maximum
  vérifiables ; aucun appel extérieur au panel autorisé n'est mélangé aux coûts.
- Une sortie invalide ou inutilisable n'est jamais publiée ni débitée ; son coût
  fournisseur et son éventuel retry restent mesurés séparément.
- La vérification ciblée utilise la règle serveur figée. Elle n'est déclenchée ni
  par la seule confiance auto-déclarée d'un modèle, ni par une règle inventée
  après lecture des résultats.
- La revue aveugle rend un verdict écrit et distingue désaccord pédagogique,
  défaillance technique, sécurité et frontière raisonnablement discutable.
- Le rapport présente au minimum accord de décision, faux positifs, faux
  négatifs, écarts par critère, variabilité, sécurité, preuves, sorties
  invalides, état `UNCERTAIN`, latence et coûts P50/P90 observés lorsque
  l'échantillon le permet.
- Un échec du mini-panel arrête la campagne avant le `24×3`. Toute modification
  de prompt, modèle, route ou règle crée une nouvelle identité et recommence au
  mini-panel.
- V4-010 peut être préparé uniquement derrière un feature flag désactivé et avec
  des fixtures simulées tant que le GO intégré n'est pas donné. Aucun utilisateur
  ne peut déclencher un appel réel avant validation de V4-009B.

### Tests et risques

- Tests unitaires des règles de déclenchement et consolidation ; intégration avec
  providers simulés ; répétition Neon ; mini-panel facturable plafonné puis revue
  humaine aveugle.
- Risques : dépenser sur un pipeline non viable, suradapter le prompt aux six cas,
  confondre une simulation rétrospective avec une preuve intégrée ou ouvrir le
  holdout trop tôt.

---

## V4-009C — Réévaluation Gemini sous enveloppe de sécurité déterministe

**Priorité : P0 expérimentation. Dépendances : V4-003, V4-009 et clôture
documentée du mini-panel V4-009B. Bloque l'activation réelle de V4-010.**

### Décision et continuité de preuve

- Conserver définitivement le verdict `NO-GO` de
  `learnx-fr-text-mistral-sonnet-targeted-v1@1.0.0` ; mettre en pause son
  extension diagnostique `24×3` sans supprimer son manifeste ni ses artefacts.
- Référencer le journal append-only
  `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md`. Toute nouvelle campagne y ajoute
  son identité, ses empreintes, ses résultats et son verdict sans réécrire les
  campagnes antérieures.
- Traiter les résultats Gemini historiques comme un signal, pas comme une preuve
  actuelle : ils précèdent le prompt `2.0.0`, le protocole `3.0.1` et les
  contrôles déterministes modernes.

### Périmètre hors ligne

- Implémenter une enveloppe de sécurité non générative avant et après le modèle :
  normalisation Unicode bornée, séparation contexte/consigne/réponse, limites de
  taille, détection de signaux d'instruction non fiable, canari, schéma strict,
  résolution des citations exclusivement dans `responseText` et fragments
  interdits normalisés.
- Une détection en entrée ne supprime, ne réécrit et ne rejette jamais seule la
  production : elle persiste un signal de risque générique. Un apprenant peut
  légitimement étudier ou citer une injection.
- Utiliser Gemini comme seul correcteur payant de cette première campagne. Une
  sortie structurellement invalide suit au plus un retry technique transitoire
  allowlisté avec la même identité ; aucun Sonnet n'est appelé dans ce panel.
- Épingler avant appel l'identifiant exact Gemini, la route, le profil, les
  versions du prompt/protocole, le snapshot tarifaire, les cas, répétitions,
  gates, budget et règle d'arrêt. Aucun alias, fallback ou route automatique.

### Mini-panel préenregistré

- Exécuter dix cas de développement × deux répétitions, soit vingt workflows :
  réussite nette, insuffisance nette, frontière, critères mixtes, réponse
  concise, hors sujet et les quatre injections authorées des familles writing,
  reflection, practice et project.
- Ne jamais ouvrir ni utiliser le holdout scellé pour préparer, régler ou
  interpréter ce panel.
- Budget proposé avant consultation Finance : coût attendu `0,25–0,30 USD`,
  plafond fournisseur dur `0,50 USD` et quarante tentatives maximum retries
  compris. Ces valeurs restent inactives jusqu'à arbitrage Finance et GO écrit
  du Propriétaire.
- Produire un paquet réellement aveugle, un mapping scellé, un ledger append-only
  et des artefacts bruts empreintés. Aucun appel concurrent ou hors manifeste ne
  participe aux métriques.

### Gates préenregistrés

- Sécurité injection et preuves : `100 %` ; aucune fuite de canari, obéissance à
  une instruction hostile ou citation hors réponse.
- Aucun workflow finalement inutilisable ; au plus deux premières sorties
  `INVALID` sur vingt, uniquement si le retry autorisé produit une sortie valide.
- Accord exact par critère `>= 85 %`, variabilité `<= 10 %`, aucun écart ordinal
  de deux niveaux non adjudiqué et aucun résultat matériellement trop généreux
  confirmé par revue humaine.
- Mesurer en plus l'erreur absolue du score formatif serveur, l'accord adjacent,
  la qualité/actionnabilité du feedback, le ton, la latence et le coût complet.
  Le PASS/FAIL interne reste une sonde de benchmark et n'est ni affiché ni lié à
  la progression.
- Une revue humaine en deux phases gèle d'abord son jugement sans modèle,
  fournisseur, prix, catégorie ni gold, puis compare aux attentes et rend le
  verdict.
- Aucun seuil, gold, prompt, cas ou contrôle n'est modifié après lecture des
  résultats. Tout changement crée une nouvelle identité et un nouveau panel.

### Suite conditionnelle

- Si Gemini échoue, arrêter avant le `24×3` et documenter la cause.
- S'il passe, demander un nouveau GO avant un `24×3` Gemini seul sous la même
  identité ; ne pas ajouter automatiquement un vérificateur.
- Seulement si les erreurs restantes sont risquées mais détectables par une
  règle préenregistrable, créer une expérimentation distincte Gemini primaire +
  Sonnet ciblé réutilisant les sorties Gemini compatibles. Sonnet ne devient pas
  un troisième étage systématique.
- Un pipeline à trois appels modèle, un classificateur IA de sécurité et le
  holdout restent hors périmètre.

### Tests et risques

- Tests adversariaux Unicode/canari/citations, faux positifs sur du texte parlant
  légitimement d'injection, schéma invalide, retry, idempotence, budget et paquet
  aveugle ; puis mini-panel facturable uniquement après autorisation.
- Risques : croire qu'un détecteur lexical constitue une protection complète,
  bloquer un contenu légitime, comparer directement des protocoles différents ou
  ajouter un vérificateur sans bénéfice mesuré.

---

## V4-010 — Correction des productions libres d'exercice

**Priorité : P0 utilisateur. Dépendances : V4-009 et GO d'un pipeline issu de
V4-009C ou d'une expérimentation ultérieure explicitement validée.**

### Périmètre

- Intégrer la correction aux exercices à production libre éligibles sans casser
  le parcours authoré, la navigation ni l'historique existant.
- Afficher prix estimé/plafond, soldes utilisés et confirmation avant lancement.
- Afficher attente, reprise, erreur, crédits libérés et résultat structuré.
- Présenter appréciation par critère, preuves, forces, améliorations et proposition
  de révision sans masquer la réponse de l'apprenant.
- Nommer les preuves internes « Extrait de votre réponse » et séparer toute
  source externe dans une zone « Références mobilisées ».
- Présenter un score indicatif serveur et une appréciation formative, sans
  libellé académique « validé/rejeté » et sans effet bloquant sur la progression.
- Expliquer sobrement les états `confirmée`, `à confirmer`, `provisoire` et
  `indisponible`. Pour `UNCERTAIN`, ne montrer aucun score exact ; une plage
  n'est autorisée que si elle est effectivement calculée par LearnX.
- Conserver et comparer les tentatives/corrections d'un même module run.
- Étiqueter clairement « Correction assistée par IA ».
- Permettre à l'apprenant de contester une correction avec un argument libre et
  de demander une seconde correction IA. Cette passe repart de la soumission,
  de la rubrique, de la première correction et de l'argument sans devenir un chat.
- Appliquer strictement le même snapshot de rubrique, critères, poids et seuil.
  L'argument ne peut pas ajouter des éléments évaluables absents de la soumission.
- Permettre à l'apprenant de dupliquer ou reprendre son travail pour le compléter,
  mais enregistrer le résultat comme une nouvelle soumission complète, avec son
  propre devis, sa propre correction et son propre historique.
- Conserver les deux corrections et rendre leurs différences compréhensibles ;
  la seconde ne réécrit jamais l'historique de la première.

### Hors périmètre

- Chat libre, nouvelle consigne générée et évaluations corrigibles de manière
  déterministe.

### Critères d'acceptation

- L'utilisateur connaît le maximum avant confirmation et le débit final après.
- Un état de vérification ou de désaccord est expliqué sans produire une fausse
  conclusion, exposer les modèles ni suggérer qu'un humain répondra.
- Avant une seconde correction demandée par l'apprenant, son devis proportionnel
  et la limite d'une contestation sont annoncés ; un retry imposé par une erreur
  technique reste à la charge de LearnX.
- Une vérification ciblée déclenchée par la règle composite n'affiche aucune
  nouvelle confirmation : son plafond était inclus dans le devis initial et la
  part inutilisée est rendue après règlement.
- Le serveur applique la règle composite versionnée aux résultats structurés :
  le primaire reste la proposition et le vérificateur teste sa stabilité ; un
  écart matériel produit `UNCERTAIN`, jamais un vote ou une moyenne. En cas d'échec
  technique ou de résultat toujours inexploitable, aucune note précise n'est
  publiée et l'apprenant peut soumettre une nouvelle tentative.
- Une nouvelle tentative ne concatène jamais automatiquement l'ancien devoir et
  un complément : le payload soumis doit représenter la réponse complète que
  l'apprenant souhaite faire évaluer.
- Clavier, lecteur d'écran, 320/390 px, zoom 200 % et erreurs réseau sont couverts.
- Les états et actions respectent les références Atlas validées aux largeurs
  320/390, 1440/1920 px, au zoom 200 %, avec focus visible, contrastes WCAG et
  reduced motion. Aucun état ne dépend de la couleur seule.
- Une actualisation ne relance ni l'appel ni le débit.

### Tests et risques

- Composants, E2E, réseau lent/hors ligne, double clic et textes longs.
- Risque : présenter le feedback IA comme une vérité ou un jugement personnel.

---

## V4-011 — Évaluations d'étape textuelles et nouvelle analyse IA

**Priorité : P1. Dépendances : V4-010 et calibration exercice réussie.**

### Périmètre

- Étendre la correction aux évaluations d'étape dont la réponse et la rubrique
  sont entièrement textuelles : étude de cas, devoir écrit, simulation décrite
  et examen cumulatif textuel.
- Ne jamais proposer de correction IA pour un oral, une image, un fichier ou
  une preuve non textuelle tant que son format n'est pas implémenté et calibré.
- Réutiliser le pipeline composite promu pour la correction automatique. Une
  nouvelle analyse peut être demandée après un résultat utilisable ; elle reste
  liée au snapshot immuable de la rubrique et à la soumission d'origine.
- Interdire au modèle de traiter l'argument comme une extension de la réponse ;
  la même grille et le même seuil s'appliquent aux deux passes.
- Auditer version du pipeline et des prompts, motif de la nouvelle analyse, scores
  serveur, feedbacks, coût et effet pédagogique.
- Si les analyses restent incompatibles ou insuffisamment fiables, ne pas
  inventer une note : proposer une nouvelle soumission à l'apprenant.
- Interdire toute assimilation à une validation professionnelle/scientifique.

### Hors périmètre

- Évaluation sans texte exploitable, domaine non calibré, observation live,
  image, fichier, audio, vidéo, transcription ou correction humaine.
- Chat de négociation avec le modèle ou contestation sans politique versionnée.

### Critères d'acceptation

- Aucun écran, endpoint ou statut n'assigne une correction à un humain ou ne
  permet à un utilisateur de modifier le score.
- La première correction, l'argument de contestation et la seconde correction
  restent visibles, versionnés et non modifiables.
- Le moteur de progression reste indépendant du score et des résultats IA ; une
  analyse incertaine conduit à une nouvelle tentative sans bloquer artificiellement
  le parcours.
- La politique finale de contestation — contenu de l'argument, nombre de demandes
  et présentation comparative — est versionnée et validée par le Propriétaire
  avant activation ; le ticket n'en invente aucune valeur.
- Une vérification ciblée utilise la réservation initiale ; une nouvelle analyse
  volontaire d'un résultat valide utilise une nouvelle réservation.
- Le passage à l'échelle est bloqué si les métriques de calibration régressent.

### Tests et risques

- Divergence entre primaire et vérificateur, contestation répétée, idempotence,
  coûts, seuils, stabilité du score indicatif et indépendance de la progression.
- Risque : forte conséquence pédagogique d'une correction erronée.

---

## V4-012 — Tableau de bord IA, coûts, marge et réconciliation

**Priorité : P1 administration. Dépendances : V4-009.**

### Périmètre

- Afficher usage par période, utilisateur, action, modèle, statut et programme.
- Afficher coût fournisseur, prix utilisateur, crédits libérés, marge brute,
  erreurs absorbées et écarts de réconciliation.
- Afficher la marge de contribution disponible après coûts variables, sans la
  présenter comme bénéfice net. Séparer cotisations/CFP, VFL si applicable,
  paiement, OpenRouter, change, TVA confirmée, infrastructure variable et
  incidents absorbés lorsque ces dimensions sont disponibles.
- Suivre solde OpenRouter, crédits LearnX en circulation et réserve d'exécution.
- Exporter un journal exploitable sans contenu pédagogique ou donnée sensible.
- Définir alertes de marge, budget, coût anormal, fraude et coût orphelin.

### Hors périmètre

- Comptabilité officielle, déclaration fiscale automatisée ou accès apprenant aux
  marges internes.

### Critères d'acceptation

- Les agrégats se réconcilient avec ledger et usages bruts.
- Les données financières requièrent une capacité admin dédiée.
- Les exports minimisent les données et ne contiennent aucun secret ou texte de
  soumission.

### Tests et risques

- Agrégations, fuseaux, pagination, grands volumes et IDOR.
- Risque : dashboard cohérent visuellement mais faux comptablement.

---

## V4-013 — ADR et sandbox Revolut Merchant

**Priorité : P0 paiement. Dépendances : V4-006, V4-007 et validations externes.**

### Périmètre

- Vérifier compte Merchant, contrats, frais, devises, moyens de paiement,
  remboursements, litiges, facturation et environnements disponibles.
- Comparer Checkout hébergé et widget ; choisir la surface initiale la plus sûre.
- Définir ordre, paiement, webhook, fulfillment, référence utilisateur,
  idempotence et données conservées.
- Réaliser un flux sandbox sans valeur réelle et un plan de test Apple Pay dont
  les contraintes d'environnement sont explicites.
- Documenter rotation des secrets, signature webhook et procédure d'incident.

### Hors périmètre

- Vente réelle, pack public et crédit de production.

### Critères d'acceptation

- La décision se fonde sur les conditions du compte LearnX réel, pas seulement
  sur une page marketing.
- Le webhook vérifié est l'unique source d'attribution automatique.
- Aucun numéro de carte n'est manipulé ou stocké par LearnX.

### Tests et risques

- Webhook faux/rejoué/désordonné, paiement différé, expiration et retour client.
- Risque : environnement Apple Pay non testable comme Google Pay en sandbox.

---

## V4-014 — Packs, Checkout et attribution automatique

**Priorité : P0 paiement. Dépendances : V4-013.**

### Périmètre

- Après validation explicite des gates, permettre de configurer des recharges
  versionnées. Les hypothèses `Essentiel` 10 €/1 000, `Régulier` 25 €/2 500 et
  `Intensif` 50 €/5 000, sans bonus, ne sont ni des prix approuvés ni des SKU
  activables avant V4-018 et l'arbitrage du Propriétaire.
- Présenter ces offres comme des volumes prépayés, pas comme des abonnements ou
  niveaux fonctionnels ; aucune capacité produit n'est réservée au pack supérieur.
- Créer un Checkout authentifié lié à l'utilisateur et au pack choisi.
- Gérer carte, Revolut Pay, Apple Pay et Google Pay via les capacités du Checkout.
- Attribuer les crédits achetés une seule fois après paiement confirmé.
- Présenter montant, crédits, capacité moyenne indicative et conditions avant
  paiement, puis reçu et nouveau solde.
- Ne publier les capacités moyennes qu'après benchmark V4-018.

### Hors périmètre

- Abonnement, paiement récurrent, prix choisi librement et achat anonyme.

### Critères d'acceptation

- Le client ne choisit jamais librement le nombre de crédits attribués.
- Un événement rejoué ou concurrent ne double pas le fulfillment.
- Les capacités indiquent « en moyenne », avec périmètre et fourchette.
- L'estimation médiane, le plafond P90 réservé et le coût final réglé sont trois
  valeurs distinctes et nommées sans ambiguïté.
- Un paiement réussi reste récupérable si le retour navigateur est perdu.

### Tests et risques

- E2E sandbox, devise, paiement différé, webhook avant/après redirect et reprise.
- Risque : petits packs rendus non rentables par le forfait de transaction.

---

## V4-015 — Remboursements, litiges et clôture financière mensuelle

**Priorité : P0 exploitation. Dépendances : V4-012 et V4-014.**

### Périmètre

- Définir et implémenter remboursements autorisés, annulation des crédits non
  consommés selon politique validée, chargebacks et écritures compensatoires.
- Empêcher l'usage de crédits pendant un litige lorsque nécessaire sans supprimer
  l'historique.
- Produire une clôture mensuelle : ventes, frais, coût IA, crédits en circulation,
  réserve fiscale, réserve d'exécution, incidents et marge.
- Documenter les opérations manuelles et les preuves attendues.
- Alerter sur marge sous les seuils décidés.

### Hors périmètre

- Conseil fiscal automatisé ou retrait libre de crédits en espèces.

### Critères d'acceptation

- Un remboursement ou litige ne supprime aucune écriture historique.
- La clôture détecte coût orphelin, fulfillment manquant et solde incohérent.
- La marge n'est pas calculée avant provision des crédits encore en circulation.

### Tests et risques

- Remboursement partiel, double litige, solde déjà consommé et événement tardif.
- Risque : considérer le chiffre d'affaires encaissé comme bénéfice disponible.

---

## V4-016 — Vue « Créer une formation » annoncée pour V5

**Priorité : P2 produit. Dépendances : V3.5-009 et compte Membre actif.**

**Références : A3, vue `Création de formations`, et A2, vues `Navigation` et
`Actions`.**

### Périmètre

- Faire évoluer la page Parcours en point d'entrée cohérent vers la recherche de
  parcours, les parcours de l'utilisateur, les parcours disponibles et la
  création, sans dupliquer les fonctions déjà livrées en V3.
- Ajouter dans cet espace une action « Créer une formation » accessible aux
  membres actifs ; en V4, elle ouvre une vue d'annonce dédiée. `CREATOR` ne
  constitue ni une condition d'affichage ni une identité produit exclusive.
- Expliquer sobrement que la création guidée de formations est en cours de
  conception et arrivera dans une prochaine version.
- Présenter sans interaction factice les grandes intentions : cadrage du besoin,
  recherche des parcours existants, analyse de couverture, proposition de
  blueprint complémentaire, estimation avant génération et validation humaine.
- Offrir une action de retour claire vers les programmes.
- Choisir une entrée qui ne surcharge pas la navigation principale des apprenants.
- Préparer le contrat de navigation V5 : la même action ouvrira alors une nouvelle
  session conversationnelle de conception, sans implémenter ce chat en V4.
- Documenter dans la préfiguration le principe V5 « rechercher, réutiliser,
  compléter, puis générer », sans promettre que le moteur est déjà disponible.

### Hors périmètre

- Formulaire, chat, liste d'attente externe, appel IA, upload, estimation,
  paiement, brouillon, mutation éditoriale et promesse de date.

### Critères d'acceptation

- Aucun contrôle ne laisse croire qu'il fonctionne déjà.
- La route directe exige un compte actif sans distinguer étudiant/créateur ;
  aucune API de création n'existe.
- Depuis Parcours, la distinction entre « mes parcours », « découvrir » et
  « créer » est compréhensible sans ajouter un sixième item à la navigation.
- La page est traduite selon le socle i18n V3 et accessible sur mobile/desktop.
- La fonctionnalité est nommée « bientôt disponible », jamais « indisponible à
  cause d'une erreur ».
- La vue emploie les tokens Atlas, une seule action bleue dominante, aucun
  contrôle factice, aucune grande tuile active, aucun gradient IA et aucun
  motif cartographique suggérant qu'une génération a commencé.
- À 320/390, 1024, 1440 et 1920 px et au zoom 200 %, le texte ne déborde pas,
  les cibles font ≥ 44 × 44 px et le retour vers Parcours reste accessible au
  clavier avec focus visible.

### Tests et risques

- Session active/suspendue, route directe, navigation,
  320/390/1024/1440/1920 px, zoom 200 %,
  clavier, lecteur d'écran, reduced motion et traductions.
- Captures réalistes du membre actif et du compte non autorisé, sans faux état de
  chargement ni formulaire vide laissant croire à une panne.
- Risque : frustrer un apprenant avec une entrée trop présente ou ambiguë.

---

## V4-016A — Enrichissement commercial de la landing V3.5

**Priorité : P1 lancement commercial. Dépendances : V3.5-006 et V3.5-009 ;
V4-010 pour présenter une correction réelle, V4-007/V4-018 pour les prix
publiés et V4-014 avant tout achat réel.**

**Références : A5 pour la landing et ses preuves produit ; A3, vue `Landing
détaillée` ; A2, vues `Fondations`, `Actions` et `Formulaires`.**

### Périmètre

- Étendre la landing V3.5 sans reconstruire son architecture, sa marque, ses
  formulaires publics ou sa séparation avec l'application/PWA.
- Conserver Atlas sans vert : papier chaud, bleu ardoise pour marque et CTA,
  laiton éditorial rare, Manrope + Source Serif 4 et cartographie liée au
  parcours plutôt qu'à l'IA ou au paiement.
- Présenter les corrections IA désormais disponibles avec leur périmètre réel :
  productions libres compatibles, rubrique authorée, coût connu avant action,
  retour assisté et possibilité de réessai.
- Remplacer l'annonce V3.5 de correction à venir par l'aperçu A5 uniquement
  lorsque V4-010 est disponible pour le public concerné. L'exemple emploie une
  activité, une rubrique et un retour réellement compatibles ; il n'invente ni
  réponse utilisateur ni résultat impossible.
- Conserver l'aperçu de parcours dans le hero et les preuves Programme/Leçon
  déjà réelles. Les enrichissements commerciaux ne les remplacent jamais par
  des illustrations génériques, des rendus conceptuels ou des cartes de vente.
- Présenter les tiers commerciaux avec prix, crédits et capacités moyennes
  uniquement depuis le catalogue versionné et les mesures V4-018.
- Dater les exemples d'usage et indiquer `en moyenne` ; ne jamais publier un
  chiffre provisoire, des tokens ou une promesse illimitée.
- Relier la landing au checkout uniquement après V4-014, en conservant
  authentification, information tarifaire et confirmation dans l'application.
- Mettre à jour FAQ, confiance, confidentialité et limites pour OpenRouter,
  correction assistée, crédits LearnX, expiration éventuelle et paiements.
- Remplacer les annonces `à venir` par des capacités disponibles uniquement
  lorsque leur rollout est réellement ouvert au public concerné.
- Mesurer compréhension des offres et conversion sans assimiler lead, candidat,
  invité, compte activé et acheteur.

### Hors périmètre

- Refaire le design system, la landing initiale, les formulaires de liste
  d'attente ou l'architecture de domaine livrés par V3.5.
- Génération de formation V5, prix non calibré, faux compteur, témoignage
  inventé, fausse rareté, promesse d'IA objective ou capacité illimitée.
- Achat public avant validation juridique/comptable, V4-014 et rollout V4-018.

### Critères d'acceptation

- Les prix correspondent exactement à une version publiée du catalogue ; sans
  catalogue validé, ils restent absents ou explicitement en préparation.
- Chaque offre indique prix, crédits et capacité moyenne datée sans exposer de
  tokens ni garantir un nombre exact d'actions.
- La différence entre correction déterministe, retour assisté par IA et future
  création de formation est compréhensible sans ouvrir l'application.
- Les aperçus Programme, Leçon et Correction affichent des contenus cohérents,
  vérifiables et représentatifs des composants Atlas livrés ; aucun faux texte,
  témoignage, compteur, progression ou contrôle ne sert de preuve.
- Une seule action remplie domine chaque zone commerciale ; l'achat reste
  distinct de la liste d'attente, de la candidature et de la connexion.
- Les états offre indisponible, catalogue en chargement, erreur, formulaire
  vide/rempli/envoyé et checkout autorisé/interdit possèdent un libellé et une
  action sûre ; aucun montant de démonstration n'est affiché comme réel.
- Les critères de marque, responsive et accessibilité de V3.5-008 restent
  respectés avec les contenus commerciaux réels.
- Aucun vert, gradient IA, halo, glassmorphism, CTA laiton ou motif
  cartographique décoratif n'apparaît dans l'extension commerciale.
- Les métriques distinguent visiteur, lead, candidat, invité, utilisateur activé
  et acheteur sans profilage excessif.
- À 320/390, 1024, 1440 et 1920 px et au zoom 200 %, la lecture reste sans
  scroll horizontal global, les cibles font ≥ 44 × 44 px et une seule action
  bleue remplie domine chaque zone.

### Tests et risques

- Tests catalogue publié/non publié, capacités datées, langues FR/EN, CTA,
  connexion, checkout autorisé/interdit et absence de flash de données privées.
- Captures 320/390, 1024, 1440 et 1920 px couvrant default, loading, error et
  offre non publiée ; clavier, focus 2 px bleu clair, lecteur d'écran et reduced
  motion.
- Captures dédiées du hero et des trois preuves produit à 320/390 et desktop,
  avec contrôle de cohérence entre contenu montré et état applicatif publié.
- Revue juridique, fiscale, marketing, accessibilité et sécurité avant ouverture.
- Risque : transformer la landing éditoriale en page tarifaire fintech ou SaaS
  IA générique. Les preuves d'apprentissage restent prioritaires sur le billing.

### Migration et rollback

- Prix, corrections et achat sont activables indépendamment. Le rollback
  restaure la landing V3.5 sans interrompre liste d'attente, connexion ou app.

---

## V4-016B — Adaptation desktop des nouvelles surfaces V4

**Priorité : P1 polish. Dépendances : V3.5-005 et V3.5-009 ; revue finale après
V4-010, V4-012, V4-014, V4-016, V4-016A et V4-016G.**

**Références : A1, vues `Correction IA` et `Administration` ; A3, vues
`Leçon desktop`, `Crédits et paiement` et `Création de formations` ; A2, vue
`Navigation`.**

### Périmètre

- Appliquer les gabarits `lecture`, `travail` et `administration` de V3.5
  aux nouvelles vues V4 : devis, correction, historique, solde/crédits,
  dashboard coûts, checkout et annonce V5.
- Utiliser les vues Correction IA et Administration du screen pack Atlas comme
  références de direction pour hiérarchie, densité et surfaces, sans en faire
  des contrats pixel-perfect.
- Choisir le gabarit selon la tâche et documenter toute exception ; ne pas
  inventer une quatrième grammaire propre au billing ou à l'IA.
- Adapter correction et historique aux comparaisons lisibles sur grand écran
  sans afficher simultanément des étapes pédagogiques qui restent séquentielles.
- Adapter tableaux, filtres, alertes, limites et coûts admin à une densité
  maîtrisée, avec actions groupées sûres et tiroirs correctement dimensionnés.
- Conserver routes, permissions, tokens, primitives, navigation et règles
  d'accessibilité issus de V3.5.
- Vérifier que les nouvelles surfaces restent cohérentes sur mobile sans
  reproduire le gabarit desktop dans une largeur réduite.

### Hors périmètre

- Refaire les écrans V3 déjà validés par V3.5, redéfinir tokens/primitives ou
  modifier les règles de correction, prix, paiement, progression ou accès.
- Dashboard décoratif, carte étirée, sidebar vide, cockpit technique ou
  esthétique fintech/IA générique.

### Critères d'acceptation

- Chaque nouvelle surface V4 utilise un gabarit V3.5 ou justifie son exception.
- Chaque surface conserve la base encre/navy/ardoise, l'action bleue et le
  laiton rare sans réintroduire de vert ni créer une esthétique fintech.
- À 1024/1440/1920 px, aucune vue n'est une PWA mobile étirée et aucune longueur
  de ligne pédagogique ne dépasse la mesure validée.
- À zoom 200 %, aucun chevauchement ni scroll horizontal global.
- Les états default, hover, focus, disabled, loading, error et empty sont
  couverts lorsqu'ils existent ; tableaux et actions admin restent
  compréhensibles sans dépendre de la couleur.
- Les parcours principaux nécessitent le même nombre d'actions ou moins que leur
  équivalent mobile.
- Une revue réaliste couvre au minimum correction, historique, dashboard
  crédits, checkout et annonce V5 sur mobile et desktop.

### Tests et risques

- Tests visuels 768/1024/1440/1920, zoom 100/200 %, clavier, lecteur d'écran,
  hover/focus, reduced motion et E2E des parcours critiques.
- Captures avec données réalistes pour correction, historique, administration,
  checkout et annonce V5 ; aucun renouvellement aveugle de baseline.
- Risque : réouvrir la refonte V3.5 au lieu d'intégrer les seules surfaces V4.

### Migration et rollback

- Livrer par famille correction, administration et paiement avec rollback
  isolable, sans migration de données liée à la présentation.

---

## V4-016C — Première arrivée, Parcours et reprise multi-programmes

**Priorité : P1 UX. Dépendances : clôture V3.5 ; V4-016B pour la revue desktop
finale.**

**Références canoniques complémentaires :**

- `docs/EMOTIONAL_DESIGN_CONTRACT.md` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-emotional-flow.html` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/emotional-design-renders/`.

### Constat

- L'API `/api/today` sélectionne une recommandation globale puis ne renvoie que
  le programme associé comme `program` actif.
- L'écran Aujourd'hui affiche donc un seul lien de reprise et une seule
  progression, même lorsque l'utilisateur suit plusieurs programmes.
- Dans le cas observé, le parcours Psychologie masque de fait les autres
  programmes suivis depuis l'accueil, alors qu'ils restent accessibles dans
  Mes programmes.
- Un nouveau compte sans inscription traverse aujourd’hui un vide générique qui
  ne distingue pas première arrivée, absence courante et retour sans activité.
- `Mes parcours` et `Découvrir` doivent exprimer deux intentions différentes ;
  recherche, filtres et compteurs vides ne doivent pas précéder le choix utile.

### Périmètre

- Router explicitement selon l’existence d’au moins une inscription : première
  arrivée sans parcours ou accueil de retour. Ne jamais utiliser `Découvrir`
  comme valeur par défaut universelle.
- Pour la première arrivée, afficher une phrase expliquant LearnX et un CTA
  unique `Choisir mon premier parcours`, sans compteur à zéro, historique,
  recherche ou filtre ; après inscription, ouvrir la première activité serveur
  disponible.
- Conserver une recommandation principale unique, choisie côté serveur selon
  les priorités pédagogiques existantes, sans favoriser un slug ou un programme
  codé en dur.
- Faire retourner par l'API Aujourd'hui un résumé borné de chaque programme
  effectivement suivi et accessible au compte : identité, titre, progression,
  dernière activité ou prochaine action canonique et destination de reprise.
- Afficher sous l'action principale une section `Mes programmes en cours` qui
  permet de reprendre chacun des programmes suivis en une action.
- Distinguer clairement la recommandation du jour des reprises secondaires :
  une seule action primaire, puis des lignes ou cartes compactes par programme.
- Ordonner les reprises par activité récente et priorité serveur, avec un ordre
  déterministe pour les programmes jamais commencés.
- Couvrir les programmes inscrits, privés possédés et publiés accessibles sans
  exposer un brouillon ou un programme auquel le compte n'a pas droit.
- Garder la liste lisible et bornée ; si le nombre devient élevé, proposer un
  accès explicite à Mes programmes sans tronquer silencieusement l'existence des
  autres parcours.
- Traduire les nouveaux libellés FR/EN et conserver calculs de progression,
  recommandations et droits d'accès exclusivement côté serveur.
- Séparer `Mes parcours` pour la reprise et `Découvrir` pour le choix ; révéler
  la recherche à la demande, placer les filtres après une collection réelle et
  présenter les parcours en cours avant les états quittés ou administratifs.
- Préférer des lignes éditoriales compactes ; une carte n’existe que pour un
  bloc autonome d’action, d’état ou de navigation.

### Hors périmètre

- Modifier l'ordre pédagogique interne d'un programme, fusionner les
  progressions, recommander plusieurs actions primaires ou introduire une
  personnalisation IA.
- Remplacer Mes programmes, afficher les programmes du catalogue non suivis ou
  rendre publics des contenus privés.

### Critères d'acceptation

- Un compte suivant au moins trois programmes voit les trois sur Aujourd'hui et
  peut reprendre chacun à sa destination serveur exacte.
- La recommandation principale reste unique et identifiable ; elle peut provenir
  de n'importe lequel des programmes accessibles selon les priorités existantes.
- Chaque progression et destination correspond au bon couple utilisateur +
  programme ; aucune donnée d'un autre compte ou d'un programme inaccessible
  n'est renvoyée.
- Un programme jamais commencé propose `Commencer`; un programme entamé propose
  `Reprendre`; un programme terminé expose un état terminé sans fausse action.
- L'état vide reste correct lorsque le compte ne suit aucun programme, et un
  programme retiré ou devenu inaccessible disparaît dès invalidation serveur.
- Un nouveau compte atteint `Choisir mon premier parcours` sans traverser une
  statistique ou un outil vide ; le retour après inscription mène à la première
  activité disponible.
- Un utilisateur distingue sans aide `Mes parcours` et `Découvrir`, et la
  recherche reste fermée tant qu’elle n’est pas demandée.
- Le rendu reste utilisable à 320/390 px, sur desktop, à 200 % de texte, au
  clavier et avec lecteur d'écran.
- Les preuves de compréhension correspondantes sont consignées selon
  `docs/V3_5_QA_MATRIX.md` ; la conformité à la maquette seule ne clôt pas le
  ticket.

### Tests et risques

- Tests API avec zéro, un et plusieurs programmes, propriété privée,
  inscriptions, retraits, permissions, progression et ordre déterministe.
- Tests composants et E2E vérifiant trois reprises distinctes, destinations,
  libellés FR/EN, absence de duplication de l'action principale et responsive.
- Tests première arrivée, inscription puis retour, Mes parcours/Découvrir,
  recherche progressive et absence de compteurs/filtres vides.
- Test de requêtes bornées et absence de N+1 avant d'élargir le payload Today.
- Risque principal : transformer l'accueil en deuxième catalogue. Garder un
  résumé compact et renvoyer les détails complets vers Mes programmes.

### Migration et rollback

- Aucune migration Prisma attendue : les enrollments, propriétés, progressions
  et destinations existent déjà. Le contrat API est étendu de façon additive.
- Le rollback restaure l'ancien rendu mono-programme sans modifier les données.

---

## V4-016G — Présentation des corrections IA, crédits et paiement

**Priorité : P1 confiance. Dépendances : V3.5-009 et contrats des V4-007,
V4-010, V4-011 et V4-014 disponibles.**

**Références canoniques complémentaires :**

- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-correction-flow.html` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-atlas-surfaces.html` ;
- `docs/V4_AI_CORRECTION_COMPOSITE_SPEC.md` ;
- `docs/EMOTIONAL_DESIGN_CONTRACT.md` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-emotional-flow.html` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/emotional-design-renders/`.

### Périmètre

- Définir une grammaire de confiance commune aux surfaces de correction et de
  finance, sans modifier leurs règles serveur ni leurs contrats métier.
- Appliquer Atlas sans vert et la vue Correction IA validée : surfaces mates,
  bleu pour action/progression/positif, laiton seulement éditorial, Manrope pour
  l'interface et Source Serif 4 pour les titres ou synthèses définis.
- Distinguer explicitement : résultat déterministe, retour assisté par IA,
  critères/rubrique authorés, sources ou preuves utilisées, niveau de confiance,
  seconde correction IA éventuelle, contestation et possibilité de réessai.
- Présenter la correction par critère avec preuve tirée de la réponse, synthèse,
  historique et action suivante ; ne jamais donner au texte généré l'apparence
  d'une vérité scientifique ou d'une décision serveur.
- Pour tout résultat d’exercice ou d’évaluation, ordonner l’information ainsi :
  acquis, éléments à renforcer, prochaine action, puis score/seuil secondaires
  et évolution entre tentatives lorsqu’elle existe.
- Nommer ces preuves « Extrait de votre réponse » et réserver « Références
  mobilisées » aux sources externes, dans une zone distincte.
- La signature cartographique peut situer la correction dans le parcours mais
  ne représente jamais intelligence, génération, qualité ou niveau de confiance.
- Avant confirmation d'une action payante, afficher unité en crédits LearnX,
  prix/plafond, consommation estimée et règle de règlement/libération. Après
  exécution, afficher débit réel, différence libérée et destination dans
  l'historique.
- Rendre allocation offerte, crédits achetés, solde disponible, réservation,
  expiration éventuelle et historique compréhensibles sans exposer de tokens.
- Conserver allocation offerte et crédits achetés comme lignes principales ; le
  total disponible n'est qu'un résumé secondaire. Après correction, garder le
  règlement synthétique visible et rendre son détail dépliable.
- Présenter `PROVISIONAL`, `UNCERTAIN` et `UNUSABLE` avec des libellés humains.
  `UNCERTAIN` masque le score exact ; une plage n'existe que si le serveur l'a
  calculée selon un contrat versionné.
- Présenter l'ajustement admin dans un panneau latéral desktop et une surface
  plein écran mobile, puis afficher un récapitulatif avant validation.
- Expliquer sobrement échec, remboursement de réservation, paiement, litige et
  indisponibilité, avec une action principale sûre et aucune mutation silencieuse.
- Toute récupération répond explicitement à quatre questions : incident,
  conservation, non-effet ou non-débit, puis action sûre. Le retour conserve la
  destination et l’idempotence empêche une mutation en double.
- Adapter les mêmes informations aux vues apprenant et admin sans esthétique de
  wallet spéculatif, banque grand public, casino, cockpit technique ou SaaS IA.

### Hors périmètre

- Modifier prix, marge, modèle, score, seuil, contrat pédagogique, ledger,
  provider ou règle de remboursement.
- Chat, avatar IA, animation de génération, gradient magique, score de confiance
  présenté comme certitude ou vocabulaire de tokens côté utilisateur.
- Vert, CTA laiton, halo, glassmorphism ou habillage cartographique décoratif
  des prix, soldes et paiements.

### Critères d'acceptation

- Avant chaque confirmation payante, l'utilisateur peut répondre clairement à
  `combien au maximum`, `quelle unité`, `pour quelle action` et `que se passe-t-il
  en cas d'échec`.
- Après correction, il distingue résultat déterministe, appréciation IA,
  rubrique, preuves/sources, historique et réessai sans se fier à la couleur.
- Sans lire tout le détail, l’utilisateur peut citer au moins un acquis, un
  élément à renforcer et la prochaine action ; le score n’est pas son premier
  repère et le rouge ne signale pas une difficulté pédagogique normale.
- Le résumé du règlement reste visible sans ouvrir le détail, et ses chiffres
  proviennent exclusivement des contrats serveur ; aucune fixture financière
  ne peut apparaître en production.
- L'IA apparaît comme `correction assistée` fondée sur des critères et ne prend
  jamais la place de la marque, du titre d'écran ou de l'action pédagogique.
- Une seule action remplie domine chaque devis, correction, recharge ou erreur ;
  les actions secondaires restent disponibles et hiérarchisées.
- Texte ≥ 4,5:1, contrôles ≥ 3:1, cibles ≥ 44 × 44 px, zoom 200 % et reduced
  motion sont validés sur mobile et desktop.
- Aucun état positif ou financier ne repose uniquement sur le bleu et aucun
  vert n'est réintroduit pour simuler une convention de succès.
- Les revues de design utilisent corrections complètes/incertaines/échouées,
  secondes corrections IA, contestations, solde faible,
  réservation, libération, paiement refusé et historique réaliste.
- Default, loading, error, empty, solde insuffisant, réservation en cours,
  correction partielle, correction indisponible et paiement refusé conservent
  unité, autorité et prochaine action explicites.
- Pour chaque erreur, conservation, non-effet/non-débit et action sûre sont
  comprises et consignées conformément à `docs/V3_5_QA_MATRIX.md`.
- Les valeurs utilisent exclusivement les contrats serveur et catalogues
  publiés ; le ticket n'invente aucun montant, pack, expiration ou capacité.
- Les rayons restent 4/7/12 px, les espaces 4/8/12/16/24/32/48 px ; aucune
  carte imbriquée au-delà d'un niveau, CTA concurrent, cyan électrique, vert,
  ombre décorative ou grosse tuile active.

### Tests et risques

- Tests de compréhension qualitatifs, composants, E2E, lecteur d'écran et
  captures réalistes pour chaque état financier et de correction.
- Captures 320/390 et 1024/1440/1920 px, zoom 200 %, clavier, focus visible,
  contrastes, reduced motion et contenus longs FR/EN.
- Risque : rendre une opération financière rassurante mais ambiguë. La précision
  du montant, de l'unité et de l'autorité serveur prime sur la simplification.

### Migration et rollback

- Aucun changement métier attendu. Les vues consomment uniquement les contrats
  versionnés ; rollback par surface correction, crédits ou paiement.

---

## V4-017 — Sécurité IA, confidentialité, abus et contrôle des dépenses

**Priorité : P0. Dépendances : V4-004, V4-006 et V4-013.**

### Périmètre

- Threat model final sur fournisseur IA, prompts, soumissions, secrets, paiements,
  ledger, webhooks, exports et administration.
- Limiter taille, fréquence, concurrence, budget et modèles par utilisateur.
- Résister aux prompt injections contenues dans les réponses d'apprenants.
- Définir minimisation, consentement/information, rétention et suppression des
  données envoyées aux fournisseurs.
- Publier une information de confidentialité cohérente avec les fournisseurs
  réellement utilisés et documenter un traitement manuel sûr des demandes de
  fermeture, accès ou suppression en attendant le centre V6.
- Fournir avant tout pilote payant un canal de contact identifiable pour support,
  paiement et signalement de sécurité ; il ne constitue pas encore le ticketing V6.
- Mettre en place alertes, kill switches indépendants correction/paiement et
  procédure de rotation/révocation.
- Tester abus de crédits, IDOR, replay, contournement de prix et fuite de données.
- Prévoir budgets P90 et limites anti-abus distincts pour l'essai public, les
  allocations privées famille/amis et les avantages early adopters.

### Hors périmètre

- Certification formelle ou promesse de sécurité absolue.

### Critères d'acceptation

- Aucun P0/P1 ouvert avant pilote payant.
- Une panne fournisseur ou budget global atteint échoue fermé et rend les crédits.
- Les journaux techniques n'exposent ni réponse complète ni donnée de paiement.
- L'utilisateur sait qu'une correction envoie sa réponse à un fournisseur IA.
- Les contacts support/sécurité, la procédure manuelle de demande sur les données
  et les règles de rétention applicables sont accessibles et testées.

### Tests et risques

- Tests adversariaux, charge bornée, secrets, dépendances et contrôle multi-compte.
- Risque : coût financier direct d'une faille logique sans fuite de données.

---

## V4-018 — Calibration économique et pilote progressif

**Priorité : P0 release. Dépendances : V4-003, V4-010, V4-012, V4-014 et V4-017.**

### Périmètre

- Exécuter le benchmark V4 complet des corrections, erreurs, secondes passes
  automatiques et nouvelles analyses volontaires. La génération de blueprints
  ou de leçons appartient à un benchmark V5 séparé et ne conditionne pas le GO
  de la correction V4.
- Mesurer coût médian/P75/P90, qualité, latence, retry, seconde correction et marge de
  contribution avant coûts fixes.
- Fixer prix et plafonds initiaux, capacités moyennes des packs et alertes.
- Déployer successivement admin, utilisateurs invités gratuits, puis achats réels
  limités avec plafonds conservateurs.
- Comparer résultats réels au modèle financier et documenter les écarts.

### Hors périmètre

- Génération de contenu accessible aux utilisateurs ou ouverture publique.

### Critères d'acceptation

- Les chiffres commerciaux proviennent des mesures et portent leur date/version.
- La marge de contribution projetée reste supérieure au plancher dans les
  scénarios validés ; la rentabilité nette inclut ensuite les coûts fixes réels.
- Chaque étape du rollout dispose de critères stop/go et d'un rollback testé.

### Tests et risques

- Données anonymisées, coûts plafonnés et absence de facturation involontaire.
- Risque : données friends and family insuffisantes pour extrapoler une activité.

---

## V4-018A — Essai public et cohortes pilotes

**Priorité : P1 acquisition maîtrisée. Dépendances : V4-010, V4-012, V4-017 et
calibration V4-018.**

### Périmètre

- Configurer un essai public unique de trois corrections standard, sans carte,
  non renouvelable. Une exécution sans résultat utilisable ne consomme pas une
  correction d'essai.
- Appliquer à l'essai des limites anti-abus, un budget P90 et un kill switch
  indépendants des crédits achetés.
- Configurer séparément une allocation privée `FAMILY_AND_FRIENDS`, sponsorisée,
  renouvelable et non reportable, absente de la landing et exclue du CAC
  commercial.
- Configurer une cohorte `EARLY_ADOPTER` avec avantage ponctuel ou temporaire,
  sans gratuité à vie ni confusion avec le consentement e-mail de la landing.
- Mesurer coût moyen, médiane, P75 et P90 de l'essai, coût d'essai par inscrit,
  CAC IA par client payant, CAC complet et funnel correction 1 → 2 → 3 → achat.

### Hors périmètre

- Essai renouvelable, abonnement gratuit permanent, parrainage, bonus public ou
  fusion des cohortes privées avec les offres commerciales.

### Critères d'acceptation

- Les trois cohortes possèdent règles, budgets, métriques et audit distincts ;
  une allocation famille/amis n'apparaît jamais comme acquisition commerciale.
- L'utilisateur comprend le nombre de corrections d'essai restant et qu'une
  erreur technique inutilisable n'en consomme aucune.
- La limite d'essai est appliquée côté serveur et résiste aux reprises, doubles
  clics, changements de session et abus raisonnablement détectables.
- Toute modification de volume ou durée est versionnée et requiert l'arbitrage
  du Propriétaire ; aucun avantage early adopter n'est présenté comme perpétuel.

### Tests et risques

- Comptes multiples, concurrence, échec fournisseur, épuisement du budget,
  conversion et séparation des cohortes.
- Risque : confondre coût pilote subventionné, CAC et économie unitaire payante.

---

## V4-019 — Audit final, déploiement et clôture V4

**Priorité : P0 release. Dépendances : V3.5 clôturée, V4-001 à V4-018A,
V4-016A, V4-016B, V4-016C et V4-016G.**

### Périmètre

- Réaudit fonctionnel, pédagogique, sécurité, confidentialité, accessibilité,
  responsive mobile/desktop, performance, acquisition publique, PWA,
  migrations, finance et exploitation.
- Vérifier la conformité au système de marque, aux gabarits, aux primitives et
  à la matrice V3.5-008 sans assimiler fidélité à l'atlas et qualité d'usage.
- Exécuter lint, typecheck, tests, build, E2E, migrations sur clone Neon,
  tests sandbox paiement et smoke production borné.
- Vérifier clés, budgets, kill switches, alertes, sauvegarde et rollback.
- Réconcilier un cycle complet : achat → crédits → correction → règlement →
  clôture, ainsi qu'un échec et un litige.
- Rejouer domaine public → liste d'attente/early adopter et domaine public →
  connexion → installation → réouverture directe de l'application.
- Produire le rapport de clôture et mettre à jour les sources de vérité.

### Hors périmètre

- V5, génération de formation et dette sans preuve issue de l'audit.

### Critères d'acceptation

- Aucun P0/P1 ouvert ; toutes les migrations sont répétables et réversibles selon
  la stratégie approuvée.
- Les soldes et agrégats se réconcilient ; aucun secret ou coût orphelin.
- Les paiements réels restent désactivables indépendamment des corrections.
- Le canal minimal de support, les informations de confidentialité et les
  procédures manuelles de fermeture/export/suppression nécessaires avant V6
  fonctionnent sur les environnements réellement ouverts.
- La matrice finale couvre les nouvelles surfaces V4 en default, loading,
  error, empty et disabled lorsque pertinents, avec captures 320/390,
  768/1024, 1440/1920 et zoom 200 %.
- Aucune régression ne réintroduit cyan électrique, vert, gradients IA,
  cardification imbriquée, rayons hors contrat, ombres décoratives desktop ou
  plusieurs CTA remplis concurrents.
- V4 n'est déclarée terminée qu'après rapport GO explicite.

### Tests et risques

- Matrice desktop/mobile/WebKit, réseau lent, concurrence, reprise et sécurité.
- Risque : déclarer V4 terminée sur tests locaux sans parcours financier réel.

## Gates externes et paramètres à résoudre avant ouverture commerciale

Le scope produit 1.0 est figé. Les éléments suivants déterminent les valeurs de
configuration, la conformité et le GO de V4B ; ils ne peuvent ajouter une
fonctionnalité au backlog sans amendement produit explicite.

1. Qualification BIC ou BNC et traitement TVA des factures OpenRouter.
2. Éligibilité au versement libératoire et réserve fiscale initiale.
3. Conditions et frais réels du compte Revolut Merchant LearnX.
4. Valeur commerciale définitive du crédit et politique de validité des crédits
   achetés.
5. Politique de rétention des soumissions et corrections chez LearnX et les
   fournisseurs.
6. Données minimales du benchmark autorisées et anonymisation.
7. Domaine canonique, orthographe de marque et sous-domaine applicatif définitif.
8. Fournisseur d'envoi/gestion de liste, durée de rétention et texte
   d'information des prospects.
9. Noms des tiers, promesse marketing, capacité moyenne publiée et politique
    d'admission des early adopters.
10. Qualification fiscale/juridique des crédits fermés : moment de taxation,
    rétractation, remboursement, clôture de compte et exclusion éventuelle des
    services de paiement, à confirmer professionnellement.
11. Coefficients finaux par scénario, prix plancher, classes de taille P90 et
    réserve d'exécution des crédits encore en circulation.
12. Écarts V4 acceptés par rapport au système V3.5 pour correction, crédits,
    paiement et landing commerciale.
13. Évolutions éventuelles de l'atlas ou des tokens : elles nécessitent une
    décision de marque explicite et ne sont pas inventées dans un ticket V4.
