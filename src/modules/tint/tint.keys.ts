import { LOCAL_ACTOR, pagesRef, type Keybinding, type ModuleContext } from "@/core";
import { projectRef } from "@/modules/project";
import { neighbourClip, stripClips } from "./logic/strip";
import { pinClip } from "./tint.view.commands";
import { TINT_PAGE, tintRef } from "./tint.ref";

/**
 * Up and Down on the Tint page: the clip before or after the current one in the strip, pinned
 * like a click would. Nothing on other pages, where the arrows belong to others.
 */
export function tintKeys(ctx: ModuleContext): Keybinding[] {
  const step = (by: -1 | 1) => () => {
    if (ctx.require(pagesRef).store.getState().active !== TINT_PAGE) return null;
    const project = ctx.require(projectRef);
    const open = project.view.openFor(LOCAL_ACTOR);
    if (open === null) return null;
    const strip = stripClips(project.store.getState(), open);
    const next = neighbourClip(strip, ctx.require(tintRef).current(), by);
    return next ? { command: pinClip.id, input: { clipId: next.clip.id } } : null;
  };
  return [
    { id: "tint.previousClip", key: "arrowup", resolve: step(-1) },
    { id: "tint.nextClip", key: "arrowdown", resolve: step(1) },
  ];
}
