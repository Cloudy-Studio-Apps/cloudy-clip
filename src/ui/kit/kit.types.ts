/** One choice of a `SegmentedControl`. */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Tooltip, e.g. what an aspect ratio is for. */
  hint?: string;
}
