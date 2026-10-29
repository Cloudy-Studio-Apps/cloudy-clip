import { deepEqual, isPlainObject, mergeProps } from "@/modules/element";
import type { PropsLive, PropsLiveDeps } from "../inspector.types";

/** Whether applying `patch` would change any of the `resolved` values (groups field by field). */
export function livePatchChanged(
  resolved: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  return Object.entries(patch).some(([key, value]) => {
    const current = resolved[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      return Object.entries(value).some(([inner, v]) => !deepEqual(v, current[inner]));
    }
    return !deepEqual(value, current);
  });
}

/**
 * Live editing of one clip's values: inputs only redraw the preview; a commit sends one command
 * with everything input so far (none when nothing changes) and then clears the preview.
 * `dispose` clears it without committing (the clip was deleted or deselected mid-drag).
 */
export function createPropsLive(deps: PropsLiveDeps): PropsLive & { dispose(): void } {
  let pending: Record<string, unknown> = {};
  const clear = () => {
    pending = {};
    deps.preview(null);
  };
  return {
    input(patch) {
      pending = mergeProps(pending, patch);
      deps.preview(pending);
    },
    commit(patch) {
      const all = mergeProps(pending, patch);
      const now = deps.read();
      if (!now || !livePatchChanged(now, all)) return clear();
      void deps.commit(all).then(clear);
    },
    dispose: clear,
  };
}
