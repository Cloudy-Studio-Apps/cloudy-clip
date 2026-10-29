# junction

Kinds of junction. A junction is what sits on the cut between two adjacent clips of one track (a
transition, a plugin's). Each kind is declared once with `defineJunctionKind`: its properties,
defaults, how much the two clips overlap, optional cross-field rules, how a frame is mixed and how
its chip looks. This module holds the kinds and the registry; commands, the timeline chips and
the preview mix are built on it by other modules.

- **Tier:** core
- **Requires:** `project`, `element`
- **Contributes:** commands and MCP tools below (no UI yet)
- **Points it owns** (`junction.points.ts`): `junctionKinds` (id `junction.kinds`, keyed by
  `kind`). Read by the registry.
- **API:** `JunctionApi` (`junction.registry.ts`): `get(kind)` → `ResolvedJunctionKind`
  (definition and the patch schema), `list()`, `resolve(junction, format)` (stored props over the
  kind's defaults; `{}` for a missing kind), `display(junction, format)` (label and icon for the
  chip; a missing kind gives `"<kind> (not available)"`, `missing: true` and one warning),
  `warn(message)` (logs once per kernel). Worked out once, kept until a point changes.
  Exported for other modules' commands that change joined clips (the timeline): `durationLimits`,
  `clampDuration`, `checkDuration` (the `junction.invalid_duration` failure), `cutNear`, `cutAfter`.
- **Files:**
  - `junction.types.ts`: `JunctionKindDefinition`, `OverlapRule`, `MixFn`/`MixEnv`,
    `NormalizeEnv` (`format`, `previous` resolved props, `{}` on add), `JunctionDisplay`, `JunctionApi`.
  - `logic/define.ts`: `defineJunctionKind`.
  - `logic/limits.ts`: `durationLimits(kind, state, left, right)` → `DurationLimits`
    (`{0,0,0}` when the kind doesn't overlap; default clamped into min..max), `clampDuration`.
  - `logic/cut.ts`: `cutNear(state, trackId, time, tolerance)` and `cutAfter(state, clipId)` →
    `Cut` (clips that touch, or overlap by their junction; an overlapping cut sits at the middle
    of the overlap). Types: `DurationLimits`, `Cut`.
  - `junction.registry.ts`: the registry. Schemas come from `patchSchema` of `element` (same
    rules as elements, custom prop types from `propTypes`, no shared groups); values are merged
    with `resolveProps`.
- **Values:** a junction's `props` hold what differs from `defaults(format)` (`minimizeProps` from
  `element`), like a clip's.
- **Kinds:** the `transition` feature module contributes the `transition` kind. **Not yet:** other kinds.

## Commands and tools

All undoable (one undo step each). Adding an overlapping junction pulls the right clip, every
later clip on the track and their linked partners earlier by the duration; `set` with a new
duration shifts by the difference; `remove` shifts back. The layout is checked before anything is
written (`junction.overlap` names the clip in the way).

| Command           | Tool                | Input                                                                              | Errors                                                                                           |
| ----------------- | ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `junction.add`    | `junction_add`      | `kind`, cut as `leftClipId`+`rightClipId` or `trackId`+`at`, `props?`, `duration?` | `unknown_kind`, `no_cut`, `track_kind`, `exists`, `invalid_duration`, `invalid_props`, `overlap` |
| `junction.set`    | `junction_set`      | `junctionIds[]`, `patch?`, `duration?`                                             | `not_found`, `unknown_kind`, `invalid_duration`, `invalid_props`, `overlap`                      |
| `junction.remove` | `junction_remove`   | `junctionIds[]` → `{ removed }`                                                    | `not_found`, `overlap`                                                                           |
| (read)            | `junction_describe` | none: every kind with tracks, overlap (default, min), patch JSON schema, defaults  |                                                                                                  |

Files: `junction.commands.ts`, `junction.guards.ts` (`requireJunction`, `requireCut`, props
parsing, duration check, `junction.overlap` message), `junction.mcp.ts`. Kinds that don't overlap
ignore `duration` (always 0, nothing moves).
