const COLLECTIONS = ["skills", "prompts", "inspiration", "tools"];
const ANNOUNCE_DELAY = 500;

const els = {
  search: document.getElementById("search"),
  filters: document.getElementById("filters"),
  views: document.getElementById("views"),
  cats: document.getElementById("cats"),
  count: document.getElementById("count"),
  collections: document.getElementById("collections"),
  empty: document.getElementById("empty"),
  emptyText: document.getElementById("empty-text"),
  emptyReset: document.getElementById("empty-reset"),
};

const labels = {};
const sourceSections = [];
const catalogue = [];
const graphSelections = new Set();

let activeCollection = COLLECTIONS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "all";
let activeCat = "all";
let view = "source";
let announceTimer;

/* ------------------------------------------------------------------ rendu */

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function externalGlyph() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<path d="M6 1h9v9h-2V4.4L4.4 13 3 11.6 11.6 3H6V1Z"/><path d="M1 5h3v2H3v6h6v-1h2v3H1V5Z"/>';
  return svg;
}

function githubGlyph() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.innerHTML =
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>';
  return svg;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) throw new Error("La copie a échoué");
}

function renderPrompts(prompts, skillName) {
  const details = document.createElement("details");
  details.className = "prompts";

  const summary = document.createElement("summary");
  const label = document.createElement("span");
  label.textContent = "Prompts associés";

  const count = document.createElement("span");
  count.className = "prompts__count";
  count.textContent = String(prompts.length);
  summary.append(label, count);
  details.append(summary);

  const list = document.createElement("div");
  list.className = "prompts__list";

  prompts.forEach((prompt, index) => {
    list.append(window.resourcePrompts.renderCard(
      prompt,
      `Copier le prompt ${index + 1} associé à ${skillName}`,
      copyText,
    ));
  });

  details.append(list);
  return details;
}

function renderRow({ item, collection, source, group }) {
  const github = hostOf(item.url) === "github.com";
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.collection = collection;
  row.dataset.cat = item.cat ?? "";
  row.dataset.name = item.name;

  const name = document.createElement("dt");
  name.className = "row__name";

  if (item.url && !github) {
    const link = document.createElement("a");
    link.href = item.url;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    link.append(item.name, externalGlyph());
    link.setAttribute("aria-label", `${item.name} — ouvre un nouvel onglet`);
    name.append(link);
  } else {
    name.append(item.name);
  }

  if (item.state) {
    const chip = document.createElement("span");
    chip.className = `chip chip--${item.state === "deprecated" ? "caution" : "new"}`;
    chip.textContent = item.state === "deprecated" ? "déprécié" : item.state;
    name.append(chip);
  }

  if (item.invokable !== undefined) {
    const flag = document.createElement("span");
    flag.className = `flag flag--${item.invokable ? "auto" : "manual"}`;
    flag.textContent = item.invokable ? "auto" : "manuel";
    flag.title = item.invokable
      ? "Le modèle peut la déclencher seul"
      : "Uniquement sur invocation explicite (disable-model-invocation)";
    name.append(flag);
  }

  const desc = document.createElement("dd");
  desc.className = "row__desc";
  if (item.text) {
    row.classList.add("row--prompt");
    desc.append(window.resourcePrompts.renderCard(
      { label: item.name, text: item.text },
      `Copier le prompt ${item.name}`,
      copyText,
      false,
    ));
  } else {
    desc.append(item.desc);
  }

  if (item.when) {
    const when = document.createElement("span");
    when.className = "row__when";
    const label = document.createElement("strong");
    label.textContent = "Quand l’utiliser : ";
    when.append(label, item.when);
    desc.append(when);
  }

  if (item.invokes?.length) {
    const deps = document.createElement("span");
    deps.className = "row__deps";
    deps.append(`invoque ${item.invokes.length} skill${item.invokes.length > 1 ? "s" : ""} : `);
    deps.append(item.invokes.join(" · "));
    desc.append(deps);
  }

  if (github) {
    row.classList.add("row--github");
    const link = document.createElement("a");
    link.className = "row__github";
    link.href = item.url;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    link.append(githubGlyph());
    link.title = `GitHub de ${item.name}`;
    link.setAttribute("aria-label", `GitHub de ${item.name} — ouvre un nouvel onglet`);
    desc.append(link);
  } else if (item.url) {
    const host = document.createElement("span");
    host.className = "row__host";
    host.textContent = hostOf(item.url);
    desc.append(host);
  }

  if (item.prompts?.length) {
    row.classList.add("row--has-prompts");
    desc.append(renderPrompts(item.prompts, item.name));
  }

  row.append(name, desc);
  row.dataset.haystack = normalizeSearch(
    [
      item.name,
      item.desc,
      item.text,
      item.when,
      item.url,
      item.cat,
      source,
      group,
      labels[collection],
      item.invokable === false ? "manuel" : "auto",
      item.prompts?.length ? "prompts associés" : "",
      ...(item.tags || []),
      ...(item.invokes || []),
      ...(item.prompts || []).flatMap((prompt) => [prompt.label, prompt.text]),
    ]
      .filter(Boolean)
      .join(" "),
  );

  return row;
}

