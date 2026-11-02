import { useMemo } from "react";
import { useModule } from "@/core";
import { elementRef, type ResolvedElement, type ResolvedSection } from "@/modules/element";
import { useOpenFormat } from "@/modules/project";
import type { InspectorMember } from "../inspector.types";
import { CommandItem } from "./CommandItem";
import { PropertySection } from "./PropertySection";
import { useClipAtPlayhead } from "./clip.values.hook";
import { usePropsLive } from "./props.live.hook";

interface ClipSectionProps {
  member: InspectorMember;
  source: ResolvedElement;
  section: ResolvedSection;
}

/** One section of a clip's element. Values are resolved once per clip change; drags only redraw the preview. */
export function ClipSection({ member, source, section }: ClipSectionProps) {
  const { clip } = member;
  const elements = useModule(elementRef);
  const format = useOpenFormat();
  const live = usePropsLive(clip);
  const shown = useClipAtPlayhead(clip);
  const values = useMemo(() => elements.resolve(shown, format), [elements, shown, format]);
  const defaults = useMemo(
    () => elements.defaults(clip.kind, format),
    [elements, clip.kind, format],
  );
  return (
    <PropertySection
      subject={clip}
      source={source}
      section={section}
      values={values}
      defaults={defaults}
      live={live}
      renderCommand={(item, index) => (
        <CommandItem key={`${item.id}:${index}`} item={item} clip={clip} />
      )}
    />
  );
}
