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
- **Kinds:** the `transition` feature module contributes the `transition` kind.
- **Boundaries:** the data is in the document (`ProjectState.junctions`, typed in `project`, so undo
  and `project_get_state` need no wiring). A kind never needs the `transition` feature, and no code
  outside a kind's module branches on its id. `timeline` draws the chips and keeps junctions valid
  in clip commands; `preview` calls `mix`, a hook with nothing transition-specific in it, so
  effects and adjustment layers can reuse it later.
- **Not yet:** other kinds (a sound on a cut, a flash frame, a beat marker).

## Rules

The same for every kind; a kind can't change them. Code cites them as "junction rule N".

1. **One per cut.** At most one junction on a cut, and only between two clips that touch or overlap
   by exactly its `duration`.
2. **It moves with its clips.** An edit that separates them (moving either away, deleting one,
   moving one to another track) removes the junction in the same command and says so in the
   result. The clips stay where the edit put them, no shift back.
3. **An overlap pulls clips earlier.** Adding a junction of duration `d` moves the right clip, every
   later clip on its track and their linked partners `d` earlier. Clips on other tracks that aren't
   linked stay put. If that would make a clip overlap something no junction covers, the command
   fails and nothing changes (`junction.overlap`, naming the clip in the way).
4. **Linked sound under the cut.** When both clips have linked sound clips adjacent on an audio
   track, those overlap by the same `d` and the preview crossfades them. The same junction covers
   them; there is no separate audio junction.
5. **Changing and removing.** A new duration shifts by the difference and removing shifts back by
   `d`, both following rule 3.
6. **Limits** come from the kind: `transition` defaults to 0.5 s, between one frame and half the
   shorter clip (CapCut's limit as third-party guides report it, not officially confirmed). Outside
   the limits a drag is clamped and a command is refused (`junction.invalid_duration`, with the
   allowed range).
7. **Who enforces what.** `project` rules are structural only (two clips adjacent on one track,
   overlapping by exactly `duration`; pruning). The kind's limits are applied by the commands that
   change clip lengths or junctions (`timeline`, `junction`), which can see the registry. A format
   change touches no junction, because lengths in µs don't depend on it. A junction whose kind isn't
   registered is kept: its chip says "not available", it mixes nothing and it is logged once.
8. **Track invariant.** Clips never overlap on a track except by exactly the duration of a junction
   joining them, or of the pair linked to that junction (rule 4). Every guard goes through the
   `project` rule, never its own check.
9. **Which clips.** Any two adjacent clips on a track kind the kind declares (`tracks`): `transition`
   sits on video tracks, so text → text and text → video work. A plugin kind may declare audio tracks.
10. **Edits to joined clips** (move, trim, split, delete, unlink): see Junctions in the
    [timeline README](../timeline/README.md).

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
