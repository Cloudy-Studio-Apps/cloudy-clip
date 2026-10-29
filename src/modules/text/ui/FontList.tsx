import { useMemo, useRef, useState } from "react";
import { searchFamilies, type FontFamily } from "@/modules/fonts";
import { visibleWindow } from "../logic/fontpick";
import { FONT_ROW_HEIGHT, FontRow } from "./FontRow";
import { useFamilies } from "./text.fonts.hook";

const VIEWPORT = 260;
const OVERSCAN = 4;

interface FontListProps {
  current: string;
  onPick(family: FontFamily): void;
}

/** Search box and a scrolling list that renders only the rows in view (fixed row height). */
export function FontList({ current, onPick }: FontListProps) {
  const families = useFamilies();
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const found = useMemo(() => searchFamilies(families, query, Infinity), [families, query]);
  const { start, end } = visibleWindow(
    scrollTop,
    VIEWPORT,
    FONT_ROW_HEIGHT,
    found.length,
    OVERSCAN,
  );

  return (
    <div className="flex w-64 flex-col gap-2">
      <input
        autoFocus
        aria-label="Search fonts"
        placeholder="Search fonts"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setScrollTop(0);
          if (scroller.current) scroller.current.scrollTop = 0;
        }}
        className="h-7 rounded-sm border border-border bg-surface-sunken px-2 text-xs text-foreground outline-none focus:border-ring"
      />
      <div
        ref={scroller}
        role="listbox"
        aria-label="Fonts"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="overflow-y-auto"
        style={{ height: VIEWPORT }}
      >
        <div className="relative" style={{ height: found.length * FONT_ROW_HEIGHT }}>
          <div className="absolute inset-x-0" style={{ top: start * FONT_ROW_HEIGHT }}>
            {found.slice(start, end).map((family) => (
              <FontRow
                key={`${family.source}:${family.family}`}
                family={family}
                selected={family.family === current}
                onPick={() => onPick(family)}
              />
            ))}
          </div>
        </div>
        {found.length === 0 && (
          <p className="m-0 p-2 text-xs text-muted-foreground">
            {families.length === 0 ? "Loading fonts..." : "No font matches."}
          </p>
        )}
      </div>
    </div>
  );
}
