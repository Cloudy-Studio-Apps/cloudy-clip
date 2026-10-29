import { useMemo } from "react";
import { usePropsLive } from "@/modules/inspector";
import type { Clip } from "@/modules/project";
import { clipText } from "../logic/layout";
import type { TextLive } from "../text.types";

/**
 * Live preview plus commit for a text clip, over the inspector's `usePropsLive`: drag steps only
 * redraw the preview, the release runs one `element.setProps`, so a drag is one undo step.
 */
export function useTextLive(clip: Clip): TextLive {
  const live = usePropsLive(clip);
  return useMemo<TextLive>(
    () => ({
      input: (patch) => live.input(patch),
      commit: (patch) => live.commit(patch),
      inputText: (text) => live.input({ text }),
      commitText(text) {
        // Empty or unchanged words go back to the saved ones (the field reverts).
        if (text.trim() === "" || text === clipText(clip)) {
          live.commit({ text: clipText(clip) });
          return Promise.resolve(false);
        }
        live.commit({ text });
        return Promise.resolve(true);
      },
    }),
    [live, clip],
  );
}
