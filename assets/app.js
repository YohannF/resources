const COLLECTIONS = ["skills", "inspiration", "tools"];
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

let activeCollection = "all";
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

function externalGlyph() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<path d="M6 1h9v9h-2V4.4L4.4 13 3 11.6 11.6 3H6V1Z"/><path d="M1 5h3v2H3v6h6v-1h2v3H1V5Z"/>';
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
    const card = document.createElement("article");
    card.className = "prompt";

    const head = document.createElement("div");
    head.className = "prompt__head";

    const title = document.createElement("h4");
    title.className = "prompt__title";
    title.textContent = prompt.label;

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "ghost prompt__copy";
    copy.textContent = "Copier";
    const copyLabel = `Copier le prompt ${index + 1} associé à ${skillName}`;
    copy.setAttribute("aria-label", copyLabel);

    let resetTimer;
    copy.addEventListener("click", async () => {
      clearTimeout(resetTimer);

      try {
        await copyText(prompt.text);
        copy.textContent = "Copié";
        copy.dataset.copied = "true";
        copy.setAttribute("aria-label", `Prompt ${index + 1} copié`);
      } catch {
        copy.textContent = "Échec";
        copy.dataset.error = "true";
        copy.setAttribute("aria-label", `Échec de la copie du prompt ${index + 1}`);
      }

      resetTimer = setTimeout(() => {
        copy.textContent = "Copier";
        copy.setAttribute("aria-label", copyLabel);
        delete copy.dataset.copied;
        delete copy.dataset.error;
      }, 1600);
    });

    const text = document.createElement("p");
    text.className = "prompt__text";
    text.textContent = prompt.text;

    head.append(title, copy);
    card.append(head, text);
    list.append(card);
  });

  details.append(list);
  return details;
}

function renderRow({ item, collection }) {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.collection = collection;
  row.dataset.cat = item.cat ?? "";

  const name = document.createElement("dt");
  name.className = "row__name";

  if (item.url) {
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
  desc.append(item.desc);

  if (item.invokes?.length) {
    const deps = document.createElement("span");
    deps.className = "row__deps";
    deps.append(`invoque ${item.invokes.length} skill${item.invokes.length > 1 ? "s" : ""} : `);
    deps.append(item.invokes.join(" · "));
    desc.append(deps);
  }

  if (item.url) {
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
  row.dataset.haystack = [
    item.name,
    item.desc,
    item.url,
    item.cat,
    item.invokable === false ? "manuel" : "auto",
    ...(item.tags || []),
    ...(item.invokes || []),
    ...(item.prompts || []).flatMap((prompt) => [prompt.label, prompt.text]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

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
    const graph = window.buildFamilyGraph?.(model.graphSource);
    if (graph) {
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
  const query = els.search.value.trim().toLowerCase();
  let visible = 0;

  for (const section of els.collections.children) {
    let sectionVisible = 0;

    for (const group of section.querySelectorAll(".group")) {
      let groupVisible = 0;

      for (const row of group.querySelectorAll(".row")) {
        const match =
          (activeCollection === "all" || row.dataset.collection === activeCollection) &&
          (activeCat === "all" || row.dataset.cat === activeCat) &&
          (!query || row.dataset.haystack.includes(query));
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
  for (const { item } of catalogue) {
    const cat = item.cat ?? "sans catégorie";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return [["all", "Toutes"], ...sorted.map(([cat, n]) => [cat, `${cat} ${n}`])];
}

function reset() {
  els.search.value = "";
  activeCollection = "all";
  activeCat = "all";
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
    COLLECTIONS.map((id) => fetch(`data/${id}.json`).then((res) => res.json())),
  );

  for (const collection of loaded) {
    labels[collection.id] = collection.label;

    for (const section of collection.sections) {
      const groups = section.groups.map((group) => ({
        label: group.label,
        entries: group.items.map((item) => ({ item, collection: collection.id })),
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
      activeCollection = id;
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

  buildToggleGroup(
    els.cats,
    catEntries(),
    (id) => id === activeCat,
    (id) => {
      activeCat = id;
      applyFilter();
    },
    "cat-chip",
  );

  renderCollections();
}

els.search.addEventListener("input", applyFilter);
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
