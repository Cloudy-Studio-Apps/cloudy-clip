import { defineModule, keybindings, type ActorId } from "@/core";
import { previewOverlays } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { clipActions, timelineDocks, timelineTools } from "@/modules/timeline";
import { ClipBadge, KeyPanel, keyAction, ModeSwitch, MotionPath } from "./ui";
import { setEase } from "./keyframe.ease.commands";
import { keyframeCommands } from "./keyframe.commands";
import { createKeyframeApi, elementTarget } from "./keyframe.fields";
import { fieldActions } from "@/modules/inspector";
import { keyTargets } from "./keyframe.points";
import { keyframeMcpTools } from "./keyframe.mcp";
import { keyframeRef } from "./keyframe.ref";
import type { CopiedKeys, KeyframeClipboard } from "./keyframe.types";
import { toggleMode } from "./keyframe.view.commands";
import { createKeyframeView, pruneSelection } from "./keyframe.view.store";

/** Keys on a clip's values over time: commands and tools to add, move and remove them. */
export const keyframeModule = defineModule({
  ref: keyframeRef,
  name: "Keyframes",
  tier: "feature",
  requires: ["project", "element", "preview", "inspector", "timeline"],
  commands: keyframeCommands,
  mcpTools: keyframeMcpTools,
  setup(ctx) {
    const view = createKeyframeView();
    const copied = new Map<ActorId, CopiedKeys>();
    const clipboard: KeyframeClipboard = {
      get: (actor) => copied.get(actor),
      set: (actor, keys) => void copied.set(actor, keys),
    };
    const project = ctx.require(projectRef).store;
    ctx.onDispose(
      project.subscribe((state, previous) => {
        if (state.clips !== previous.clips) pruneSelection(view, state.clips);
      }),
    );
    ctx.contribute(keyTargets, elementTarget(ctx));
    ctx.contribute(fieldActions, keyAction);
    ctx.contribute(timelineTools, { id: "keyframe.mode", order: 0, component: ModeSwitch });
    ctx.contribute(timelineDocks, { id: "keyframe.panel", component: KeyPanel });
    ctx.contribute(clipActions, { id: "keyframe.badge", badge: ClipBadge });
    ctx.contribute(previewOverlays, { id: "keyframe.motionPath", component: MotionPath });
    ctx.contribute(keybindings, {
      id: "keyframe.toggle-mode",
      key: "k",
      resolve: () => ({ command: toggleMode.id, input: {} }),
    });
    ctx.contribute(keybindings, {
      id: "keyframe.ease-selected",
      key: "f9",
      resolve: () => {
        const { mode, selection: keys } = view.getState();
        return mode === "normal" || keys.length === 0
          ? null
          : { command: setEase.id, input: { changes: keys.map((key) => ({ key, ease: "ease" })) } };
      },
    });
    return { api: createKeyframeApi(ctx, view, clipboard) };
  },
});
