/** Severity of a notification. */
export type NotificationLevel = "info" | "success" | "error";

/** A short, transient message shown to the user. */
export interface Notification {
  id: number;
  level: NotificationLevel;
  message: string;
}

/** State of the notification store. */
export interface NotificationsState {
  items: Notification[];
}
