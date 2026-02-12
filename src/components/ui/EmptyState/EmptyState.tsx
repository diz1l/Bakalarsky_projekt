import s from './EmptyState.module.scss';

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export function EmptyState({ title = 'Nothing here', message = 'No data to display.' }: EmptyStateProps) {
  return (
    <div className={s.wrapper}>
      <div className={s.icon}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4M4 7l8 4M4 7v10l8 4m0-10v10" />
        </svg>
      </div>
      <h3 className={s.title}>{title}</h3>
      <p className={s.msg}>{message}</p>
    </div>
  );
}
