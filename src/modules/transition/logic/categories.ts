import type { TransitionPresetDefinition } from "../transition.types";

/** The categories listed first, in this order; any other category follows by name. */
const KNOWN_CATEGORIES = ["basic", "overlay", "blur", "glitch"];

/** The presets of one category, in contribution order. */
export interface PresetSection {
  category: string;
  /** The category name for a heading. */
  title: string;
  presets: TransitionPresetDefinition[];
}

/** Groups presets into sections: Basic, Overlay, Blur, Glitch, then other categories by name. */
export function orderCategories(presets: readonly TransitionPresetDefinition[]): PresetSection[] {
  const groups = new Map<string, TransitionPresetDefinition[]>();
  for (const preset of presets) {
    const list = groups.get(preset.category) ?? [];
    list.push(preset);
    groups.set(preset.category, list);
  }
  const rank = (category: string) => {
    const index = KNOWN_CATEGORIES.indexOf(category);
    return index === -1 ? KNOWN_CATEGORIES.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, list]) => ({
      category,
      title: category.charAt(0).toUpperCase() + category.slice(1),
      presets: list,
    }));
}
