import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import s from './Input.module.scss';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...rest }, ref) => (
    <input
      ref={ref}
      className={clsx(s.input, error && s.error, className)}
      {...rest}
    />
  ),
);

Input.displayName = 'Input';
