import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { SegmentedControl } from "@/ui";
import { setTheme } from "../theme.commands";
import { themeRef } from "../theme.ref";
import { ThemeGrid } from "./ThemeGrid";

const MODES = [
  { value: "fixed", label: "One theme" },
  { value: "system", label: "Match system" },
] as const;

/** Settings › Appearance. Every choice applies at once. */
export function AppearanceSection() {
  const { bus } = useKernel();
  const { store } = useModule(themeRef);
  const mode = useStore(store, (state) => state.mode);
  const themeId = useStore(store, (state) => state.themeId);
  const lightThemeId = useStore(store, (state) => state.lightThemeId);
  const darkThemeId = useStore(store, (state) => state.darkThemeId);

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        label="Theme mode"
        options={MODES}
        value={mode}
        onChange={(next) => void bus.run(setTheme, { mode: next })}
      />
      {mode === "fixed" ? (
        <ThemeGrid
          selectedId={themeId}
          onSelect={(id) => void bus.run(setTheme, { themeId: id })}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">When the system is light</p>
          <ThemeGrid
            appearance="light"
            selectedId={lightThemeId}
            onSelect={(id) => void bus.run(setTheme, { lightThemeId: id })}
          />
          <p className="text-sm text-muted-foreground">When the system is dark</p>
          <ThemeGrid
            appearance="dark"
            selectedId={darkThemeId}
            onSelect={(id) => void bus.run(setTheme, { darkThemeId: id })}
          />
        </>
      )}
    </div>
  );
}
