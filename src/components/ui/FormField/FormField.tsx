import type { ReactNode } from 'react';
import s from './FormField.module.scss';

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}

export function FormField({ label, error, children, required }: FormFieldProps) {
  return (
    <div className={s.field}>
      <label className={s.label}>
        {label}
        {required && <span className={s.req}>*</span>}
      </label>
      {children}
      {error && <span className={s.error}>{error}</span>}
    </div>
  );
}
