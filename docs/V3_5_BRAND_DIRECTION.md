# LearnX V3.5 — Fondations Atlas et tokens visuels

**Ticket : V3.5-001**

**Contrat : BACKLOG_V3_5.md 0.7.0 et référence A2**
**Statut : APPROUVÉ — réaligné sur Atlas sans vert le 10 août 2026**

## 1. Direction canonique

LearnX utilise **Atlas**, une identité éditoriale calme fondée sur deux régimes :

- application, apprentissage et administration : encre, navy et ardoise ;
- landing et contextes éditoriaux clairs : papier chaud et ivoire.

Le bleu ardoise est l'unique accent de marque. Il porte l'action, la
progression et les états positifs, toujours avec un texte ou une forme. Le
laiton est un repère éditorial rare : il ne représente jamais une action
principale, un succès ou un avantage financier. Aucun token vert n'appartient
à Atlas.

Les références canoniques sont A1 à A4 listées dans `BACKLOG_V3_5.md`. Elles
annulent les explorations visuelles antérieures.

## 2. Palette A2 non négociable

| Couleur A2 | Valeur | Rôle autorisé |
| --- | --- | --- |
| Encre | `#121C24` | canevas sombre, texte sur papier |
| Navy | `#1A2933` | surface basse |
| Surface | `#243641` | surface ou sélection discrète |
| Surface haute | `#304650` | overlay et surface élevée |
| Bleu Atlas | `#557F9A` | marque, progression, état positif |
| Bleu clair | `#89ACBE` | focus et texte accentué sombre |
| Bleu doux | `#D9E4E8` | fond éditorial clair ponctuel |
| Laiton | `#BEA169` | repère éditorial secondaire rare |
| Papier | `#F1EEE6` | canevas public |
| Papier profond | `#E2DDD3` | alternance publique discrète |
| Ivoire | `#F8F5EE` | texte sombre et surface papier |
| Texte secondaire | `#B8C4C9` | aide et métadonnées sombres |
| Danger | `#C4766C` | erreur et destruction uniquement |

Les rôles techniques complémentaires du contrat A2 utilisent `#3A4E58` pour
les filets, `#60747E` pour les limites interactives et `#89979C` pour le texte
désactivé. Ils ne créent pas une couleur de marque supplémentaire.

### Ajustement WCAG de l'action

Le couple A2 brut ivoire `#F8F5EE` sur bleu `#557F9A` atteint seulement
3,95:1. Le bleu exact reste donc le token de marque et de progression, tandis
que les boutons utilisent une variante assombrie du même bleu :

- application : `#4C748C`, contraste 4,61:1 avec l'ivoire ;
- papier : `#466B82`, contraste 5,23:1 avec l'ivoire.

Cet ajustement ne modifie ni la palette A2 ni la hiérarchie bleu/laiton. Il est
strictement fonctionnel et peut être annulé indépendamment du reste des tokens.

## 3. Tokens sémantiques

### Régime sombre

| Token | Valeur | Usage |
| --- | --- | --- |
| `--color-canvas` | `#121C24` | arrière-plan principal |
| `--color-surface` | `#1A2933` | groupe autonome |
| `--color-surface-subtle` | `#243641` | alternance ou état actif |
| `--color-surface-raised` | `#304650` | tiroir, menu, overlay |
| `--color-text` | `#F8F5EE` | texte principal |
| `--color-text-muted` | `#B8C4C9` | métadonnée et aide |
| `--color-border` | `#3A4E58` | filet structurel |
| `--color-control-border` | `#60747E` | limite interactive |
| `--color-accent` | `#557F9A` | marque et progression graphique |
| `--color-success` / `--color-accent-text` | `#89ACBE` | positif et accent textuel sombres |
| `--color-action` | `#4C748C` | action principale conforme AA |
| `--color-focus` | `#89ACBE` | anneau de focus |
| `--color-warning` / `--color-brass` | `#BEA169` | attention textuelle, repère rare |
| `--color-danger` | `#C4766C` | erreur ou destruction |

### Régime papier

Le canevas utilise `#F1EEE6`, la surface `#F8F5EE`, l'alternance `#E2DDD3`
et le texte `#121C24`. Les rôles interactifs restent bleus. Les variantes
papier de danger et d'attention sont assombries pour conserver 4,5:1 ; leur
sens ne change jamais.

## 4. Contrastes mesurés

| Paire | Ratio |
| --- | ---: |
| ivoire / encre | 15,84:1 |
| texte secondaire / encre | 9,68:1 |
| ivoire / navy | 13,69:1 |
| ivoire / action sombre | 4,61:1 |
| bleu clair / encre | 7,15:1 |
| action papier / papier | 5,23:1 |
| limite de contrôle / encre | 3,53:1 |
| encre / papier | 14,88:1 |
| texte secondaire papier / papier | 5,07:1 |
| ivoire / action papier | 5,23:1 |
| danger papier / papier | 5,21:1 |
| attention papier / papier | 4,58:1 |

Un filet purement structurel peut rester sous 3:1. Une limite interactive ne
le peut pas. Un état associe toujours couleur, texte et forme.

## 5. Typographie

- **Manrope 400/500** : interface, corps, contrôles, métadonnées et chiffres ;
- **Source Serif 4 400/500** : display éditorial et titres pédagogiques ;
- pile monospace système : code et identifiants techniques.

Les fichiers WOFF2 sont servis localement via Fontsource avec
`font-display: swap`. Les fallbacks restent `system-ui` et `Georgia`. Les
familles couvrent FR/EN, accents et chiffres sans requête vers un fournisseur
externe.

Le corps de leçon mesure 16 à 18 px, utilise un interligne de 1,65 à 1,75 et
vise 62 à 68 caractères, sans dépasser 72.

## 6. Espace, rayons et mouvement

Échelle d'espace unique : `4, 8, 12, 16, 24, 32, 48 px`.

| Rayon | Usage |
| --- | --- |
| 4 px | filet ou bloc directionnel |
| 7 px | bouton, champ et contrôle |
| 12 px | groupe autonome, tiroir ou dialogue |
| 20 px | cadre mobile de présentation uniquement |

Les ombres sont réservées aux overlays. Les transitions utilisent 120, 180 ou
240 ms et disparaissent quand `prefers-reduced-motion` le demande. Toute cible
interactive mesure au moins 44 × 44 px.

## 7. Règle du laiton et signature cartographique

Le laiton peut apparaître comme petit repère de marque, losange d'attention ou
coordonnée éditoriale. Il est toujours doublé d'un libellé, reste absent des
CTA et ne concurrence jamais le bleu dans une zone de décision.

La signature cartographique explique une position ou une progression. Tracé,
nœud et point actif sont décoratifs seulement lorsqu'ils dupliquent une
information textuelle, auquel cas ils sont ignorés par les technologies
d'assistance. Elle n'est jamais une texture répétitive.

## 8. Migration et rollback

Les alias `--app-*` restent reliés aux tokens sémantiques pendant la migration
écran par écran. Le rollback restaure un groupe de tokens ou une famille de
composants, sans toucher aux données ni aux flows. Toute nouvelle valeur doit
être mesurée et documentée avant son adoption.
