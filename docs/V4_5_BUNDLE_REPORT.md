# Écart de bundle — rapport et propositions (V4.5-183)

- **Version** : 1.0.0 · **Date** : 30 août 2026
- **Owner** : Head of UX/UI (voie C) · **Reviewer** : voie D
- **Mesures** : `dev` @ `eb8f42c9`, `pnpm build` puis `pnpm quality:bundle`,
  attribution par module via les sourcemaps de `vite build --sourcemap`
- **Ce rapport ne change aucun seuil.** Les seuils appartiennent à la voie D ;
  l'objet est de rendre la décision possible avec des chiffres.

## 1. Où on en est

| Mesure | Valeur | Seuil | Écart | Bloquant |
| --- | --- | --- | --- | --- |
| JavaScript initial | 113 557 | 125 000 | −11 443 | oui |
| CSS initial | 19 830 | 25 000 | −5 170 | oui |
| Plus gros morceau différé | 12 206 | 13 460 | −1 254 | oui |
| **Total JavaScript** | **256 680** | **150 000** | **+106 680** | non |
| Total CSS | 25 802 | 30 000 | −4 198 | non |
| Précache PWA | 1 397 391 | 1 492 916 | −95 525 | non |

Tout est dans les clous sauf une ligne, qui l'est de 71 %.

## 2. Le total est un seuil qu'on ne tient pas, et ça a un coût

Il est dépassé depuis longtemps et personne n'agit. Un seuil durablement rouge
n'est pas un garde-fou : c'est un entraînement à ignorer une ligne rouge. Le
jour où il signalera une vraie régression, il aura déjà appris à être ignoré —
et c'est exactement ce que nous venons de vivre deux fois ailleurs, avec des
tests verts qui ne prouvaient rien.

Il y a plus gênant : **cette mesure pénalise le découpage qu'on a fait
exprès.** « Total JavaScript » additionne tous les morceaux différés, or aucun
apprenant ne les télécharge tous — le catalogue admin, les pages d'évaluation
et la page légale ne partent que sur la route correspondante. Mieux on découpe,
plus ce nombre grossit. Le chiffre qui décrit ce qu'un visiteur paie vraiment
est le JavaScript initial, et il est à 91 % de son budget.

Trois manières d'en sortir, à trancher par la voie D :

1. **Refixer le seuil à ce qu'on tient réellement** (par exemple 260 000) et
   dire dans le script qu'il mesure la surface totale, pas le coût d'une
   visite. Honnête et immédiat.
2. **Remplacer le total par une mesure de trajet** : initial + les morceaux
   d'un parcours réel (arrivée, leçon, exercice). C'est ce qu'un apprenant
   télécharge ; c'est le nombre qui mérite un seuil.
3. **Le retirer.** Préférable à le laisser rouge : un indicateur qu'on ignore
   coûte plus qu'il ne rapporte.

Ma préférence va à 2, avec 1 comme étape immédiate. 3 seulement si 2 n'est pas
fait, car le total sans contexte n'apprend rien.

## 3. Ce qui pèse, et ce qui est réductible

Attribution du chunk initial (1 126 053 octets de source, 110 282 gzip) :

| Part | Origine | Réductible ? |
| --- | --- | --- |
| 48,4 % | `react-dom` | non, sauf changement de socle |
| 33,0 % | `react-router` | non |
| **12,6 %** | **`src/i18n/catalogs`** | **oui** |
| 0,9 % | `scheduler` | non |
| 0,9 % | `src/features/pwa` | marginal |
| 3,2 % | le reste de l'application | marginal |

**81 % du chunk initial est le socle React.** Aucune optimisation applicative
ne le déplacera ; le seul levier réel est le quatrième.

## 4. La seule action rentable : les catalogues de langue

`src/i18n/catalogs.ts` exporte `frenchMessages` **et** `englishMessages`, et
`I18nProvider` les importe tous les deux. Les 1 060 clés existent donc en deux
exemplaires dans le chunk initial de chaque visiteur, qui n'en lira jamais
qu'un seul jeu.

Coût mesuré : **environ 13 900 octets gzip**, soit 12,6 % du chunk initial et
**plus que la marge restante avant le budget bloquant** (11 443).

Deux options :

- **Différer la langue inactive.** Le catalogue de la langue courante reste
  dans le chunk initial, l'autre part dans un morceau chargé au changement de
  langue. Gain estimé ≈ 7 000 octets gzip, sans aucun texte manquant au premier
  rendu.
- **Différer les deux.** Gain estimé ≈ 13 900, mais le premier rendu attend un
  aller-retour avant d'avoir ses libellés. À écarter : c'est précisément le
  genre de compromis qui échange un chiffre contre une seconde de texte absent.

**Recommandation : différer la langue inactive.** Elle double presque la marge
avant le seuil bloquant, elle ne dégrade aucun premier rendu, et elle est
proportionnée — ce n'est pas une réécriture, c'est un import dynamique.

Réserve honnête : le gain est une estimation dérivée du ratio de compression
global du chunk. Il faut le mesurer après coup, et ne rien annoncer avant.

## 5. Ce que je ne recommande pas

- **Relever le budget initial ou celui du plus gros morceau différé.** Ils sont
  tenus, ils bloquent, ils font leur travail. V4.5-182 vient de le montrer :
  le budget du plus gros morceau différé a refusé une dépendance de 17 883
  octets et a fait choisir une variante à 4 799 pour le même résultat. Un seuil
  tenu change les décisions ; c'est l'argument pour ne pas y toucher.
- **Sortir React ou le routeur.** 81 % du chunk initial, mais aucun de ces
  octets n'est du gaspillage.
- **Découper davantage les pages.** Le découpage est déjà fin — vingt-cinq
  morceaux différés, le plus gros à 12 206. Continuer ne ferait que grossir le
  total, c'est-à-dire la mesure la moins utile.

## 6. Décisions demandées

1. Que faire du seuil total : le refixer, le remplacer par une mesure de
   trajet, ou le retirer. **Voie D.**
2. Ouvrir un ticket pour différer le catalogue de la langue inactive, avec
   mesure avant/après dans la PR. **Voie C**, une fois la décision 1 prise —
   l'ordre importe, sinon le gain sera lu sur un indicateur qu'on s'apprête à
   changer.
