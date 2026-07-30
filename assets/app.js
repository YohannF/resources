const COLLECTIONS = ["skills", "inspiration", "tools"];

const els = {
  search: document.getElementById("search"),
  filters: document.getElementById("filters"),
  count: document.getElementById("count"),
  collections: document.getElementById("collections"),
  empty: document.getElementById("empty"),
};

let active = "all";

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function renderRow(item) {
  const row = document.createElement("div");
  row.className = "row";

  const name = document.createElement("div");
  name.className = "row__name";

  if (item.url) {
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.name;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
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

  const desc = document.createElement("div");
  desc.className = "row__desc";
  desc.textContent = item.desc;

  if (item.url) {
    const host = document.createElement("span");
    host.className = "row__host";
    host.textContent = hostOf(item.url);
    desc.append(host);
  }

  row.append(name, desc);
  row.dataset.haystack = [item.name, item.desc, item.url, ...(item.tags || [])]
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

  let total = 0;

  for (const group of section.groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "group";

    if (group.label) {
      const label = document.createElement("p");
      label.className = "group__label";
      label.textContent = group.label;
      groupEl.append(label);
    }

    for (const item of group.items) {
      groupEl.append(renderRow(item));
      total += 1;
    }

    el.append(groupEl);
  }

  el.dataset.total = String(total);
  return el;
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

  els.count.textContent = `${visible} résultat${visible > 1 ? "s" : ""}`;
  els.empty.hidden = visible > 0;
}

function renderFilters(labels) {
  const entries = [["all", "Tout"], ...COLLECTIONS.map((id) => [id, labels[id]])];

  for (const [id, label] of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(id === active));

    button.addEventListener("click", () => {
      active = id;
      for (const sibling of els.filters.children) {
        sibling.setAttribute("aria-pressed", String(sibling === button));
      }
      applyFilter();
    });

    els.filters.append(button);
  }
}

async function boot() {
  const loaded = await Promise.all(
    COLLECTIONS.map((id) => fetch(`data/${id}.json`).then((res) => res.json())),
  );

  const labels = {};

  for (const collection of loaded) {
    labels[collection.id] = collection.label;
    for (const section of collection.sections) {
      els.collections.append(renderSection(section, collection.id));
    }
  }

  renderFilters(labels);
  applyFilter();
}

els.search.addEventListener("input", applyFilter);

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== els.search) {
    event.preventDefault();
    els.search.focus();
  }
  if (event.key === "Escape" && document.activeElement === els.search) {
    els.search.value = "";
    applyFilter();
  }
});

boot().catch((error) => {
  els.empty.hidden = false;
  els.empty.textContent =
    "Impossible de charger les données. En local, servir le dossier : python3 -m http.server";
  console.error(error);
});
