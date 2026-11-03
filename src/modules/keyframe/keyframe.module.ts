import { defineModule, keybindings, type ActorId, type TimelineScopeName } from "@/core";
import { previewOverlays } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { clipActions, timelineDocks, timelineRef, timelineTools } from "@/modules/timeline";
import { ClipBadge, KeyPanel, keyAction, ModeSwitch, MotionPath } from "./ui";
import { setEase } from "./keyframe.ease.commands";
import { keyframeCommands } from "./keyframe.commands";
import { createKeyframeApi, elementTarget } from "./keyframe.fields";
import { fieldActions } from "@/modules/inspector";
import { keyTargets } from "./keyframe.points";
import { keysInScope } from "./logic/scope";
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
    // Volume and pan keys are sound, so the mode switch, panel and badge also show on the Sound page.
    const scopes: TimelineScopeName[] = ["all", "sound"];
    ctx.contribute(timelineTools, { id: "keyframe.mode", order: 0, scopes, component: ModeSwitch });
    ctx.contribute(timelineDocks, { id: "keyframe.panel", scopes, component: KeyPanel });
    ctx.contribute(clipActions, { id: "keyframe.badge", scopes, badge: ClipBadge });
    ctx.contribute(previewOverlays, { id: "keyframe.motionPath", component: MotionPath });
    ctx.contribute(keybindings, {
      id: "keyframe.toggle-mode",
      key: "k",
      resolve: () => ({ command: toggleMode.id, input: {} }),
    });
    ctx.contribute(keybindings, {
      id: "keyframe.ease-selected",
      key: "f9",
      // On the Sound page only the selected keys of sound clips: the selection is shared with Edit.
      resolve: () => {
        const { mode, selection } = view.getState();
        const scope = ctx.require(timelineRef).activeScope();
        const keys = keysInScope(project.getState(), selection, scope);
        return mode === "normal" || keys.length === 0
          ? null
          : { command: setEase.id, input: { changes: keys.map((key) => ({ key, ease: "ease" })) } };
      },
    });
    return { api: createKeyframeApi(ctx, view, clipboard) };
  },
});
