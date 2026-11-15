import { createStore } from "zustand/vanilla";
import { BUILTIN_LUT_PREFIX, type ProjectApi } from "@/modules/project";
import { readLut } from "./tint.service";
import type { LutFile, LutFiles } from "./tint.types";

/**
 * The project's LUT files in this kernel, by path: every LUT in the document is read as soon as it
 * is there (an opened project, an import, a relink to a new path), parsed once and kept. `loaded`
 * runs after each read that worked (redraw the preview); `missing` after each that didn't, with
 * the file's name. Returns the files and the stop function.
 */
export function createLutFiles(
  project: ProjectApi,
  loaded: () => void,
  missing: () => void,
): { files: LutFiles; stop: () => void } {
  const store = createStore<Record<string, LutFile>>(() => ({}));
  const set = (path: string, file: LutFile) =>
    store.setState((files) => ({ ...files, [path]: file }));
  // shortcut: a path is read once per kernel; a file put back at the same path needs a relink or reopen.
  const files: LutFiles = {
    store,
    file({ path }) {
      const known = store.getState()[path];
      if (known) return known;
      set(path, { status: "loading" });
      readLut(path).then(
        (lut) => {
          set(path, { status: "ready", lut });
          loaded();
        },
        (error: { message?: string }) => {
          set(path, { status: "missing", message: error.message ?? String(error) });
          missing();
        },
      );
      return store.getState()[path]!;
    },
    put(path, lut) {
      set(path, { status: "ready", lut });
    },
    ready: (state) => (id) => {
      const lut = id.startsWith(BUILTIN_LUT_PREFIX) ? undefined : state.luts?.[id];
      const file = lut ? files.file(lut) : null;
      return file?.status === "ready" ? file.lut : null;
    },
  };
  const readAll = () => {
    for (const lut of Object.values(project.store.getState().luts ?? {})) {
      if (!lut.id.startsWith(BUILTIN_LUT_PREFIX)) files.file(lut);
    }
  };
  readAll();
  const stop = project.store.subscribe((next, before) => {
    if (next.luts !== before.luts) readAll();
  });
  return { files, stop };
}
