import type { StoreApi } from "zustand/vanilla";
import type { BusId, ClipId, CompositionId, TrackId } from "@/modules/project";
import type { MonitorState } from "@/modules/preview";
import type { Analyzer, Matcher } from "./sound.delivery.types";
import type { UserPresets } from "./sound.effects.types";
import type {
  AutomationMode,
  AutomationWriter,
  LineTarget,
  MixTarget,
  SoundTool,
} from "./sound.line.types";
import type { Recorder } from "./sound.record.types";
import type {
  AgentScans,
  BeatFinder,
  LoudnessMeter,
  MatchDialog,
  SilenceDialog,
  SilenceFinder,
} from "./sound.tools.types";

/** What the Sound page shows and how the user listens, per kernel. Never in history. */
export interface SoundViewState {
  /**
   * The strip that is marked, or null: an audio track (its header is marked too) or the master. Its
   * chain shows in the Channel tab. A track, not clips.
   */
  selected: MixTarget | null;
  /** Soloed tracks; none means every track sounds. Never in an export. */
  solo: TrackId[];
  /** The mixer takes the whole page (Expand all). */
  expanded: boolean;
  /**
   * The mixer shows the strips of this group only (the group and the tracks sent to it), or every
   * strip when null or a group the open composition lacks. Master always shows.
   */
  filter: BusId | null;
  /** Mono, Dim and the speaker volume. Never in an export. */
  monitor: MonitorState;
  /** The track a recording goes onto: an audio track that isn't muted. */
  armed: TrackId | null;
  /** By `automationKey` (a track, or the master of a composition): how each fader writes its volume line while playing; missing is Read. */
  automation: Record<string, AutomationMode>;
  /** Tracks whose volume line is in front of their clips' lines: Draw volume draws on it. */
  lineView: Record<TrackId, boolean>;
  /** The pointer tool of the Sound page's lanes. */
  tool: SoundTool;
  /** The selected point of a track's volume line, or the master's (`"master"`): Delete removes it. */
  linePoint: { trackId: LineTarget; keyId: string } | null;
  /** The Strip silence dialog: the clips it is about and the cuts it shows on the lanes; null when closed. */
  silence: SilenceDialog | null;
  /** The Match level dialog: the clips it is about; null when closed. */
  match: MatchDialog | null;
}

/** The sound module's API, per kernel. */
export interface SoundApi {
  /** The page's view state. Solo and the monitor change through `sound.setSolo` / `sound.setMonitor`. */
  view: StoreApi<SoundViewState>;
  /** Marks a track's strip and header, the master's strip, or none. */
  select(target: MixTarget | null): void;
  /**
   * The user's own presets, kept in `localStorage`. Changed by `sound.savePreset`,
   * `sound.renamePreset` and `sound.removePreset`.
   */
  presets: StoreApi<UserPresets>;
  /** Lets the mixer take the whole page, or gives the timeline its place back. */
  setExpanded(expanded: boolean): void;
  /** Shows the strips of one group in the mixer, or (null) every strip. */
  setFilter(busId: BusId | null): void;
  /** Arms a track for recording, or none. Refused (nothing changes) while a take is recorded. */
  arm(trackId: TrackId | null): void;
  /** Records the microphone onto the armed track, or onto a new Voice track when none is armed. */
  recorder: Recorder;
  /** Chooses the pointer tool of the lanes. */
  setTool(tool: SoundTool): void;
  /** Sets how a track's fader, or the master's (of `compositionId`, default the open one), writes its volume line while playing. */
  setAutomation(target: LineTarget, mode: AutomationMode, compositionId?: CompositionId): void;
  /** Puts a track's volume line in front of its clips' lines, or behind. */
  setLineView(trackId: TrackId, inFront: boolean): void;
  /** Writes fader passes onto volume lines. */
  automation: AutomationWriter;
  /** Whole-mix analyses: results, progress, start and cancel. */
  analyzer: Analyzer;
  /** Runs Match target outside the bus, and matches an export's mix (see `sound.startMatch`). */
  matcher: Matcher;
  /** Beats found in files, for ticks and snapping: progress, start and cancel (`sound.findBeats`). */
  beats: BeatFinder;
  /** Strip silence: finds the cuts of clips, and opens or closes its dialog (`null`). */
  silences: SilenceFinder;
  /** Opens the Strip silence dialog on clips, or closes it (null). */
  openSilence(target: { clipIds: ClipId[]; soundOnly: boolean } | null): void;
  /** Match level: measures clips' loudness for the command that matches it. */
  loudness: LoudnessMeter;
  /** Opens the Match level dialog on clips, or closes it (null). */
  openMatch(target: MatchDialog | null): void;
  /** The scans agents started, so each stops its own (`sound.cancelScans`). */
  scans: AgentScans;
}
