import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = ["index.html", "styles.css", "app.js", ".nojekyll"];

await Promise.all(requiredFiles.map((file) => access(path.join(projectRoot, file))));

const html = await readFile(path.join(projectRoot, "index.html"), "utf8");
const requiredElementIds = [
  "as-of",
  "group-total",
  "version-total",
  "multi-total",
  "single-total",
  "search-input",
  "clear-search",
  "sort-select",
  "expand-all",
  "collapse-all",
  "result-count",
  "loading-state",
  "card-grid",
  "empty-state",
  "reset-filters",
  "error-state",
  "error-message",
  "retry-load",
  "toast",
];

for (const id of requiredElementIds) {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`index.html is missing #${id}`);
  }
}
if (!html.includes('href="./styles.css"') || !html.includes('src="./app.js"')) {
  throw new Error("index.html is missing a relative CSS or JavaScript entrypoint");
}

const dataPath = path.join(projectRoot, "data", "utada-hikaru-quiz-pool.base.json");
const payload = JSON.parse(await readFile(dataPath, "utf8"));

if (typeof payload.asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.asOf)) {
  throw new Error("asOf must use YYYY-MM-DD format");
}
if (!Array.isArray(payload.pool) || payload.pool.length === 0) {
  throw new Error("pool must be a non-empty array");
}

const groupTitles = new Set();
const versionTitles = new Set();
let versionTotal = 0;
let multiTotal = 0;

payload.pool.forEach((group, index) => {
  if (typeof group?.title !== "string" || !group.title.trim()) {
    throw new Error(`Group ${index + 1} has no valid title`);
  }
  if (groupTitles.has(group.title)) {
    throw new Error(`Duplicate group title: ${group.title}`);
  }
  if (!Array.isArray(group.includes) || group.includes.length === 0) {
    throw new Error(`Group ${group.title} has no includes`);
  }
  if (group.includes.some((title) => typeof title !== "string" || !title.trim())) {
    throw new Error(`Group ${group.title} contains an invalid version title`);
  }
  if (new Set(group.includes).size !== group.includes.length) {
    throw new Error(`Group ${group.title} contains duplicate version titles`);
  }
  for (const versionTitle of group.includes) {
    if (versionTitles.has(versionTitle)) {
      throw new Error(`Version title appears in more than one group: ${versionTitle}`);
    }
    versionTitles.add(versionTitle);
  }

  groupTitles.add(group.title);
  versionTotal += group.includes.length;
  if (group.includes.length > 1) multiTotal += 1;
});

console.log(
  `Static showroom validated: ${payload.pool.length} groups, ${versionTotal} titles, ${multiTotal} multi-version groups, as of ${payload.asOf}.`,
);
