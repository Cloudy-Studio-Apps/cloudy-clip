import { Trash2 } from "lucide-react";
import { useStore } from "zustand";
import { report, useKernel, useModule } from "@/core";
import { Button } from "@/ui";
import { removeStyle } from "../subtitle.style.commands";
import { subtitleRef } from "../subtitle.ref";
import { NewStyleMenu } from "./NewStyleMenu";
import { StyleEditor } from "./StyleEditor";
import { StyleList } from "./StyleList";
import { useStyles } from "./styles.hook";

/** The Style tab: the composition's styles, New style and Remove, then the selected style's values. */
export function StyleTab() {
  const { bus } = useKernel();
  const { view } = useModule(subtitleRef);
  const styleId = useStore(view, (s) => s.styleId);
  const { compositionId, styles } = useStyles();
  if (!compositionId) return null;
  const style = styles.find((s) => s.id === styleId) ?? styles[0];
  const select = (id: string) => view.setState({ styleId: id, tab: "style" });

  return (
    <>
      <StyleList
        compositionId={compositionId}
        styles={styles}
        selectedId={style?.id}
        onSelect={select}
      />
      <div className="flex flex-wrap gap-1.5 px-3 py-2">
        <NewStyleMenu compositionId={compositionId} current={style} onMade={select} />
        <Button
          size="sm"
          disabled={!style || styles.length < 2}
          title={styles.length < 2 ? "A composition keeps at least one style" : undefined}
          onClick={() =>
            style &&
            void bus.run(removeStyle, { styleId: style.id }).then((result) => {
              if (report(result)) view.setState({ styleId: null });
            })
          }
        >
          <Trash2 />
          Remove
        </Button>
      </div>
      {style ? (
        <StyleEditor key={style.id} style={style} />
      ) : (
        <p className="px-3 py-2 text-xs text-subtle-foreground">
          No styles yet. New style makes the first; marking a cue makes Default.
        </p>
      )}
    </>
  );
}
