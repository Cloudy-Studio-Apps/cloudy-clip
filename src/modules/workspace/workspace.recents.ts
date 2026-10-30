import { createLogger, notify } from "@/core";
import { createStore } from "zustand/vanilla";
import { existing, readRecents, writeRecents } from "./workspace.service";
import type { Recents, RecentProject, RecentsState } from "./workspace.types";

const log = createLogger("workspace.recents");

/** Creates the recent list of one kernel. */
export function createRecents(): Recents {
  const store = createStore<RecentsState>(() => ({ items: [], gone: [] }));
  let writes: Promise<void> = Promise.resolve();

  /** Changes the list and queues saving it, so writes land in order. */
  function change(update: (items: RecentProject[]) => RecentProject[]): void {
    const items = update(store.getState().items);
    store.setState({ items });
    writes = writes
      .then(() => writeRecents(JSON.stringify(items)))
      .catch((error: unknown) => log.warn("Could not save the recent list", error));
  }

  return {
    store,
    async load() {
      try {
        const text = await readRecents();
        if (text) store.setState({ items: JSON.parse(text) as RecentProject[] });
      } catch (error) {
        log.warn("Could not read the recent list", error);
        notify("error", "Your recent projects could not be read.");
      }
    },
    touch(project) {
      change((items) => {
        const row = items.find(({ path }) => path === project.path);
        return [{ ...row, ...project }, ...items.filter((item) => item !== row)];
      });
    },
    setThumbnail(path, thumbnail) {
      change((items) => items.map((item) => (item.path === path ? { ...item, thumbnail } : item)));
    },
    rename(from, to, name) {
      change((items) =>
        items.map((item) => (item.path === from ? { ...item, path: to, name } : item)),
      );
    },
    remove(path) {
      change((items) => items.filter((item) => item.path !== path));
    },
    async refresh() {
      const paths = store.getState().items.map(({ path }) => path);
      const found = await existing(paths);
      store.setState({ gone: paths.filter((_, index) => !found[index]) });
    },
  };
}
