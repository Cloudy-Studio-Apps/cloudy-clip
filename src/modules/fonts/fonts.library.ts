import { createLogger, type Logger } from "@/core";
import { bundledCssFamily } from "@/modules/project";
import type { StoreApi } from "zustand/vanilla";
import { createFontsState } from "./fonts.store";
import { BUNDLED_FAMILIES } from "./logic/catalog";
import { fontKey, mergeFamilies, nearestWeight, sortVariants } from "./logic/variants";
import type {
  FontFamily,
  FontRequest,
  FontService,
  FontStatusState,
  FontsApi,
  InstalledFace,
} from "./fonts.types";

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
  log: Logger = createLogger("fonts"),
): FontsApi {
  let families: Promise<FontFamily[]> | null = null;
  let known: FontFamily[] | undefined;
  const loads = new Map<string, Promise<boolean>>();
  const listeners = new Set<(request: FontRequest) => void>();

  const setStatus = (request: FontRequest, status: "loaded" | "loading" | "missing") =>
    state.setState((s) => ({ statuses: { ...s.statuses, [fontKey(request)]: status } }));

  const run = async (request: FontRequest): Promise<boolean> => {
    try {
      if (request.source === "google") return await service.loadGoogleFace(request);
      const family =
        request.source === "bundled" ? bundledCssFamily(request.family) : request.family;
      return await service.loadByName({ ...request, family });
    } catch (error) {
      log.warn(
        `Font "${request.family}" (${request.weight}) failed to load`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  };

  const api: FontsApi = {
    families() {
      families ??= Promise.all([
        service.installed().then(groupInstalled, () => []),
        service.googleCatalog().catch(() => []),
      ]).then(([installed, google]) => {
        known = mergeFamilies(BUNDLED_FAMILIES, installed, google);
        return known;
      });
      return families;
    },
    knownFamilies() {
      return known;
    },
    load(request) {
      const key = fontKey(request);
      let load = loads.get(key);
      if (!load) {
        setStatus(request, "loading");
        load = run(request).then((ok) => {
          setStatus(request, ok ? "loaded" : "missing");
          // A failure is not cached: a later `load` tries again.
          if (!ok) loads.delete(key);
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
