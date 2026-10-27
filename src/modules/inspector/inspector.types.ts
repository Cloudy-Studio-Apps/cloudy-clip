/** The inspector module's API. Empty for now: it only contributes its panel. */
export type InspectorApi = Record<string, never>;

/** One label/value row of an info list. */
export interface InfoRow {
  label: string;
  value: string;
}
