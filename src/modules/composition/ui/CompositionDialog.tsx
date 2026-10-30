import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { DEFAULT_FORMAT, projectRef, type Composition } from "@/modules/project";
import { Button, ColorField, Dialog, NumberField, SelectField, ToggleRow } from "@/ui";
import { createComposition, setSettings } from "../composition.commands";
import { COMPOSITION_PRESETS, FPS_OPTIONS } from "../composition.presets";
import { compositionRef } from "../composition.ref";
import { formatLength, parseLength } from "../logic/timecode";

const MAX_SIDE = 8192;
const CUSTOM = "custom";

const RESIZE_OPTIONS = [
  { value: "keep", label: "Keep positions" },
  { value: "scale", label: "Scale to the new frame" },
];

const PRESET_OPTIONS = [
  ...COMPOSITION_PRESETS.map((preset) => ({
    value: preset.id,
    label: `${preset.label}, ${preset.hint}`,
  })),
  { value: CUSTOM, label: "Custom" },
];

const FPS_CHOICES = [
  ...FPS_OPTIONS.map((option) => ({ value: String(option.fps), label: `${option.label} fps` })),
  { value: CUSTOM, label: "Custom" },
];

/** New Composition, or Composition Settings of an existing one. */
function Form({ composition, onClose }: { composition: Composition | null; onClose(): void }) {
  const { bus } = useKernel();
  const api = useModule(compositionRef);
  const [name, setName] = useState(composition?.name ?? "");
  const [format, setFormat] = useState(composition?.format ?? DEFAULT_FORMAT);
  const [background, setBackground] = useState(composition?.background ?? "#000000");
  const [extendToFit, setExtendToFit] = useState(composition?.extendToFit ?? false);
  const [initialLength] = useState(() =>
    formatLength(composition?.duration ?? 10_000_000, format.fps),
  );
  const [length, setLength] = useState(initialLength);
  const [ratioLocked, setRatioLocked] = useState(false);
  const [resize, setResize] = useState<"keep" | "scale">("keep");
  const resized =
    composition !== null &&
    (composition.format.width !== format.width || composition.format.height !== format.height);

  const duration = parseLength(length, format.fps);
  const preset =
    COMPOSITION_PRESETS.find(
      (p) => p.format.width === format.width && p.format.height === format.height,
    )?.id ?? CUSTOM;
  const fpsChoice = FPS_OPTIONS.some((o) => o.fps === format.fps) ? String(format.fps) : CUSTOM;

  const setSide = (side: "width" | "height", value: number) => {
    const other = side === "width" ? "height" : "width";
    const ratio = format[other] / format[side];
    const scaled = Math.min(MAX_SIDE, Math.max(2, Math.round(value * ratio)));
    setFormat({ ...format, [side]: value, ...(ratioLocked && { [other]: scaled }) });
  };

  const submit = () => {
    if (duration === null) return;
    const settings = {
      ...(name.trim() && { name: name.trim() }),
      format,
      background,
      duration,
      extendToFit,
    };
    // Only what was edited: the length box rounds to frames, so it mustn't rewrite an untouched
    // length, and a Save that changed nothing is no undo step.
    const changes = composition && {
      ...(name.trim() && name.trim() !== composition.name && { name: name.trim() }),
      ...((resized || format.fps !== composition.format.fps) && { format }),
      ...(background !== composition.background && { background }),
      ...(length !== initialLength && { duration }),
      ...(extendToFit !== composition.extendToFit && { extendToFit }),
    };
    if (changes && Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    const run = composition
      ? bus.run(setSettings, { compositionId: composition.id, ...changes, resize })
      : bus.run(createComposition, settings);
    void run.then((result) => {
      if (!result.ok) return;
      api.landPending();
      onClose();
    });
  };

  return (
    <Dialog
      title={composition ? "Composition Settings" : "New Composition"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={duration === null} onClick={submit}>
            {composition ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <Row label="Name">
        <input
          aria-label="Name"
          autoFocus
          value={name}
          placeholder="Composition"
          onChange={(event) => setName(event.target.value)}
          className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-surface-sunken px-2 text-xs text-foreground outline-none focus:border-ring"
        />
      </Row>
      <Row label="Preset">
        <SelectField
          label="Preset"
          className="flex-1"
          value={preset}
          options={PRESET_OPTIONS}
          onChange={(id) => {
            const chosen = COMPOSITION_PRESETS.find((p) => p.id === id);
            if (chosen) setFormat({ ...chosen.format, fps: format.fps });
          }}
        />
      </Row>
      <Row label="Size">
        <NumberField
          label="Width"
          className="flex-1"
          value={format.width}
          min={2}
          max={MAX_SIDE}
          unit="px"
          onChange={(value) => setSide("width", value)}
        />
        <NumberField
          label="Height"
          className="flex-1"
          value={format.height}
          min={2}
          max={MAX_SIDE}
          unit="px"
          onChange={(value) => setSide("height", value)}
        />
      </Row>
      {resized && (
        <Row label="Content">
          <SelectField
            label="Content"
            className="flex-1"
            value={resize}
            options={RESIZE_OPTIONS}
            onChange={(value) => setResize(value as "keep" | "scale")}
          />
        </Row>
      )}
      <ToggleRow label="Keep ratio" checked={ratioLocked} onChange={setRatioLocked} />
      <Row label="Frame rate">
        <SelectField
          label="Frame rate"
          className="flex-1"
          value={fpsChoice}
          options={FPS_CHOICES}
          onChange={(value) => {
            if (value !== CUSTOM) setFormat({ ...format, fps: Number(value) });
          }}
        />
        {fpsChoice === CUSTOM && (
          <NumberField
            label="Custom frame rate"
            className="w-20"
            value={Math.round(format.fps * 1000) / 1000}
            min={1}
            max={240}
            step={0.001}
            onChange={(fps) => setFormat({ ...format, fps })}
          />
        )}
      </Row>
      <ColorField
        label="Background"
        color={background}
        onChange={(color) => setBackground(color)}
      />
      <Row label="Duration">
        <input
          aria-label="Duration"
          value={length}
          disabled={extendToFit}
          aria-invalid={duration === null}
          onChange={(event) => setLength(event.target.value)}
          className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-surface-sunken px-2 font-mono text-xs text-foreground outline-none focus:border-ring disabled:opacity-50 aria-[invalid=true]:border-destructive"
        />
      </Row>
      <ToggleRow label="Extend to fit" checked={extendToFit} onChange={setExtendToFit} />
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Shows the dialog the module's UI state asks for. */
export function CompositionDialogHost() {
  const api = useModule(compositionRef);
  const dialog = useStore(api.ui, (s) => s.dialog);
  const compositions = useStore(useModule(projectRef).store.api, (s) => s.compositions);
  const close = useCallback(() => api.closeDialog(), [api]);
  const composition = useMemo(
    () => (dialog?.mode === "settings" ? (compositions[dialog.compositionId] ?? null) : null),
    [compositions, dialog],
  );
  if (!dialog) return null;
  // Keyed, so each opening starts from the composition's current values.
  return (
    <Form
      key={dialog.mode === "settings" ? dialog.compositionId : "new"}
      composition={composition}
      onClose={close}
    />
  );
}