function renderSection(model) {
  const el = document.createElement("section");
  el.className = "section surface";

  const head = document.createElement("div");
  head.className = "section__head";

  const title = document.createElement("h2");
  title.className = "section__title";
  title.textContent = model.title;
  head.append(title);

  if (model.meta) {
    const meta = document.createElement("span");
    meta.className = "section__meta";
    meta.textContent = model.meta;
    head.append(meta);
  }

  if (model.status) {
    const status = document.createElement("span");
    status.className = "section__status";
    status.textContent = model.status;
    head.append(status);
  }

  const count = document.createElement("span");
  count.className = "section__count";
  head.append(count);
  el.append(head);

  if (model.note) {
    const note = document.createElement("p");
    note.className = "section__note";
    note.textContent = model.note;
    el.append(note);
  }

  if (model.graphSource) {
    const graph = window.buildFamilyGraph?.(model.graphSource, (name) => {
      el.dataset.skillFilter = name || "";
      applyFilter();
    });
    if (graph) {
      graphSelections.add(graph.clearSelection);
      const panel = document.createElement("div");
      panel.className = "graph-panel";
      panel.id = `graph-${model.graphSource.family}`;
      panel.hidden = true;
      panel.append(graph.figure);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "ghost ghost--toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", panel.id);
      toggle.append(`Graphe · ${graph.edges}`);

      const syncLabel = () => {
        const open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute(
          "aria-label",
          `${open ? "Masquer" : "Afficher"} le graphe des dépendances de ${model.title}`,
        );
      };

      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!open));
        panel.hidden = open;
        if (open) graph.clearSelection();
        syncLabel();
      });

      syncLabel();
      head.insertBefore(toggle, count);
      el.append(panel);
    }
  }

  let total = 0;

  for (const group of model.groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "group";

    if (group.label) {
      const label = document.createElement("h3");
      label.className = "group__label";
      label.textContent = group.label;
      groupEl.append(label);
    }

    const list = document.createElement("dl");
    list.className = "group__list";

    for (const entry of group.entries) {
      list.append(renderRow(entry));
      total += 1;
    }

    groupEl.append(list);
    el.append(groupEl);
  }

  el.dataset.total = String(total);
  return el;
}

/* ------------------------------------------------------------------ vues */

function bySource() {
  return sourceSections.map((s) => ({ ...s, graphSource: s.family ? s.raw : null }));
}

function byCategory() {
  const cats = new Map();

  for (const entry of catalogue) {
    const cat = entry.item.cat ?? "sans catégorie";
    if (!cats.has(cat)) cats.set(cat, new Map());
    const groups = cats.get(cat);
    if (!groups.has(entry.source)) groups.set(entry.source, []);
    groups.get(entry.source).push(entry);
  }

  return [...cats.entries()]
    .sort((a, b) => countOf(b[1]) - countOf(a[1]) || a[0].localeCompare(b[0]))
    .map(([cat, groups]) => ({
      title: cat,
      groups: [...groups.entries()].map(([label, entries]) => ({ label, entries })),
    }));
}

