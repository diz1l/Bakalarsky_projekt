import clsx from 'clsx';
import s from './Badge.module.scss';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return <span className={clsx(s.badge, s[variant])}>{children}</span>;
}
