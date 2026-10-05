const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "assets/prompts.js"), "utf8"), context);
const data = JSON.parse(fs.readFileSync(path.join(root, "data/skills.json"), "utf8"));
context.window.resourcePrompts.indexSkills(data.sections.flatMap((section) =>
  section.groups.flatMap((group) => group.items.map((item) => ({ item, source: section.title }))),
));
const names = (text) => Array.from(context.window.resourcePrompts.references(text),
  (reference) => reference.entry.item.name,
);

test("recognizes commands, plugin aliases and repeated references", () => {
  assert.deepEqual(names("/codebase-design, /mattpocock-skills:codebase-design"),
    ["codebase-design", "codebase-design"]);
});

test("recognizes named skills in the existing prompts, including punctuation", () => {
  assert.deepEqual(names("Use ui-ux-pro-max and improve-animations."),
    ["ui-ux-pro-max", "improve-animations"]);
});

test("leaves unknown names, URLs, paths and partial names alone", () => {
  assert.deepEqual(names("/unknown-skill my-codebase-design-extra https://a.test/codebase-design file/codebase-design.js"), []);
});

test("distinguishes an ordinary English verb from a skill invocation", () => {
  assert.deepEqual(names("Should this settings panel animate at all?"), []);
  assert.deepEqual(names("Use animate then /animate"), ["animate", "animate"]);
});

test("preserves the personal prompt verbatim", () => {
  const personal = JSON.parse(fs.readFileSync(path.join(root, "data/prompts.json"), "utf8"));
  assert.equal(personal.sections[0].groups[0].items[0].text,
    "/codebase-design Take a look in the repo for shallow modules, applying the deletion test and look for candidates for deletion. ");
});

test("copies the original prompt rather than its annotated display", async () => {
  const buttons = [];
  context.document = {
    createElement(tag) {
      const element = { append() {}, setAttribute() {}, dataset: {}, events: {} };
      element.addEventListener = (event, callback) => { element.events[event] = callback; };
      if (tag === "button") buttons.push(element);
      return element;
    },
  };
  context.clearTimeout = () => {};
  context.setTimeout = () => 0;
  let copied;
  const text = "/codebase-design Keep <tags>, punctuation and trailing space. ";
  context.window.resourcePrompts.renderCard({ label: "Test", text }, "Copy", async (value) => {
    copied = value;
  });
  await buttons.find((button) => button.className === "chip prompt__copy").events.click();
  assert.equal(copied, text);
});
