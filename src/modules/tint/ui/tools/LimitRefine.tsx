import { Eye } from "lucide-react";
import type { GradeLimit } from "@/modules/project";
import { Button } from "@/ui";
import type { LimitEdit } from "../ui.types";
import { useTintView } from "../view.hook";
import { useTintSet } from "../view.set.hook";
import { LimitSlider } from "./LimitSlider";
import { ToolColumn } from "./ToolColumn";

/** Refine: soften and clean up the edge of what is kept, show it, invert it. */
export function LimitRefine({ edit }: { edit: LimitEdit }) {
  const showing = useTintView((v) => v.showPicked !== null && v.showPicked === edit.nodeId);
  const set = useTintSet();
  const { limit } = edit;
  const refine = limit?.refine ?? { soft: 0, clean: 0 };
  const withRefine = (patch: Partial<typeof refine>): GradeLimit => ({
    ...limit,
    refine: { ...refine, ...patch },
  });
  const inverted = limit?.invert === true;
  return (
    <ToolColumn title="Refine" info="Soften and clean the edge of what was picked, then check it.">
      <LimitSlider
        label="Softness"
        value={refine.soft}
        resetTo={0}
        edit={edit}
        limitWith={(soft) => withRefine({ soft })}
      />
      <LimitSlider
        label="Clean up"
        value={refine.clean}
        resetTo={0}
        edit={edit}
        limitWith={(clean) => withRefine({ clean })}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!edit.enabled || !edit.nodeId}
          aria-pressed={showing}
          className={showing ? "bg-muted" : undefined}
          title="Show what is kept: kept areas white, the rest black (in the viewer only)"
          onClick={() => set({ showPicked: showing ? null : edit.nodeId })}
        >
          <Eye /> {showing ? "Showing" : "Show"}
        </Button>
        <Button
          size="sm"
          disabled={!edit.enabled}
          aria-pressed={inverted}
          className={inverted ? "bg-muted" : undefined}
          title="Invert: change everything except what was picked"
          onClick={() => {
            const next: GradeLimit = { ...limit };
            if (inverted) delete next.invert;
            else next.invert = true;
            edit.commit(next);
          }}
        >
          Invert
        </Button>
      </div>
    </ToolColumn>
  );
}
