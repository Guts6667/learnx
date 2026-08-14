# Protocole Gemini chercheur de preuves 1.3.0

Statut au 14 août 2026 :
`OFFLINE_READY / FINANCE_ARBITRATED / OWNER_AUTHORIZATION_REQUIRED`.

Ce protocole est une nouvelle identité expérimentale. Il ne réutilise pas le
résultat 1.2.0 comme mesure de qualité et n'autorise ni appel fournisseur, ni
panel 10×2, ni holdout, ni activation produit.

## Décision de contrat

Le modèle ne propose plus d'offsets. Pour chaque élément de la rubrique, il
retourne uniquement un statut, une confiance, des contradictions et une liste
d'extraits exacts `evidenceQuotes` issus de `responseText`.

LearnX résout chaque extrait de façon déterministe et fail-closed :

- une occurrence byte-identique unique est acceptée ;
- aucune occurrence produit `INVALID_QUOTE_NOT_FOUND` ;
- plusieurs occurrences produisent `INVALID_QUOTE_NON_UNIQUE` ;
- aucune normalisation Unicode, approximation, correction typographique ou
  reconstruction sémantique n'est autorisée.

Les offsets dérivés utilisent la sémantique JavaScript
`responseText.slice(start, end)`. Le certificat conserve les offsets et le
SHA-256 de cette tranche exacte. Les contrôles de cardinalité, propriété,
injection, canari et segment légitime s'appliquent ensuite sans changement.

## Observabilité bloquante

Pour l'identité 1.3.0, le runner refuse tout dispatch si aucun port de
persistance du raw n'est fourni. Après réception fournisseur et avant la
validation sémantique, il écrit un reçu séparé contenant :

- le raw structuré borné à 20 000 caractères et son SHA-256 ;
- l'indication de troncature et la redaction du canari exact ;
- l'identité modèle/route, le request id, l'usage et le coût lorsqu'ils existent ;
- l'empreinte de campagne, le cas, la clé d'idempotence et l'horodatage UTC.

Un échec de cette persistance arrête la campagne avec
`RAW_MODEL_OUTPUT_PERSISTENCE_FAILED`. Une sortie syntaxiquement reçue mais
rejetée reste ainsi diagnostiquable sans être réparée ni publiée.

## Identité préenregistrée

- campagne :
  `benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-smoke.v1.3.json` ;
- SHA-256 campagne :
  `8694b09458a572687c9846292424bfa694b790a94076271739036553fc370087` ;
- prompt/protocole : `1.3.0` ;
- empreinte prompt :
  `494dc302dc6de4785937ee27da3050042ba6585d87577be81cd705b03afbc5fc` ;
- modèle : `google/gemini-3.6-flash-20260721` ;
- route unique : `google-vertex/global` ;
- profil transport : `evidence-researcher-1.1.0`, raisonnement `minimal` ;
- cas futur : `writing-fr-base-mastered`, une tentative, aucun retry ;
- coût pessimiste par tentative : `0,0172545 USD` ;
- plafond proposé : `0,0200000 USD`.

Finance & Pricing a arbitré cette enveloppe le 14 août 2026 pour cette seule
tentative : borne pessimiste `0,0172545 USD`, plafond dur `0,0200000 USD`, aucun
retry ni fallback. Ce plafond reste une dépense R&D, pas un prix. Le runner
reste en validation seule jusqu'à une autorisation propriétaire écrite,
distincte et postérieure à cet arbitrage.

## Preuves hors ligne

Les tests couvrent ASCII, apostrophes droites et typographiques, NFC/NFD,
emoji et paires de substitution, CRLF, NBSP, sauts de ligne, citation absente,
citation répétée, frontière d'attaque, cardinalité, reconstruction du
certificat et persistance du raw avant rejet. Le schéma interdit désormais
`start` et `end` dans la sortie modèle.

Si l'unique smoke futur est valide, une nouvelle décision sera nécessaire pour
le smoke maîtrisé + négatif + injection. Le panel 10×2 reste fermé jusque-là.
