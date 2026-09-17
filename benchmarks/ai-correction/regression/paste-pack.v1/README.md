# Paquet à coller — V4.5-210, passe 1 (exploratoire)

Les 106 cartes de la relecture à l'aveugle, en texte, par lots de 10,
avec la consigne qui va avec. À coller tel quel dans une IA de discussion.

## Comment faire passer le test à un modèle

1. Une conversation neuve par lot. Ne pas enchaîner deux lots dans la même
   conversation : le modèle se souviendrait du précédent.
2. Coller le contenu complet d'un fichier `batch-NN.txt`, sans rien ajouter
   avant ni après, sans consigne personnelle.
3. Garder la première réponse. Ne pas relancer, ne pas demander de corriger,
   ne pas discuter. Si le modèle ne respecte pas le format, garder quand même
   sa réponse telle quelle.
4. Enregistrer la réponse mot pour mot dans
   `answers/<modele>/batch-NN.txt`, un dossier par modèle, avec à côté un
   fichier `answers/<modele>/RUN.md` qui note : le nom exact du modèle et sa
   version si l'interface l'affiche, l'interface utilisée (site, application),
   la date, et tout réglage visible.

## Ce que ça vaut

C'est un format exploratoire. Une interface de discussion peut ajouter ses
propres instructions, changer de réglages sans le dire, et rien n'est
rejouable. Les réponses recueillies ainsi sont rapportées à part de la mesure
officielle, qui passe par l'accès direct aux modèles, avec réglages
enregistrés et trois répétitions.

## Empreintes

Paquet de cartes : `sha256:b3a021bfe81bd6c26690f6ebc79d754750d3db4e7821af51380a9853c28a9879`. Questions : `sha256:6b25f4e95aaaf6751b8215da638dc855d289965b493c8db694dfc482c1a480df`.
Chaque lot a son empreinte dans `manifest.json` : un lot modifié ne sera pas
accepté à la comparaison.
