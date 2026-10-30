// Copies the Fluent Emoji stickers into the app: the Flat SVGs of GROUPS, the sticker list and
// Microsoft's license. Run it only to update the set (`node scripts/stickers.fluent.mjs`); what it
// writes is committed. Widen GROUPS to ship more emoji.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO = "microsoft/fluentui-emoji";
const COMMIT = "1ffb34c752ecf5d402f04cfb4b392c77f57c54bc";
const GROUPS = ["Smileys & Emotion"];
const OUT = "src/modules/sticker/packs/fluent";
const CONCURRENCY = 24;

const raw = (path) =>
  `https://raw.githubusercontent.com/${REPO}/${COMMIT}/${path.split("/").map(encodeURIComponent).join("/")}`;

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response;
}

/** Runs `task` over `items`, a few at a time, keeping their order. */
async function mapLimited(items, task) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

const label = (name) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const tree = await (
  await get(`https://api.github.com/repos/${REPO}/git/trees/${COMMIT}?recursive=1`)
).json();
const paths = tree.tree.map((entry) => entry.path);
const folders = paths
  .filter((path) => /^assets\/[^/]+\/metadata\.json$/.test(path))
  .map((path) => path.split("/")[1]);

const emoji = await mapLimited(folders, async (folder) => {
  const metadata = await (await get(raw(`assets/${folder}/metadata.json`))).json();
  return { folder, metadata };
});
const kept = emoji.filter(({ metadata }) => GROUPS.includes(metadata.group));

await rm(join(OUT, "art"), { recursive: true, force: true });
await mkdir(join(OUT, "art"), { recursive: true });

const list = await mapLimited(kept, async ({ folder, metadata }) => {
  const svg = paths.find((path) => path.startsWith(`assets/${folder}/Flat/`));
  if (!svg) throw new Error(`No Flat art for ${folder}`);
  const id = folder
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  await writeFile(join(OUT, "art", `${id}.svg`), await (await get(raw(svg))).text());
  return { id, label: label(metadata.cldr ?? folder), keywords: metadata.keywords ?? [] };
});

list.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(join(OUT, "fluent.list.json"), `${JSON.stringify(list, null, 2)}\n`);
await writeFile(join(OUT, "LICENSE"), await (await get(raw("LICENSE"))).text());
console.log(`${list.length} stickers from ${folders.length} emoji`);
