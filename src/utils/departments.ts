export const SHIFT_DEPARTMENTS = ['Front Desk', 'Housekeeping', 'Restaurant', 'Maintenance'];
export const DEPARTMENTS = [...SHIFT_DEPARTMENTS, 'Management'];

export const toOptions = (values: string[], translate: (key: string) => string = (key) => key) =>
  values.map((value) => ({ value, label: translate(value) }));
