/** Demo data the page is drawn from until the grade lives in the project. */

export interface DemoLook {
  id: string;
  name: string;
  note: string;
  look: string;
}

/** A slider row of the demo tools. */
export interface DemoField {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}
