import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import s from './Button.module.scss';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(s.btn, s[variant], s[size], loading && s.loading, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className={s.spinner} />}
      {icon && !loading && <span className={s.icon}>{icon}</span>}
      {children}
    </button>
  );
}
