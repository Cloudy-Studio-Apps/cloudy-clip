import { createStore } from "zustand/vanilla";
import type { NotificationLevel, NotificationsState } from "./notifications.types";

const MAX_VISIBLE = 4;
const DISMISS_AFTER_MS = 4_000;

let nextId = 1;

/** Ephemeral store of on-screen notifications (toasts). */
export const notificationsStore = createStore<NotificationsState>()(() => ({ items: [] }));

/** Dismisses a notification. */
export function dismiss(id: number): void {
  notificationsStore.setState((s) => ({ items: s.items.filter((n) => n.id !== id) }));
}

/** Shows a notification that disappears on its own. */
export function notify(level: NotificationLevel, message: string): void {
  const id = nextId++;
  notificationsStore.setState((s) => ({
    items: [...s.items, { id, level, message }].slice(-MAX_VISIBLE),
  }));
  setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
}
