const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function collectFamily(section) {
  const nodes = [];
  for (const group of section.groups) {
    for (const item of group.items) nodes.push(item.name);
  }
  const known = new Set(nodes);
  const edges = [];
  for (const group of section.groups) {
    for (const item of group.items) {
      for (const target of item.invokes || []) {
        if (known.has(target)) edges.push([item.name, target]);
      }
    }
  }
  const linked = new Set(edges.flat());
  return { nodes: nodes.filter((n) => linked.has(n)), edges, isolated: nodes.length - linked.size };
}

function degrees(nodes, edges) {
  const out = Object.fromEntries(nodes.map((n) => [n, 0]));
  for (const [from] of edges) out[from] += 1;
  return out;
}

function buildDiagram(section) {
  const { nodes, edges, isolated } = collectFamily(section);
  if (!nodes.length) return null;

  const out = degrees(nodes, edges);
  const hub = nodes.reduce((a, b) => (out[b] > out[a] ? b : a), nodes[0]);
  // Le hub au centre quand il rayonne vers plus de la moitié du graphe.
  const radial = out[hub] > nodes.length / 2;
  const ring = radial ? nodes.filter((n) => n !== hub) : nodes;

  const radius = Math.max(96, ring.length * 9.5);
  const pad = 150;
  const size = (radius + pad) * 2;
  const angle = (i) => (i / ring.length) * Math.PI * 2 - Math.PI / 2;
  const pos = {};
  ring.forEach((name, i) => {
    const a = angle(i);
    pos[name] = { x: Math.cos(a) * radius, y: Math.sin(a) * radius, a };
  });
  if (radial) pos[hub] = { x: 0, y: 0, a: 0 };

  const svg = el("svg", {
    viewBox: `${-size / 2} ${-size / 2} ${size} ${size}`,
    class: "graph__svg",
    role: "img",
    "aria-label": `${nodes.length} skills liées, ${edges.length} dépendances`,
  });

  const edgeLayer = el("g", { class: "graph__edges" });
  const nodeLayer = el("g", { class: "graph__nodes" });

  for (const [from, to] of edges) {
    const a = pos[from];
    const b = pos[to];
    if (!a || !b) continue;
    const curve = radial && (from === hub || to === hub) ? 0 : 0.42;
    const path = el("path", {
      d: `M ${a.x} ${a.y} Q ${(a.x + b.x) * curve} ${(a.y + b.y) * curve} ${b.x} ${b.y}`,
      class: "graph__edge",
      "data-from": from,
      "data-to": to,
    });
    edgeLayer.append(path);
  }

  for (const name of nodes) {
    const p = pos[name];
    const isHub = radial && name === hub;
    const g = el("g", { class: "graph__node", "data-name": name, tabindex: "0" });
    if (isHub) g.setAttribute("data-hub", "");

    g.append(el("circle", { cx: p.x, cy: p.y, r: isHub ? 5 : 3, class: "graph__dot" }));

    const right = p.x >= -0.5;
    const label = el("text", {
      x: p.x + (isHub ? 0 : right ? 9 : -9),
      y: p.y + (isHub ? -12 : 0),
      class: "graph__label",
      "text-anchor": isHub ? "middle" : right ? "start" : "end",
      "dominant-baseline": "middle",
    });
    label.textContent = name;
    g.append(label);

    const hit = el("circle", { cx: p.x, cy: p.y, r: 14, class: "graph__hit" });
    g.append(hit);
    nodeLayer.append(g);
  }

  svg.append(edgeLayer, nodeLayer);
  return { svg, nodes, edges, isolated, hub: radial ? hub : null };
}

function wire(svg) {
  const clear = () => svg.removeAttribute("data-focused");
  const focus = (name) => {
    svg.setAttribute("data-focused", "");
    for (const p of svg.querySelectorAll(".graph__edge")) {
      const on = p.dataset.from === name || p.dataset.to === name;
      p.classList.toggle("is-on", on);
    }
    const neighbours = new Set([name]);
    for (const p of svg.querySelectorAll(".graph__edge.is-on")) {
      neighbours.add(p.dataset.from);
      neighbours.add(p.dataset.to);
    }
    for (const n of svg.querySelectorAll(".graph__node")) {
      n.classList.toggle("is-on", neighbours.has(n.dataset.name));
    }
  };

  for (const node of svg.querySelectorAll(".graph__node")) {
    node.addEventListener("pointerenter", () => focus(node.dataset.name));
    node.addEventListener("focus", () => focus(node.dataset.name));
    node.addEventListener("pointerleave", clear);
    node.addEventListener("blur", clear);
  }
}

function renderGraphs(sections, mount) {
  let totalEdges = 0;

  for (const section of sections) {
    const built = buildDiagram(section);
    if (!built) continue;
    totalEdges += built.edges.length;

    const figure = document.createElement("figure");
    figure.className = built.nodes.length > 12 ? "graph graph--wide" : "graph";

    const caption = document.createElement("figcaption");
    caption.className = "graph__caption";

    const title = document.createElement("h3");
    title.className = "graph__title";
    title.textContent = section.title;

    const meta = document.createElement("p");
    meta.className = "graph__meta";
    meta.textContent = built.hub
      ? `${built.edges.length} liens · ${built.hub} au centre · ${built.isolated} sans lien`
      : `${built.edges.length} liens · ${built.isolated} sans lien`;

    caption.append(title, meta);
    figure.append(caption, built.svg);
    mount.append(figure);
    wire(built.svg);
  }

  return totalEdges;
}

window.renderGraphs = renderGraphs;
