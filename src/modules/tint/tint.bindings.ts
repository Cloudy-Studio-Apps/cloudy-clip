import { LOCAL_ACTOR, pagesRef, type Keybinding, type ModuleContext } from "@/core";
import { projectRef } from "@/modules/project";
import { neighbourClip, stripClips } from "./logic/strip";
import { pinClip, setBypass } from "./tint.view.commands";
import { setClean } from "./tint.viewer.commands";
import { TINT_PAGE, tintRef } from "./tint.ref";

/**
 * Up and Down on the Tint page: the clip before or after the current one in the strip, pinned
 * like a click would. Shift+D there flips the grade bypass, Ctrl+F the clean viewer and Esc leaves it. Nothing on other pages.
 */
export function tintBindings(ctx: ModuleContext): Keybinding[] {
  const onTint = () => ctx.require(pagesRef).store.getState().active === TINT_PAGE;
  const step = (by: -1 | 1) => () => {
    if (!onTint()) return null;
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
    {
      id: "tint.cleanViewer",
      key: "f",
      mod: true,
      resolve: () => (onTint() ? { command: setClean.id, input: {} } : null),
    },
    {
      id: "tint.leaveCleanViewer",
      key: "escape",
      resolve: () =>
        onTint() && ctx.require(tintRef).view.getState().clean
          ? { command: setClean.id, input: { on: false } }
          : null,
    },
    {
      id: "tint.bypass",
      key: "d",
      shift: true,
      resolve: () => (onTint() ? { command: setBypass.id, input: {} } : null),
    },
  ];
}
