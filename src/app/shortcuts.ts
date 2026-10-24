import type { Kernel } from "@/core";
import { playback } from "@/modules/preview";
import { timelineViewStore } from "@/modules/timeline";

interface Shortcut {
  /** `KeyboardEvent.key`, lowercased. */
  key: string;
  mod?: boolean;
  shift?: boolean;
  /** Command id and input, built at press time. Returns null to ignore the press. */
  command(): { id: string; input: unknown } | null;
}

/**
 * Keyboard shortcuts. Each maps to a command id, so shortcuts, buttons, and agents all go
 * through the same path (and plugins can add their own later).
 */
const SHORTCUTS: Shortcut[] = [
  { key: " ", command: () => ({ id: "preview.togglePlay", input: {} }) },
  { key: "z", mod: true, command: () => ({ id: "history.undo", input: {} }) },
  { key: "z", mod: true, shift: true, command: () => ({ id: "history.redo", input: {} }) },
  { key: "y", mod: true, command: () => ({ id: "history.redo", input: {} }) },
  {
    key: "s",
    command: () => {
      const selection = timelineViewStore.getState().selection;
      return {
        id: "timeline.splitAt",
        input: { at: playback.getTime(), clipIds: selection.length > 0 ? selection : undefined },
      };
    },
  },
  ...["delete", "backspace"].map((key) => ({
    key,
    command: () => {
      const clipIds = timelineViewStore.getState().selection;
      return clipIds.length > 0 ? { id: "timeline.deleteClips", input: { clipIds } } : null;
    },
  })),
  { key: "home", command: () => ({ id: "preview.seek", input: { time: 0 } }) },
];

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Installs the shortcuts on `window`. Returns an uninstall function. */
export function installShortcuts(kernel: Kernel): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || isTyping(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const shortcut = SHORTCUTS.find(
      (s) => s.key === key && !!s.mod === mod && !!s.shift === e.shiftKey,
    );
    if (!shortcut) return;
    const command = shortcut.command();
    if (!command) return;
    e.preventDefault();
    void kernel.bus.execute(command.id, command.input);
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
