import { cloneElement, isValidElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import s from './FormField.module.scss';

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}

export function FormField({ label, error, children, required }: FormFieldProps) {
  const generatedId = useId();
  const child = isValidElement<{ id?: string }>(children) ? (children as ReactElement<{ id?: string }>) : null;
  const controlId = child?.props.id ?? generatedId;

  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={child ? controlId : undefined}>
        {label}
        {required && <span className={s.req}>*</span>}
      </label>
      {child ? cloneElement(child, { id: controlId }) : children}
      {error && <span className={s.error}>{error}</span>}
    </div>
  );
}
