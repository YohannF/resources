(() => {
  const skills = new Map();
  let pattern;
  let preview;
  let anchor;
  let closeTimer;

  function indexSkills(entries) {
    skills.clear();
    for (const entry of entries) {
      const aliases = [entry.item.name, ...(entry.item.installations || []).map((i) => i.command)];
      for (const alias of aliases.filter(Boolean)) {
        const name = alias.replace(/^\//, "");
        if (!skills.has(name)) skills.set(name, entry);
      }
    }
    const names = [...skills.keys()]
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    pattern = names.length
      ? new RegExp(`(?<![\\p{L}\\p{N}_:/.-])/?(?:${names.join("|")})(?![\\p{L}\\p{N}_:-]|\\.[\\p{L}\\p{N}])`, "gu")
      : null;
  }

  function references(text) {
    if (!pattern) return [];
    return [...text.matchAll(pattern)].filter((match) =>
      match[0].startsWith("/") || /[-:]/.test(match[0]) ||
      /(?:\$|\b(?:use|run|invoke|skill)\s+)$/i.test(text.slice(0, match.index)),
    ).map((match) => ({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      entry: skills.get(match[0].replace(/^\//, "")),
    }));
  }

  function hidePreview() {
    clearTimeout(closeTimer);
    if (preview) preview.hidden = true;
    anchor?.removeAttribute("aria-describedby");
    anchor = null;
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (document.activeElement !== anchor) hidePreview();
    }, 120);
  }

  function showPreview(button, entry) {
    clearTimeout(closeTimer);
    if (!preview) {
      preview = document.createElement("div");
      preview.id = "skill-preview";
      preview.className = "skill-preview";
      preview.setAttribute("role", "tooltip");
      preview.addEventListener("pointerenter", () => clearTimeout(closeTimer));
      preview.addEventListener("pointerleave", scheduleClose);
      document.body.append(preview);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hidePreview();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!preview.contains(event.target) && !anchor?.contains(event.target)) hidePreview();
      });
      window.addEventListener("scroll", hidePreview, true);
      window.addEventListener("resize", hidePreview);
    }
    anchor?.removeAttribute("aria-describedby");
    anchor = button;
    button.setAttribute("aria-describedby", preview.id);
    preview.replaceChildren();
    const name = document.createElement("strong");
    name.className = "skill-preview__name";
    name.textContent = entry.item.name;
    const source = document.createElement("span");
    source.className = "skill-preview__source";
    source.textContent = entry.source;
    const desc = document.createElement("p");
    desc.textContent = entry.item.desc;
    preview.append(name, source, desc);
    if (entry.item.when) {
      const when = document.createElement("p");
      const label = document.createElement("strong");
      label.textContent = "Quand l’utiliser : ";
      when.append(label, entry.item.when);
      preview.append(when);
    }
    preview.hidden = false;
    const rect = button.getBoundingClientRect();
    const box = preview.getBoundingClientRect();
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - box.width - 12));
    const below = rect.bottom + 8;
    const top = below + box.height <= window.innerHeight - 12
      ? below
      : Math.max(12, rect.top - box.height - 8);
    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;
  }

  function appendVariables(target, value, variables = []) {
    let cursor = 0;
    for (const match of value.matchAll(/\b\d+\b/g)) {
      const variable = variables.find((item) => item.value === match[0]);
      if (!variable) continue;
      target.append(value.slice(cursor, match.index));
      const token = document.createElement("span");
      token.className = "prompt__variable";
      token.textContent = match[0];
      token.title = `${variable.label} — valeur à adapter`;
      target.append(token);
      cursor = match.index + match[0].length;
    }
    target.append(value.slice(cursor));
  }

  function renderText(value, variables) {
    const text = document.createElement("p");
    text.className = "prompt__text";
    let cursor = 0;
    for (const reference of references(value)) {
      appendVariables(text, value.slice(cursor, reference.start), variables);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "prompt__skill";
      button.textContent = reference.text;
      button.setAttribute("aria-label", `Voir la skill ${reference.entry.item.name}`);
      button.addEventListener("pointerenter", () => showPreview(button, reference.entry));
      button.addEventListener("pointerleave", scheduleClose);
      button.addEventListener("focus", () => showPreview(button, reference.entry));
      button.addEventListener("blur", hidePreview);
      button.addEventListener("click", () => showPreview(button, reference.entry));
      text.append(button);
      cursor = reference.end;
    }
    appendVariables(text, value.slice(cursor), variables);
    return text;
  }

  function renderCard(prompt, copyLabel, copyText, showTitle = true) {
    const card = document.createElement("article");
    card.className = "prompt";
    const head = document.createElement("div");
    head.className = "prompt__head";
    if (showTitle) {
      const title = document.createElement("h4");
      title.className = "prompt__title";
      title.textContent = prompt.label;
      head.append(title);
    }
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "ghost prompt__copy";
    copy.textContent = "Copier";
    copy.setAttribute("aria-label", copyLabel);
    let resetTimer;
    copy.addEventListener("click", async () => {
      clearTimeout(resetTimer);
      try {
        await copyText(prompt.text);
        copy.textContent = "Copié";
        copy.dataset.copied = "true";
        copy.setAttribute("aria-label", "Prompt copié");
      } catch {
        copy.textContent = "Échec";
        copy.dataset.error = "true";
        copy.setAttribute("aria-label", "Échec de la copie du prompt");
      }
      resetTimer = setTimeout(() => {
        copy.textContent = "Copier";
        copy.setAttribute("aria-label", copyLabel);
        delete copy.dataset.copied;
        delete copy.dataset.error;
      }, 1600);
    });
    head.append(copy);
    card.append(head, renderText(prompt.text, prompt.variables));
    return card;
  }

  window.resourcePrompts = { indexSkills, references, renderCard, hidePreview };
})();
