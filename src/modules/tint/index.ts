/**
 * Tint module: the Tint page, where colors are graded as layers (Baby Seal) or nodes (Leader Seal).
 * The page is laid out with demo data for now.
 * @module tint
 */
export type {
  CurveKind,
  GradeLevel,
  GradeTab,
  ScopeKind,
  TintApi,
  TintMode,
  TintView,
  ToolId,
  WheelsMode,
} from "./tint.types";

/** Module definition, loaded by the app shell. */
export { tintModule } from "./tint.module";
/** Handle for `require(tintRef)` / `useModule(tintRef)`, and the page's id. */
export { TINT_PAGE, tintRef } from "./tint.ref";
