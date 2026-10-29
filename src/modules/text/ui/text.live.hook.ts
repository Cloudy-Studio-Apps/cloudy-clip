import { useEffect, useMemo, useRef } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  clipText,
  isTextClip,
  mergeTextStyle,
  projectRef,
  textStyleOf,
  type Clip,
  type TextStylePatch,
} from "@/modules/project";
import type { z } from "zod";
import { mergePatch } from "../logic/patch";
import type { textStylePatch } from "../text.schema";
import type { TextLive } from "../text.types";
import { setText, setTextStyle } from "../text.commands";

/**
 * Live preview plus commit for a text clip: drag steps go to `previewTextClip` only (no React
 * state), the release runs one command, so a drag is one undo step.
 */
export function useTextLive(clip: Clip): TextLive {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const id = clip.id;
  const style = useRef<TextStylePatch>({});
  const words = useRef<string | undefined>(undefined);

  const live = useMemo<TextLive>(() => {
    const show = () => {
      const hasStyle = Object.keys(style.current).length > 0;
      if (!hasStyle && words.current === undefined) return preview.previewTextClip(id, null);
      preview.previewTextClip(id, {
        ...(words.current !== undefined && { text: words.current }),
        ...(hasStyle && { style: style.current }),
      });
    };
    const current = () => {
      const state = project.getState();
      const found = state.clips[id];
      return found && isTextClip(found) ? { clip: found, format: state.format } : null;
    };
    return {
      input(patch) {
        style.current = mergePatch(style.current, patch);
        show();
      },
      commit(patch) {
        const merged = mergePatch(style.current, patch);
        const now = current();
        const changed =
          now !== null &&
          JSON.stringify(mergeTextStyle(textStyleOf(now.clip, now.format), merged)) !==
            JSON.stringify(textStyleOf(now.clip, now.format));
        const done = () => {
          style.current = {};
          show();
        };
        if (!changed) return done();
        void bus
          .run(setTextStyle, { clipIds: [id], style: merged as z.input<typeof textStylePatch> })
          .then(done);
      },
      inputText(text) {
        words.current = text;
        show();
      },
      async commitText(text) {
        const now = current();
        const finish = () => {
          words.current = undefined;
          show();
        };
        if (!now || text.trim() === "" || text === clipText(now.clip)) {
          finish();
          return false;
        }
        const result = await bus.run(setText, { clipId: id, text });
        finish();
        return result.ok;
      },
    };
  }, [bus, preview, project, id]);

  useEffect(
    () => () => {
      style.current = {};
      words.current = undefined;
      preview.previewTextClip(id, null);
    },
    [preview, id],
  );
  return live;
}
