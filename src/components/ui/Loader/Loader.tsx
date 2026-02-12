import clsx from 'clsx';
import s from './Loader.module.scss';

interface LoaderProps {
  fullScreen?: boolean;
}

export function Loader({ fullScreen }: LoaderProps) {
  return (
    <div className={clsx(s.wrapper, fullScreen && s.fullScreen)}>
      <div className={s.spinner} />
    </div>
  );
}
