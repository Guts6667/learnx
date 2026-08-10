# LearnX V3.5 — Shells et navigation Atlas

**Ticket : V3.5-003**
**Statut : ACTIF**

Ce contrat applique la direction Atlas A2 sans changer les routes, les rôles ou
le parcours pédagogique.

## Shells

| Contexte | Routes | En-tête | Navigation globale | Contenu privé |
| --- | --- | --- | --- | --- |
| Public | `/`, `/interest` | marque et actions publiques | aucune | jamais chargé |
| Authentification | `/login`, `/request-access`, `/verify-email`, `/activate` | marque vers l'accueil public | aucune | jamais affiché |
| Apprenant | routes protégées | marque et retour contextuel stable | cinq destinations | après session serveur confirmée |
| Administration | `/admin/**` | retour vers le parent admin stable | rail apprenant + navigation admin locale | après session ADMIN confirmée |

La session inconnue, expirée ou anonyme ne rend ni rail, ni navigation basse,
ni contenu privé. Le shell d'authentification reste utilisable sans session et
la marque ramène à la landing.

## Navigation globale

- Mobile : cinq destinations avec icône et libellé, cible minimale 44 × 44 px,
  safe areas et état actif par texte, surface ardoise et filet bleu de 3 px.
- Desktop : rail de 216 px, mêmes routes, permissions et libellés ; les éléments
  sont alignés en ligne pour préserver la lisibilité à 200 %.
- Aucun sixième item et aucune grande tuile active.
- Le focus utilise l'anneau Atlas bleu clair de 2 px avec un décalage de 2 px.

## Contexte et retour

Le retour global utilise une destination métier stable lorsqu'elle est connue :
activité vers leçon, leçon/module/étape vers programme, note vers Notes et route
admin vers son parent. Les cinq racines apprenant n'affichent aucune flèche.
Un titre de contexte ou un fil d'Ariane textuel peut compléter ce retour, sans
créer une seconde barre de navigation.

## Profondeur et navigation locale

Trois niveaux visuels au maximum : navigation globale, contexte du parcours,
puis navigation locale (onglets, sommaire ou actions précédent/continuer). Les
onglets locaux restent des contrôles compacts ; ils ne deviennent pas des
cartes ni une navigation globale concurrente.

## États et accessibilité

- `loading` : structure neutre sans flash privé ;
- `anonymous` / `expired` : shell d'authentification sans navigation privée ;
- `offline` : message privé sûr, sans données mises en cache d'un autre compte ;
- erreur : explication et remédiation accessibles ;
- clavier : ordre DOM, skip link, focus visible et retour sans boucle ;
- reduced motion : aucune information ne dépend de l'animation.

Le rollback restaure le shell précédent sans migration de données. Les routes,
permissions et destinations restent la source de vérité côté serveur et dans
les helpers de navigation existants.
