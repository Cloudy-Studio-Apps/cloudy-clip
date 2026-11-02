import type { ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";

/** A section of the Settings window. */
export interface SettingsSection {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** Its name in the window's list. */
  label: string;
  /** Lower comes first. Defaults to 0. */
  order?: number;
  component: ComponentType;
}

/** Whether the Settings window shows. */
export interface SettingsState {
  open: boolean;
}

/** The settings module's API. */
export interface SettingsApi {
  /** Read with `useStore`. Opened by `settings.open`. */
  readonly store: StoreApi<SettingsState>;
  /** Closes the window. */
  close(): void;
}
