import type {
  LayoutIssue,
  LayoutItem,
  LayoutSection,
  PropSpec,
  ResolvedElement,
  ResolvedItem,
  ResolvedSection,
} from "../element.types";
import { labelOf } from "./labels";

/** Order of the section that collects properties a layout forgot. */
const OTHER_ORDER = 10_000;

type ControlOf = (path: string, spec: PropSpec) => string;

/**
 * An element's panel: its layout (or a generated one) with every path checked and every control
 * and label picked, then each supported shared group's section. Mistakes become `issues`; the
 * panel is still complete (forgotten properties go to an "Other" section).
 */
export function resolveLayout(
  element: ResolvedElement,
  controlOf: ControlOf,
): { sections: ResolvedSection[]; issues: LayoutIssue[] } {
  const { definition, fields, groups } = element;
  const kind = definition.kind;
  const issues: LayoutIssue[] = [];
  const placed = new Set<string>();
  let where = "";

  const issue = (message: string) =>
    issues.push({ message: `element "${kind}"${where}: ${message}` });
  const groupSpec = (path: string): PropSpec | undefined => {
    const spec = fields.get(path);
    if (spec?.kind === "group") return spec;
    const shared = groups.find((g) => g.key === path);
    return shared && { kind: "group", label: shared.label, fields: shared.properties };
  };

  const field = (path: string, over: { control?: string; label?: string } = {}, inRow = false) => {
    const spec = fields.get(path);
    if (!spec) return void issue(`path "${path}" does not exist`);
    if (spec.hidden) return undefined;
    if (placed.has(path) && !inRow) return void issue(`path "${path}" is placed twice`);
    placed.add(path);
    const item: ResolvedItem = {
      type: "field",
      path,
      control: over.control ?? controlOf(path, spec),
      label: over.label ?? spec.label ?? labelOf(path),
    };
    return item;
  };

  /** A group's header toggle and its (listed) fields. */
  const expand = (path: string, spec: PropSpec, only?: readonly string[]) => {
    const header = spec.toggle ? `${path}.${spec.toggle}` : undefined;
    if (header) placed.add(header);
    placed.add(path);
    const names = only ?? Object.keys(spec.fields ?? {}).filter((n) => n !== spec.toggle);
    const items = names.flatMap((name) => field(`${path}.${name}`) ?? []);
    return { title: spec.label ?? labelOf(path), header, items };
  };

  const item = (entry: LayoutItem, prefix: string, depth: number): ResolvedItem[] => {
    if (typeof entry === "string") {
      const path = prefix + entry;
      const spec = groupSpec(path);
      if (!spec) return [field(path)].flatMap((i) => i ?? []);
      const sub = expand(path, spec);
      return depth > 0 ? issueFlat(sub.title, sub.items) : [{ type: "sub", ...sub }];
    }
    if ("path" in entry) return [field(prefix + entry.path, entry)].flatMap((i) => i ?? []);
    if ("row" in entry) {
      return [{ type: "row", items: entry.row.flatMap((e) => item(e, prefix, depth + 1)) }];
    }
    if ("command" in entry) return [{ type: "command", id: entry.command, ...pick(entry) }];
    if ("group" in entry) {
      const path = prefix + entry.group;
      const spec = groupSpec(path);
      if (!spec) {
        issue(`path "${path}" does not exist`);
        return [];
      }
      const sub = expand(path, spec, entry.items);
      return depth > 0 ? issueFlat(sub.title, sub.items) : [{ type: "sub", ...sub }];
    }
    const items = entry.items.flatMap((e) => item(e, prefix, depth + 1));
    return depth > 0 ? issueFlat(entry.title, items) : [{ type: "sub", title: entry.title, items }];
  };

  const issueFlat = (title: string, items: ResolvedItem[]) => {
    issue(`sub-sections can't nest; "${title}" is shown flat`);
    return items;
  };

  const section = (
    s: LayoutSection,
    prefix: string,
    key: string,
    order: number,
  ): ResolvedSection => {
    where = `, section "${s.title ?? key}"`;
    const base = { key, order: s.order ?? order, layout: s.layout ?? "section" };
    const only = s.items.length === 1 && typeof s.items[0] === "string" ? s.items[0] : undefined;
    const spec = only !== undefined ? groupSpec(prefix + only) : undefined;
    if (only !== undefined && spec) {
      const taken = expand(prefix + only, spec);
      return { ...base, ...taken, title: s.title ?? taken.title };
    }
    const items = s.items.flatMap((entry) => item(entry, prefix, 0));
    return { ...base, title: s.title ?? "", items };
  };

  const own = definition.layout ?? generated(element);
  const sections = own.map((s, i) => section(s, "", `s${i}`, (i + 1) * 10));
  where = "";
  for (const group of groups) {
    if (placed.has(group.key)) continue;
    const layout = group.layout ?? { title: group.label, items: Object.keys(group.properties) };
    const items = layout.items.filter(
      (e) => typeof e !== "string" || !placed.has(`${group.key}.${e}`),
    );
    const built = section({ ...layout, items }, `${group.key}.`, group.id, group.order);
    where = "";
    if (built.items.length > 0) sections.push({ ...built, title: built.title || group.label });
  }

  const forgotten = [...fields.entries()].filter(
    ([path, spec]) =>
      !spec.hidden &&
      spec.kind !== "group" &&
      !placed.has(path) &&
      !groups.some((g) => path.startsWith(`${g.key}.`)),
  );
  if (forgotten.length > 0) {
    for (const [path] of forgotten) issue(`property "${path}" is not placed`);
    const items = forgotten.flatMap(([path]) => field(path) ?? []);
    sections.push({ key: "other", title: "Other", order: OTHER_ORDER, layout: "section", items });
  }
  return { sections: sections.sort((a, b) => a.order - b.order), issues };
}

function pick(entry: { control?: string; label?: string; icon?: string }) {
  return {
    ...(entry.control !== undefined && { control: entry.control }),
    ...(entry.label !== undefined && { label: entry.label }),
    ...(entry.icon !== undefined && { icon: entry.icon }),
  };
}

/** The layout of an element that declares none: General, then one section per group. */
function generated(element: ResolvedElement): LayoutSection[] {
  const entries = Object.entries(element.definition.properties).filter(
    ([name, spec]) => !name.includes(".") && !spec.hidden,
  );
  const plain = entries.filter(([, spec]) => spec.kind !== "group").map(([name]) => name);
  const groupSections = entries
    .filter(([, spec]) => spec.kind === "group")
    .map(([name], i) => ({ order: (i + 1) * 10, items: [name] }));
  return [
    ...(plain.length > 0 ? [{ title: "General", order: 0, items: plain }] : []),
    ...groupSections,
  ];
}