function countOf(groups) {
  return [...groups.values()].reduce((n, list) => n + list.length, 0);
}

function renderCollections() {
  window.resourcePrompts.hidePreview();
  graphSelections.clear();
  els.collections.textContent = "";
  const models = view === "source" ? bySource() : byCategory();
  for (const model of models) els.collections.append(renderSection(model));
  applyFilter();
}

/* ------------------------------------------------------------------ filtres */

function describeFilter(query) {
  const parts = [];
  if (activeCollection !== "all") parts.push(labels[activeCollection]);
  if (activeCat !== "all") parts.push(`catégorie ${activeCat}`);
  const scope = parts.length ? ` dans ${parts.join(" · ")}` : "";

  if (query) return `Aucun résultat pour « ${query} »${scope}.`;
  if (scope) return `Aucune ressource${scope}.`;
  return "Aucune ressource à afficher.";
}

function renderEmpty(query) {
  els.emptyText.textContent = "";
  const message = describeFilter(query);
  const quoted = query ? `« ${query} »` : null;

  if (quoted && message.includes(quoted)) {
    const [head, tail] = message.split(quoted);
    const strong = document.createElement("strong");
    strong.textContent = quoted;
    els.emptyText.append(head, strong, tail);
  } else {
    els.emptyText.textContent = message;
  }

  els.emptyReset.hidden = !query && activeCollection === "all" && activeCat === "all";
}

function announceCount(visible) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    els.count.textContent = `${visible} résultat${visible > 1 ? "s" : ""}`;
  }, ANNOUNCE_DELAY);
}

function applyFilter() {
  window.resourcePrompts.hidePreview();
  const queryTerms = normalizeSearch(els.search.value).split(" ").filter(Boolean);
  let visible = 0;

  for (const section of els.collections.children) {
    let sectionVisible = 0;
    const selectedSkill = section.dataset.skillFilter;

    for (const group of section.querySelectorAll(".group")) {
      let groupVisible = 0;

      for (const row of group.querySelectorAll(".row")) {
        const match =
          (activeCollection === "all" || row.dataset.collection === activeCollection) &&
          (selectedSkill
            ? row.dataset.name === selectedSkill
            : (activeCat === "all" || row.dataset.cat === activeCat) &&
              queryTerms.every((term) => row.dataset.haystack.includes(term)));
        row.hidden = !match;
        if (match) groupVisible += 1;
      }

      group.hidden = groupVisible === 0;
      sectionVisible += groupVisible;
    }

    const total = Number(section.dataset.total);
    section.querySelector(".section__count").textContent =
      sectionVisible === total
        ? `${total} entrée${total > 1 ? "s" : ""}`
        : `${sectionVisible} sur ${total}`;

    section.hidden = sectionVisible === 0;
    visible += sectionVisible;
  }

  announceCount(visible);
  els.empty.hidden = visible > 0;
  if (visible === 0) renderEmpty(els.search.value.trim());
}

/* ------------------------------------------------------------------ contrôles */

function buildToggleGroup(mount, entries, isActive, onPick, className = "") {
  mount.textContent = "";
  for (const [id, label] of entries) {
    const button = document.createElement("button");
    button.type = "button";
    if (className) button.className = className;
    button.textContent = label;
    button.setAttribute("aria-pressed", String(isActive(id)));
    button.addEventListener("click", () => {
      for (const sibling of mount.children) {
        sibling.setAttribute("aria-pressed", String(sibling === button));
      }
      onPick(id);
    });
    mount.append(button);
  }
}

