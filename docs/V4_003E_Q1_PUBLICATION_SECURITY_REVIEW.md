# V4-003E-Q1 — revue de sécurité avant publication

## Verdict

`SAFE_TO_PUBLISH_SANITIZED_BRANCH_ONLY`

La branche publiable est `codex/ai-correction-unblock-audit`, construite depuis
`origin/dev@f6607b9c086cffce1f81ac9a8c2fc36194fe5a25`. La branche privée
`codex/ai-correction-unblock` ne doit jamais être poussée : elle conserve la
preuve fournisseur brute immuable.

## Périmètre audité

- commits source privés : `fc21d14`, `0b90550` ;
- reprises privées locales : `0f271aa`, `7e6c6a6` ;
- commits publics reconstruits : `03159ba`, `3702492`, `73a1700` ;
- rapport Q1 immuable :
  `b6d40371484411fa51eecf5363a1788d1af9301814b365aea834518eb4f613f6` ;
- dérivation publique expurgée :
  `b1ff2fc3f077b53239aefc0c037c1b5021e07b98706c020e800a7fd0de0b1f2e` ;
- notice de publication :
  `d09996a91afa74a753d90b64b315aace5aa97771f399fd8193e04e18d67afe34`.

## Constat et traitement

Le brut privé Q1 contient un identifiant de compte OpenRouter. Le
`ledger.jsonl` privé duplique ce brut dans l'événement `RAW_RECEIVED`. Aucun des
deux fichiers ne contient une clé d'authentification, mais leur métadonnée de
compte ne doit pas être publiée.

La branche publique a donc été reconstruite avant le premier commit de résultat
et non nettoyée après coup. Son histoire ne contient ni le chemin `raw/` privé,
ni `ledger.jsonl`, ni la valeur de l'identifiant de compte. Le rapport, les
intents, outcomes, empreintes et états de réconciliation restent publiés. La
représentation `public/raw-error.redacted.json` retire uniquement `user_id` et
conserve l'erreur Google utile au diagnostic ainsi que les empreintes de la
preuve privée.

## Contrôles exécutés

- recherche de la valeur exacte de l'identifiant privé dans tout le diff
  `origin/dev..HEAD` : absente ;
- recherche historique des chemins privés `raw/*.json` et `ledger.jsonl` :
  absents ;
- recherche de clés OpenRouter, valeurs Bearer et affectations de secrets dans
  l'histoire reconstruite : aucun résultat ;
- vérification du SHA-256 du rapport Q1 après reconstruction : identique ;
- `git diff --check` : conforme.

Le brut privé reste récupérable dans le worktree et la branche privés. Cette
revue n'autorise ni leur publication, ni un nouvel appel fournisseur, ni une
écriture conservatrice de coût.
