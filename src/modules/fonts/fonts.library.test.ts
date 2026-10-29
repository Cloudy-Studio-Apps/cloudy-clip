import { describe, expect, it, vi } from "vitest";
import { createFontsLibrary } from "./fonts.library";
import type { FontFamily, FontRequest, FontService } from "./fonts.types";

const google: FontFamily[] = [
  { family: "Roboto", source: "google", variants: [{ weight: "400", style: "normal" }] },
  { family: "Arial", source: "google", variants: [{ weight: "400", style: "normal" }] },
];

function fakeService(overrides: Partial<FontService> = {}): FontService {
  return {
    installed: vi.fn(async () => [
      { family: "Arial", weight: 400, italic: false },
      { family: "Arial", weight: 700, italic: false },
      { family: "Arial", weight: 450, italic: true },
    ]),
    googleCatalog: vi.fn(async () => google),
    loadGoogleFace: vi.fn(async () => true),
    loadByName: vi.fn(async () => true),
    ...overrides,
  };
}

const req = (family: string, source: FontRequest["source"]): FontRequest => ({
  family,
  source,
  weight: "400",
  style: "normal",
});

describe("fonts library", () => {
  it("merges bundled, installed, google and reads the service once", async () => {
    const service = fakeService();
    const lib = createFontsLibrary(service);
    const a = await lib.families();
    await lib.families();
    expect(a.map((f) => `${f.family}:${f.source}`)).toEqual([
      "Inter:bundled",
      "JetBrains Mono:bundled",
      "Arial:installed",
      "Roboto:google",
    ]);
    expect(service.installed).toHaveBeenCalledTimes(1);
    expect(service.googleCatalog).toHaveBeenCalledTimes(1);
  });

  it("groups installed faces with nearest weights", async () => {
    const arial = (await createFontsLibrary(fakeService()).families()).find(
      (f) => f.family === "Arial",
    );
    expect(arial?.variants).toEqual([
      { weight: "400", style: "normal" },
      { weight: "700", style: "normal" },
      { weight: "500", style: "italic" },
    ]);
  });

  it("loads a request once", async () => {
    const service = fakeService();
    const lib = createFontsLibrary(service);
    await lib.load(req("Roboto", "google"));
    await lib.load(req("Roboto", "google"));
    expect(service.loadGoogleFace).toHaveBeenCalledTimes(1);
  });

  it("uses loadByName for bundled and installed, loadGoogleFace for google", async () => {
    const service = fakeService();
    const lib = createFontsLibrary(service);
    await lib.load(req("Inter", "bundled"));
    await lib.load(req("Arial", "installed"));
    await lib.load(req("Roboto", "google"));
    expect(service.loadByName).toHaveBeenCalledTimes(2);
    expect(service.loadByName).toHaveBeenCalledWith(
      expect.objectContaining({ family: "Inter Variable" }),
    );
    expect(service.loadGoogleFace).toHaveBeenCalledTimes(1);
  });

  it("ensure returns false, notifies, then reports loaded", async () => {
    const lib = createFontsLibrary(fakeService());
    const r = req("Roboto", "google");
    const listener = vi.fn();
    lib.onLoaded(listener);
    expect(lib.status(r)).toBeUndefined();
    expect(lib.ensure(r)).toBe(false);
    expect(lib.status(r)).toBe("loading");
    await lib.load(r);
    expect(listener).toHaveBeenCalledWith(r);
    expect(lib.status(r)).toBe("loaded");
    expect(lib.ensure(r)).toBe(true);
  });

  it("marks a rejected or false load missing without throwing", async () => {
    for (const fail of [
      async () => {
        throw new Error("net");
      },
      async () => false,
    ]) {
      const lib = createFontsLibrary(fakeService({ loadGoogleFace: fail }));
      const listener = vi.fn();
      lib.onLoaded(listener);
      const r = req("Roboto", "google");
      expect(await lib.load(r)).toBe(false);
      expect(lib.status(r)).toBe("missing");
      expect(listener).toHaveBeenCalledTimes(1);
    }
  });

  it("survives an offline catalog", async () => {
    const lib = createFontsLibrary(
      fakeService({
        googleCatalog: async () => {
          throw new Error("offline");
        },
      }),
    );
    const names = (await lib.families()).map((f) => f.family);
    expect(names).toEqual(["Inter", "JetBrains Mono", "Arial"]);
  });
});
