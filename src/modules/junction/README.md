# junction

Kinds of junction. A junction is what sits on the cut between two adjacent clips of one track (a
transition, a plugin's). Each kind is declared once with `defineJunctionKind`: its properties,
defaults, how much the two clips overlap, optional cross-field rules, how a frame is mixed and how
its chip looks. This module holds the kinds and the registry; commands, the timeline chips and
the preview mix are built on it by other modules.

- **Tier:** core
- **Requires:** `project`, `element`
- **Contributes:** —
- **Points it owns** (`junction.points.ts`): `junctionKinds` (id `junction.kinds`, keyed by
  `kind`). Read by the registry.
- **API:** `JunctionApi` (`junction.registry.ts`): `get(kind)` → `ResolvedJunctionKind`
  (definition and the patch schema), `list()`, `resolve(junction, format)` (stored props over the
  kind's defaults; `{}` for a missing kind), `display(junction, format)` (label and icon for the
  chip; a missing kind gives `"<kind> (not available)"`, `missing: true` and one warning),
  `warn(message)` (logs once per kernel). Worked out once, kept until a point changes.
- **Files:**
  - `junction.types.ts`: `JunctionKindDefinition`, `OverlapRule`, `MixFn`/`MixEnv`,
    `NormalizeEnv` (`format`, `previous` resolved props, `{}` on add), `JunctionDisplay`, `JunctionApi`.
  - `logic/define.ts`: `defineJunctionKind`.
  - `junction.registry.ts`: the registry. Schemas come from `patchSchema` of `element` (same
    rules as elements, custom prop types from `propTypes`, no shared groups); values are merged
    with `resolveProps`.
- **Values:** a junction's `props` hold what differs from `defaults(format)` (`minimizeProps` from
  `element`), like a clip's.
- **Not yet:** commands, MCP tools, timeline chips, preview mixing, kinds (the transition feature).

No commands or MCP tools yet.
