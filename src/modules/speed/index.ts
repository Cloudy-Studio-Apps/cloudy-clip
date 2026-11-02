/**
 * Speed module: how fast a clip plays its file, and the tools that change it.
 * @module speed
 */
/** Changes how fast clips play, and puts them back to normal. */
export { resetSpeed, setSpeed } from "./speed.commands";
export type { RetimedClip, SpeedApi, SpeedView } from "./speed.types";

/** Module definition, loaded by the app shell. */
export { speedModule } from "./speed.module";
/** Handle for `require(speedRef)` / `useModule(speedRef)`. */
export { speedRef } from "./speed.ref";
