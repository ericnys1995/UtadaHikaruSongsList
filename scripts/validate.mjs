import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = ["index.html", "styles.css", "app.js", ".nojekyll"];
await Promise.all(requiredFiles.map((file) => access(path.join(projectRoot, file))));

const html = await readFile(path.join(projectRoot, "index.html"), "utf8");
const requiredIds = [
  "as-of",
  "group-total",
  "record-total",
  "review-total",
  "search-input",
  "clear-search",
  "artist-select",
  "result-count",
  "loading-state",
  "table-frame",
  "song-rows",
  "empty-state",
  "reset-filters",
  "error-state",
  "error-message",
  "retry-load",
  "selection-dock",
  "selected-count",
  "clear-selection",
  "copy-selection",
  "export-selection",
  "toast",
];

for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) throw new Error(`index.html is missing #${id}`);
}
if (!html.includes('href="./styles.css?') || !html.includes('src="./app.js?')) {
  throw new Error("index.html is missing a relative CSS or JavaScript entrypoint");
}

const dataRoot = path.join(projectRoot, "data");
const pool = JSON.parse(await readFile(path.join(dataRoot, "utada-hikaru-quiz-pool.base.json"), "utf8"));
const releases = JSON.parse(await readFile(path.join(dataRoot, "utada-hikaru-releases.raw.json"), "utf8"));

if (typeof pool.asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(pool.asOf)) {
  throw new Error("pool asOf must use YYYY-MM-DD format");
}
if (!Array.isArray(pool.pool) || pool.pool.length === 0) throw new Error("pool must be a non-empty array");
if (!Array.isArray(releases.main) || releases.main.length === 0) throw new Error("raw main must be a non-empty array");

const creditMap = new Map();
releases.main.forEach((release) => {
  if (typeof release?.artist !== "string" || !Array.isArray(release?.songs)) return;
  release.songs.forEach((song) => {
    if (typeof song === "string" && !creditMap.has(song)) creditMap.set(song, release.artist);
  });
});

const groupTitles = new Set();
const recordTitles = new Set();
const artists = new Set();
let recordTotal = 0;
let reviewTotal = 0;
let reviewGroupTotal = 0;

pool.pool.forEach((group, index) => {
  if (typeof group?.title !== "string" || !group.title.trim()) {
    throw new Error(`Group ${index + 1} has no valid title`);
  }
  if (groupTitles.has(group.title)) throw new Error(`Duplicate group title: ${group.title}`);
  if (!Array.isArray(group.includes) || group.includes.length === 0) {
    throw new Error(`Group ${group.title} has no includes`);
  }

  const reviewRecords = group.includes.length > 1
    ? group.includes.filter((title) => title !== group.title)
    : [];
  if (reviewRecords.length > 0) reviewGroupTotal += 1;
  reviewTotal += reviewRecords.length;

  group.includes.forEach((title) => {
    if (typeof title !== "string" || !title.trim()) throw new Error(`Invalid title in ${group.title}`);
    if (/(?:live\s+version|from\s+the\s+first\s+take)/i.test(title)) {
      throw new Error(`Live performance must be excluded from the review pool: ${title}`);
    }
    if (recordTitles.has(title)) throw new Error(`Record appears in more than one group: ${title}`);
    if (!creditMap.has(title)) throw new Error(`No artist credit found for: ${title}`);
    recordTitles.add(title);
    artists.add(creditMap.get(title));
    recordTotal += 1;
  });
  groupTitles.add(group.title);
});

console.log(
  `Static review table validated: ${pool.pool.length} groups, ${recordTotal} records, ${reviewTotal} selectable records across ${reviewGroupTotal} groups, ${artists.size} artist credits, as of ${pool.asOf}.`,
);
