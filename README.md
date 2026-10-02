# Ressources

Index personnel — skills installées, sites d'inspiration front-end, outils du quotidien.
Une page statique, aucun build, aucune dépendance.

## Ajouter une ressource

Une entrée dans le bon fichier de `data/`, puis commit.

```json
{
  "name": "Nom de la ressource",
  "url": "https://exemple.com",
  "tags": ["gallerie", "motion"],
  "desc": "Une phrase : ce que c'est et quand tu y retournes.",
  "state": "nouveau"
}
```

`url`, `tags` et `state` sont optionnels. `state` accepte `deprecated` (chip caution) ou n'importe
quel autre libellé court (chip neutre). `tags` n'est pas affiché mais alimente la recherche.

Une skill peut aussi proposer des prompts prêts à copier :

```json
{
  "name": "find-animation-opportunities",
  "prompts": [
    {
      "label": "Vue ciblée + contexte",
      "text": "Find animation opportunities in the checkout flow."
    }
  ]
}
```

`label` décrit le cas d'usage dans l'interface ; `text` est copié tel quel. Le libellé et le
contenu alimentent aussi la recherche.

La recherche couvre le nom, la description, la source, le groupe, la catégorie et les prompts.
Elle ignore la casse, les accents et la ponctuation : `/find-animation-opportunities` et
`find animation opportunities` produisent le même résultat.

La structure d'un fichier est `collection → sections → groups → items`. Un nouveau groupe se crée
en ajoutant un objet `{ "label": "...", "items": [] }`.

## Développement local

`fetch` échoue en `file://`, il faut servir le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Déploiement

GitHub Pages, branche `main`, dossier racine — Settings → Pages → Source: Deploy from a branch.
Aucune étape de build.

## Design

Le langage visuel est le graphite : tokens `--n-*`, contrat `.surface`, Orbitron en display /
Barlow en chrome / JetBrains Mono pour la donnée.

Deux règles à ne pas casser :

- **Pas d'accent de marque.** L'état actif se lit en `--n-raise-2` + promotion du texte. Les seules
  couleurs admises sont `--n-caution` et `--n-limit`, et seulement pour du sémantique.
- **`font-smoothing: auto`.** Jamais `antialiased` / `grayscale` : sur un écran 1×, ça amincit les
  fûts de Barlow jusqu'à les rendre cassants.
