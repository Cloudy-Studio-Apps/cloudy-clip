import { definePoint } from "@/core";
import type { RelinkKind } from "./workspace.types";

/** Kinds of file a project keeps by path, listed in the relink dialog. `RelinkHost` reads them. */
export const relinkKinds = definePoint<RelinkKind>("workspace.relinkKinds", {
  keyOf: (kind) => kind.id,
});