function catEntries() {
  const counts = new Map();
  for (const { item, collection } of catalogue) {
    if (activeCollection !== "all" && collection !== activeCollection) continue;
    const cat = item.cat ?? "sans catégorie";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return [["all", "Toutes"], ...sorted.map(([cat, n]) => [cat, `${cat} ${n}`])];
}

function renderCategories() {
  els.cats.classList.toggle("cats--prompts", activeCollection === "prompts");
  const entries = catEntries();
  if (!entries.some(([id]) => id === activeCat)) activeCat = "all";
  buildToggleGroup(
    els.cats,
    entries,
    (id) => id === activeCat,
    (id) => {
      clearGraphSelections();
      activeCat = id;
      applyFilter();
    },
    "cat-chip",
  );
}

function clearGraphSelections() {
  for (const clearSelection of graphSelections) clearSelection();
}

function reset() {
  clearGraphSelections();
  els.search.value = "";
  activeCollection = "all";
  history.replaceState(null, "", location.pathname);
  activeCat = "all";
  renderCategories();
  for (const mount of [els.filters, els.cats]) {
    for (const [i, button] of [...mount.children].entries()) {
      button.setAttribute("aria-pressed", String(i === 0));
    }
  }
  applyFilter();
  els.search.focus();
}

/* ------------------------------------------------------------------ boot */

async function boot() {
  const loaded = await Promise.all(
    COLLECTIONS.map((id) => fetch(`data/${id}.json?v=20261002-prompt-retro`).then((res) => res.json())),
  );

  const existingPrompts = loaded.find((collection) => collection.id === "skills").sections
    .flatMap((section) => section.groups.flatMap((group) => group.items))
    .filter((item) => item.prompts?.length)
    .map((item) => ({
      label: item.name,
      items: item.prompts.map((prompt) => ({
        name: prompt.label,
        text: prompt.text,
        cat: item.cat,
        tags: [item.name],
      })),
    }));
  const personalPrompts = loaded.find((collection) => collection.id === "prompts").sections
    .flatMap((section) => section.groups.flatMap((group) => group.items));
  loaded.find((collection) => collection.id === "prompts").sections.push({
    title: "Prompts associés aux skills",
    groups: existingPrompts,
  });

  const skillEntries = loaded.find((collection) => collection.id === "skills").sections
    .flatMap((section) => section.groups.flatMap((group) =>
      group.items.map((item) => ({ item, source: section.title })),
    ));
  window.resourcePrompts.indexSkills(skillEntries);
  for (const prompt of personalPrompts) {
    const referencedSkills = new Set(window.resourcePrompts.references(prompt.text)
      .map((reference) => reference.entry.item));
    for (const item of referencedSkills) {
      item.prompts = [...(item.prompts || []), { label: prompt.name, text: prompt.text }];
    }
  }

  for (const collection of loaded) {
    labels[collection.id] = collection.label;

    for (const section of collection.sections) {
      const groups = section.groups.map((group) => ({
        label: group.label,
        entries: group.items.map((item) => ({
          item,
          collection: collection.id,
          source: section.title,
          group: group.label,
        })),
      }));

      for (const group of groups) {
        for (const entry of group.entries) {
          catalogue.push({ ...entry, source: section.title, group: group.label });
        }
      }

      sourceSections.push({
        title: section.title,
        meta: section.meta,
        status: section.status,
        note: section.note,
        family: section.family,
        raw: section,
        groups,
      });
    }
  }

  buildToggleGroup(
    els.filters,
    [["all", "Tout"], ...COLLECTIONS.map((id) => [id, labels[id]])],
    (id) => id === activeCollection,
    (id) => {
      clearGraphSelections();
      activeCollection = id;
      history.replaceState(null, "", id === "all" ? location.pathname : `#${id}`);
      renderCategories();
      applyFilter();
    },
  );

  buildToggleGroup(
    els.views,
    [
      ["source", "Par source"],
      ["cat", "Par catégorie"],
    ],
    (id) => id === view,
    (id) => {
      view = id;
      renderCollections();
    },
  );

  renderCategories();

  renderCollections();
}

els.search.addEventListener("input", () => {
  clearGraphSelections();
  applyFilter();
});
els.emptyReset.addEventListener("click", reset);

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== els.search) {
    event.preventDefault();
    els.search.focus();
  }
  if (event.key === "Escape" && document.activeElement === els.search) {
    reset();
  }
});

boot().catch((error) => {
  els.empty.hidden = false;
  els.emptyReset.hidden = true;
  els.emptyText.textContent =
    "Impossible de charger les données. En local, servir le dossier : python3 -m http.server";
  console.error(error);
});
