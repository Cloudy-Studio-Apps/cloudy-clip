/**
 * Tint module: the Tint page, where colors are graded as layers (Baby Seal) or nodes (Leader Seal).
 * @module tint
 */
export type {
  CubeLut,
  CurveKind,
  GradeTarget,
  GradeLevel,
  GradeTab,
  LiveGrade,
  LiveNode,
  LoadedLut,
  LookDef,
  LutFile,
  LutFiles,
  LutLookup,
  ScopeKind,
  TintApi,
  TintClipboard,
  TintLive,
  TintMode,
  TintView,
  ToolId,
  WheelsMode,
} from "./tint.types";

/** Module definition, loaded by the app shell. */
export { tintModule } from "./tint.module";
/** Handle for `require(tintRef)` / `useModule(tintRef)`, and the page's id. */
export { TINT_PAGE, tintRef } from "./tint.ref";

/** The looks (`LookDef`): contribute one to add it to the Looks tab and `tint.applyLook`. */
export { tintLooks } from "./tint.points";
