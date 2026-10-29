import type { StoreApi } from "zustand/vanilla";
import { createFontsState, type FontStatusState } from "./fonts.store";
import { BUNDLED_FAMILIES } from "./logic/catalog";
import { fontKey, mergeFamilies, nearestWeight, sortVariants } from "./logic/variants";
import type { FontFamily, FontRequest, FontService, FontsApi, InstalledFace } from "./fonts.types";

/** Groups installed faces into families with CSS weights. */
function groupInstalled(faces: readonly InstalledFace[]): FontFamily[] {
  const byFamily = new Map<string, FontFamily>();
  for (const face of faces) {
    let family = byFamily.get(face.family);
    if (!family) {
      family = { family: face.family, source: "installed", variants: [] };
      byFamily.set(face.family, family);
    }
    family.variants.push({
      weight: nearestWeight(face.weight),
      style: face.italic ? "italic" : "normal",
    });
  }
  return [...byFamily.values()].map((f) => ({ ...f, variants: sortVariants(f.variants) }));
}

/**
 * The fonts API over a service: merged family list and once-per-face loading with statuses.
 * The service does the native and network work; this holds the logic and the per-kernel memory.
 */
export function createFontsLibrary(
  service: FontService,
  state: StoreApi<FontStatusState> = createFontsState(),
): FontsApi {
  let families: Promise<FontFamily[]> | null = null;
  const loads = new Map<string, Promise<boolean>>();
  const listeners = new Set<(request: FontRequest) => void>();

  const setStatus = (request: FontRequest, status: "loaded" | "loading" | "missing") =>
    state.setState((s) => ({ statuses: { ...s.statuses, [fontKey(request)]: status } }));

  const run = async (request: FontRequest): Promise<boolean> => {
    try {
      if (request.source === "google") return await service.loadGoogleFace(request);
      // Bundled Fontsource families are registered as "<name> Variable".
      const family = request.source === "bundled" ? `${request.family} Variable` : request.family;
      return await service.loadByName({ ...request, family });
    } catch {
      return false;
    }
  };

  const api: FontsApi = {
    families() {
      families ??= Promise.all([
        service.installed().then(groupInstalled, () => []),
        service.googleCatalog().catch(() => []),
      ]).then(([installed, google]) => mergeFamilies(BUNDLED_FAMILIES, installed, google));
      return families;
    },
    load(request) {
      const key = fontKey(request);
      let load = loads.get(key);
      if (!load) {
        setStatus(request, "loading");
        load = run(request).then((ok) => {
          setStatus(request, ok ? "loaded" : "missing");
          for (const listener of [...listeners]) listener(request);
          return ok;
        });
        loads.set(key, load);
      }
      return load;
    },
    status(request) {
      return state.getState().statuses[fontKey(request)];
    },
    ensure(request) {
      const status = api.status(request);
      if (status === "loaded") return true;
      if (status === undefined) void api.load(request);
      return false;
    },
    onLoaded(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return api;
}
