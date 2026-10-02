# Ressources

Index personnel — skills installées, prompts à copier, sites d'inspiration front-end, outils du quotidien.
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

La collection **Prompts** rassemble automatiquement les prompts associés aux skills.
Le lien direct est `#prompts`. Les filtres par catégorie suivent la collection sélectionnée.

Une skill peut proposer des prompts prêts à copier :

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

Pour ajouter un prompt indépendant, utiliser `data/prompts.json` avec la même structure
`sections → groups → items`. Une entrée contient `name`, `desc`, `cat` et `text` (texte copié
intégralement). `origin` peut préciser sa provenance.

La recherche couvre le nom, la description, la source, le groupe, la catégorie, la provenance
d’installation et le contenu des prompts.
Elle ignore la casse, les accents et la ponctuation : `/find-animation-opportunities` et
`find animation opportunities` produisent le même résultat.

La structure d'un fichier est `collection → sections → groups → items`. Un nouveau groupe se crée
en ajoutant un objet `{ "label": "...", "items": [] }`.

## Inventaire des skills

Relevé du **2 octobre 2026** : 553 entrées, regroupées par origine. Il couvre les skills
locales Codex, Claude Code, Cursor, OpenCode et Gemini, les skills partagées dans `~/.agents/skills`, les plugins
installés (y compris ceux limités à Gymeal) et les skills du projet NavBuilder. Les anciennes
versions en cache ne sont pas comptées séparément ; les copies identiques sont regroupées.
Les descriptions déjà rédigées sont conservées, les ajouts reprennent les descriptions de
leurs fichiers `SKILL.md`.

`data/skills.json` porte la date `updatedAt`. Le champ `installations` de chaque skill indique
sa plateforme, sa portée et sa commande. Les chemins absolus du Mac et le contenu des skills
ne sont pas publiés.

La famille Impeccable et `batch-grill-me` ne figuraient plus dans les emplacements inventoriés
au moment du relevé et ont été retirées de la liste des skills installées.

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
