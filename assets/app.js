const COLLECTIONS = ["skills", "inspiration", "tools"];
const ANNOUNCE_DELAY = 500;

const els = {
  search: document.getElementById("search"),
  filters: document.getElementById("filters"),
  count: document.getElementById("count"),
  collections: document.getElementById("collections"),
  empty: document.getElementById("empty"),
  emptyText: document.getElementById("empty-text"),
  emptyReset: document.getElementById("empty-reset"),
};

const labels = {};
let active = "all";
let announceTimer;

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

function renderRow(item) {
  const row = document.createElement("div");
  row.className = "row";

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

  row.append(name, desc);
  row.dataset.haystack = [
    item.name,
    item.desc,
    item.url,
    item.invokable === false ? "manuel" : "auto",
    ...(item.tags || []),
    ...(item.invokes || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return row;
}

function renderSection(section, collectionId) {
  const el = document.createElement("section");
  el.className = "section surface";
  el.dataset.collection = collectionId;

  const head = document.createElement("div");
  head.className = "section__head";

  const title = document.createElement("h2");
  title.className = "section__title";
  title.textContent = section.title;
  head.append(title);

  if (section.meta) {
    const meta = document.createElement("span");
    meta.className = "section__meta";
    meta.textContent = section.meta;
    head.append(meta);
  }

  if (section.status) {
    const status = document.createElement("span");
    status.className = "section__status";
    status.textContent = section.status;
    head.append(status);
  }

  const count = document.createElement("span");
  count.className = "section__count";
  head.append(count);
  el.append(head);

  if (section.note) {
    const note = document.createElement("p");
    note.className = "section__note";
    note.textContent = section.note;
    el.append(note);
  }

  const graph = window.buildFamilyGraph?.(section);
  if (graph) {
    const panel = document.createElement("div");
    panel.className = "graph-panel";
    panel.id = `graph-${section.family ?? collectionId}`;
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
        `${open ? "Masquer" : "Afficher"} le graphe des dépendances de ${section.title}`,
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

  let total = 0;

  for (const group of section.groups) {
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

    for (const item of group.items) {
      list.append(renderRow(item));
      total += 1;
    }

    groupEl.append(list);
    el.append(groupEl);
  }

  el.dataset.total = String(total);
  return el;
}

function describeFilter(query) {
  const scope = active === "all" ? null : labels[active];

  if (query && scope) return `Aucun résultat pour « ${query} » dans ${scope}.`;
  if (query) return `Aucun résultat pour « ${query} ».`;
  if (scope) return `Aucune ressource dans ${scope}.`;
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

  els.emptyReset.hidden = !query && active === "all";
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
    const inCollection = active === "all" || section.dataset.collection === active;
    let sectionVisible = 0;

    for (const group of section.querySelectorAll(".group")) {
      let groupVisible = 0;

      for (const row of group.querySelectorAll(".row")) {
        const match = inCollection && (!query || row.dataset.haystack.includes(query));
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

function setCollection(id, button) {
  active = id;
  for (const sibling of els.filters.children) {
    sibling.setAttribute("aria-pressed", String(sibling === button));
  }
  applyFilter();
}

function renderFilters() {
  const entries = [["all", "Tout"], ...COLLECTIONS.map((id) => [id, labels[id]])];

  for (const [id, label] of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(id === active));
    button.addEventListener("click", () => setCollection(id, button));
    els.filters.append(button);
  }
}

function reset() {
  els.search.value = "";
  setCollection("all", els.filters.firstElementChild);
  els.search.focus();
}

async function boot() {
  const loaded = await Promise.all(
    COLLECTIONS.map((id) => fetch(`data/${id}.json`).then((res) => res.json())),
  );

  for (const collection of loaded) {
    labels[collection.id] = collection.label;
    for (const section of collection.sections) {
      els.collections.append(renderSection(section, collection.id));
    }
  }

  renderFilters();
  applyFilter();
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
