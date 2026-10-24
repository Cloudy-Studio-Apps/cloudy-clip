/**
 * A time or duration in integer microseconds.
 *
 * Every time in the project (clip positions, trims, the playhead) uses this unit so math stays
 * exact on long timelines. Convert to seconds only at the edges (media elements, display).
 */
export type Micros = number;
