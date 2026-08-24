# Publication des artefacts Q1

Le brut fournisseur original est une preuve privée append-only. Il contient un
identifiant de compte OpenRouter et ne doit pas être publié, même si aucun
secret d'authentification n'y figure. Le `ledger.jsonl` privé embarque la même
sortie brute dans son événement `RAW_RECEIVED` et relève de la même règle.

Seul `public/raw-error.redacted.json` est publiable. Cette dérivation conserve
les empreintes du fichier et de la sortie d'origine, retire uniquement le champ
`user_id` et garde l'erreur transport utile au diagnostic. Le rapport Q1 et les
empreintes de la preuve privée restent inchangés.

Une branche ou une pull request publique doit être construite sans le chemin
`raw/` original ni `ledger.jsonl` dans son historique Git. Une suppression dans
un commit ultérieur ne suffit pas, car l'identifiant resterait accessible dans
les commits parents.
