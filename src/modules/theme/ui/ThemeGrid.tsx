import { useModule, usePoint } from "@/core";
import { groupFamilies } from "../logic/families";
import { themes } from "../theme.points";
import { themeRef } from "../theme.ref";
import type { ThemeAppearance } from "../theme.types";
import { ThemeCard } from "./ThemeCard";

interface ThemeGridProps {
  /** Only themes of this appearance (the slots of Match system). All when unset. */
  appearance?: ThemeAppearance;
  selectedId: string;
  onSelect(id: string): void;
}

/** The themes as cards: the app's first, then each plugin's under its name. */
export function ThemeGrid({ appearance, selectedId, onSelect }: ThemeGridProps) {
  usePoint(themes);
  const theme = useModule(themeRef);
  const listed = theme.list().filter((item) => !appearance || item.appearance === appearance);
  const preferred = theme.active().resolved.appearance;
  const missing = !theme.list().some(({ id }) => id === selectedId);

  const owners = new Map<string | undefined, ReturnType<typeof groupFamilies>>();
  for (const family of groupFamilies(listed)) {
    owners.set(family.owner, [...(owners.get(family.owner) ?? []), family]);
  }
  const sections = [...owners].sort(
    ([a], [b]) => Number(a !== undefined) - Number(b !== undefined),
  );

  return (
    <div className="flex flex-col gap-3">
      {sections.map(([owner, families]) => (
        <div key={owner ?? "app"} className="flex flex-col gap-1.5">
          {owner && <p className="text-xs text-muted-foreground">{owner}</p>}
          <div className="grid grid-cols-2 items-start gap-2.5">
            {families.map((family) => (
              <ThemeCard
                key={family.key}
                family={family}
                selectedId={selectedId}
                onSelect={onSelect}
                preferred={preferred}
              />
            ))}
          </div>
        </div>
      ))}
      {missing && (
        <p className="text-sm text-muted-foreground">
          The theme "{selectedId}" isn't installed, so a built-in one shows instead.
        </p>
      )}
    </div>
  );
}
