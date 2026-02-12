import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import s from './Header.module.scss';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className={s.header}>
      <div className={s.left} />
      <div className={s.right}>
        <Badge variant="info">{user?.role}</Badge>
        <span className={s.name}>{user?.name}</span>
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
