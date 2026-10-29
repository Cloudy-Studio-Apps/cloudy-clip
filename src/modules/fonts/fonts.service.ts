import { invoke } from "@tauri-apps/api/core";
import { appDataDir, dirname, join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readFile,
  readTextFile,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
  GOOGLE_CATALOG_URL,
  GOOGLE_FALLBACK_FAMILIES,
  googleFontCssUrl,
  parseFontFaceCss,
  parseGoogleCatalog,
} from "./logic/catalog";
import type { FontFamily, FontRequest, FontService, InstalledFace } from "./fonts.types";

/** The catalog is read again after this long. */
const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CATALOG_FILE = "google/catalog.json";
/** Folder of downloaded fonts inside the app data folder. */
const FOLDER = "fonts";

async function pathOf(name: string): Promise<string> {
  return join(await appDataDir(), FOLDER, name);
}

async function readText(name: string): Promise<string | null> {
  const path = await pathOf(name);
  return (await exists(path)) ? readTextFile(path) : null;
}

async function readBytes(name: string): Promise<Uint8Array | null> {
  const path = await pathOf(name);
  return (await exists(path)) ? readFile(path) : null;
}

/** The file's path, with its folder created. */
async function prepare(name: string): Promise<string> {
  const path = await pathOf(name);
  await mkdir(await dirname(path), { recursive: true });
  return path;
}

async function getText(url: string): Promise<string> {
  const response = await tauriFetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

async function getBytes(url: string): Promise<Uint8Array> {
  const response = await tauriFetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Where a face's files are cached. */
function faceFolder(request: FontRequest): string {
  const slug = request.family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `google/${slug}/${request.weight}${request.style === "italic" ? "i" : ""}`;
}

async function readCatalog(): Promise<{ savedAt: number; families: FontFamily[] } | null> {
  try {
    const text = await readText(CATALOG_FILE);
    return text ? (JSON.parse(text) as { savedAt: number; families: FontFamily[] }) : null;
  } catch {
    return null;
  }
}

/** Creates the native and network side of fonts: installed list, Google cache, face loading. */
export function createFontService(): FontService {
  return {
    installed: () => invoke<InstalledFace[]>("fonts_system_list"),

    async googleCatalog() {
      const cached = await readCatalog();
      if (cached && Date.now() - cached.savedAt < CATALOG_MAX_AGE_MS) return cached.families;
      try {
        const families = parseGoogleCatalog(await getText(GOOGLE_CATALOG_URL));
        if (families.length > 0) {
          await writeTextFile(
            await prepare(CATALOG_FILE),
            JSON.stringify({ savedAt: Date.now(), families }),
          );
          return families;
        }
      } catch {
        // Offline or Google changed the format: the cache (or the fallback) still works.
      }
      return cached?.families ?? [...GOOGLE_FALLBACK_FAMILIES];
    },

    async loadGoogleFace(request) {
      const folder = faceFolder(request);
      let css = await readText(`${folder}/face.css`);
      if (css === null) {
        css = await getText(googleFontCssUrl(request.family, request));
        await writeTextFile(await prepare(`${folder}/face.css`), css);
      }
      const sources = parseFontFaceCss(css);
      if (sources.length === 0) return false;
      const faces = await Promise.all(
        sources.map(async (source, i) => {
          const name = `${folder}/${i}.font`;
          let data = await readBytes(name);
          if (!data) {
            data = await getBytes(source.url);
            await writeFile(await prepare(name), data);
          }
          const face = new FontFace(request.family, data as Uint8Array<ArrayBuffer>, {
            weight: request.weight,
            style: request.style,
            ...(source.unicodeRange ? { unicodeRange: source.unicodeRange } : {}),
          });
          document.fonts.add(await face.load());
          return face;
        }),
      );
      return faces.length > 0;
    },

    async loadByName(request) {
      const css = `${request.style} ${request.weight} 16px "${request.family.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      await document.fonts.load(css);
      return document.fonts.check(css);
    },
  };
}
