import { createContext, useContext } from "react";

/** True inside a labelled row: fields there share its label and draw only their control. */
export const FieldInlineContext = createContext(false);

/** Whether this field sits in a labelled row. */
export const useFieldInline = () => useContext(FieldInlineContext);
