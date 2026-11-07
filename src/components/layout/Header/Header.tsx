import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import s from './Header.module.scss';
import { useLocale } from '@/app/locale';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { t } = useLocale();

  return (
    <header className={s.header}>
      <div className={s.left}><button className={s.menu} onClick={onMenuClick} aria-label="Toggle sidebar">☰</button></div>
      <div className={s.right}>
        <Badge variant="info">{user?.role}</Badge>
        <span className={s.name}>{user?.name}</span>
        <Button variant="ghost" size="sm" onClick={logout}>
          {t('Sign out')}
        </Button>
      </div>
    </header>
  );
}
