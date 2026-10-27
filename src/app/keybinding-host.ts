import { keybindings, matchKeybinding, type Kernel } from "@/core";

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Runs the `keybindings` point on `window`. Each binding maps to a command, so shortcuts,
 * buttons and agents all go through the bus. Returns an uninstall function.
 */
export function installKeybindings(kernel: Kernel): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || isTyping(e.target)) return;
    const binding = matchKeybinding(kernel.points.get(keybindings), e);
    const action = binding?.resolve();
    if (!action) return;
    e.preventDefault();
    void kernel.bus.execute(action.command, action.input);
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
