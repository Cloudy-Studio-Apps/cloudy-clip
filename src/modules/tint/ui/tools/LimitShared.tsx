import { useMemo } from "react";
import type { GradeLimit } from "@/modules/project";
import { SelectField } from "@/ui";
import { keyChoices } from "../../logic/keys";
import { numberOf } from "../../logic/stack";
import { useEditTarget } from "../edit.target.hook";
import { InfoTip } from "../InfoTip";
import type { LimitEdit } from "../ui.types";

const OWN = "";

/**
 * "Use the pick of": the limited corrections above this one, whose pick (its colors, brightness,
 * softness and clean up) this one can use instead of its own; or Own pick. Shown when there is a
 * choice, or a shared pick is set.
 */
export function LimitShared({ edit }: { edit: LimitEdit }) {
  const { grade } = useEditTarget();
  const { nodeId, limit } = edit;
  const numbers = useMemo(() => numberOf(grade), [grade]);
  const choices = useMemo(
    () => (grade && nodeId ? keyChoices(grade, nodeId, Object.keys(numbers)) : []),
    [grade, nodeId, numbers],
  );
  const from = limit?.from;
  if (choices.length === 0 && from === undefined) return null;
  const name = (id: string) => {
    const node = grade?.nodes[id];
    return `${numbers[id] ?? ""} ${(node?.kind === "correct" && node.name) || "Correction"}`.trim();
  };
  const options = [
    { value: OWN, label: "Own pick" },
    ...[...choices, ...(from !== undefined && !choices.includes(from) ? [from] : [])].map((id) => ({
      value: id,
      label: name(id),
    })),
  ];
  return (
    <div className="mb-4 flex max-w-[460px] items-center gap-2">
      <span className="shrink-0 text-base whitespace-nowrap text-muted-foreground">
        Use the pick of
      </span>
      <InfoTip text="Use what another correction above picked, so both change the same part of the picture. Invert here changes everything else instead." />
      <SelectField
        label="Use the pick of"
        value={from ?? OWN}
        options={options}
        disabled={!edit.enabled || !nodeId}
        onChange={(value) => {
          const next: GradeLimit = { ...limit };
          if (value === OWN) delete next.from;
          else next.from = value;
          edit.commit(next);
        }}
        className="flex-1"
      />
    </div>
  );
}
