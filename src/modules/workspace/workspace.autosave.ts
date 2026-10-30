import type { Autosave, AutosaveDeps } from "./workspace.types";

/** Quiet time after a change before it's written. */
const DEBOUNCE_MS = 2000;
/** The longest a change waits while edits keep coming. */
const MAX_WAIT_MS = 30_000;

/** Writes the document after changes settle, one write at a time. */
export function createAutosave({ store, worthWriting, write, onStatus }: AutosaveDeps): Autosave {
  let saved = store.getState();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let waitingSince: number | null = null;
  let writes: Promise<boolean> = Promise.resolve(true);

  function settle(): void {
    clearTimeout(timer);
    timer = undefined;
    waitingSince = null;
  }

  async function writeNow(force: boolean): Promise<boolean> {
    const state = store.getState();
    if (!force && (state === saved || !worthWriting(state))) return true;
    onStatus("saving");
    try {
      await write(state);
      saved = state;
      onStatus("saved");
      return true;
    } catch (error) {
      onStatus("failed", error);
      return false;
    }
  }

  function enqueue(force: boolean): Promise<boolean> {
    settle();
    writes = writes.then(() => writeNow(force));
    return writes;
  }

  const stop = store.subscribe((state) => {
    if (state === saved) return;
    const now = Date.now();
    waitingSince ??= now;
    clearTimeout(timer);
    const left = MAX_WAIT_MS - (now - waitingSince);
    timer = setTimeout(() => void enqueue(false), Math.min(DEBOUNCE_MS, left));
  });

  return {
    flush: () => enqueue(false),
    save: () => enqueue(true),
    adopt(state) {
      settle();
      saved = state;
    },
    dispose() {
      settle();
      stop();
    },
  };
}
