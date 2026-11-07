import { NavLink } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/utils/permissions';
import clsx from 'clsx';
import s from './Sidebar.module.scss';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetNotificationsQuery } from '@/features/notifications/api/notificationsApi';
import { useLocale, type Locale } from '@/app/locale';
import { useGetHandoverNotesQuery } from '@/features/handover/api/handoverApi';
import { needsMyAttention } from '@/features/handover/handoverUtils';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  path: string;
  label: string;
  permission: Permission;
  icon: React.ReactNode;
}

const Icon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    permission: 'dashboard.view',
    icon: <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  },
  {
    path: '/employees',
    label: 'Employees',
    permission: 'employees.view',
    icon: <Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  },
  {
    path: '/shifts',
    label: 'Shifts',
    permission: 'shifts.view',
    icon: <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  },
  {
    path: '/tasks',
    label: 'Shift tasks',
    permission: 'tasks.view',
    icon: <Icon d="M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" />,
  },
  {
    path: '/handover',
    label: 'Shift handover',
    permission: 'handover.view',
    icon: <Icon d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />,
  },
  {
    path: '/announcements',
    label: 'Announcements',
    permission: 'announcements.view',
    icon: <Icon d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />,
  },
  {
    path: '/profile',
    label: 'Profile',
    permission: 'profile.view',
    icon: <Icon d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 7a4 4 0 100-8 4 4 0 000 8" />,
  },
];

export function Sidebar({ collapsed, mobileOpen, onToggle, onNavigate }: { collapsed: boolean; mobileOpen: boolean; onToggle: () => void; onNavigate: () => void }) {
  const { can } = usePermissions();
  const { user } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const [dark, setDark] = useState(() => localStorage.getItem('staff-theme') === 'dark');
  const { data: notifications = [] } = useGetNotificationsQuery(user?.id ?? '', { pollingInterval: 30_000, refetchOnFocus: true, refetchOnReconnect: true });
  const unreadCount = notifications.filter((item) => !item.read).length;
  const { data: handoverNotes = [] } = useGetHandoverNotesQuery('active', { pollingInterval: 30_000, skip: !can('handover.view') });
  const handoverCount = handoverNotes.filter((note) => needsMyAttention(note, user?.id)).length;
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('staff-theme', dark ? 'dark' : 'light'); }, [dark]);

  return (
    <aside className={`${s.sidebar} ${collapsed ? s.collapsed : ''} ${mobileOpen ? s.mobileOpen : ''}`}>
      <div className={s.brand}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7H3l2-4h14l2 4M5 21V10.87M19 21V10.87" />
        </svg>
        <span>Staff Manager</span>
      </div>

      <nav className={s.nav}>
        {navItems.filter((item) => can(item.permission)).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => { if (window.matchMedia?.('(max-width: 992px)').matches) onNavigate(); }}
            className={({ isActive }) => clsx(s.link, isActive && s.active)}
          >
            {item.icon}
            <span>{t(item.label)}</span>
            {item.path === '/handover' && handoverCount > 0 && <b className={s.navBadge} aria-label={`${handoverCount} unread`}>{handoverCount}</b>}
          </NavLink>
        ))}
      </nav>
      <div className={s.bottom}>
        {can('notifications.view') && <Link to="/notifications" onClick={() => { if (window.matchMedia?.('(max-width: 992px)').matches) onNavigate(); }} className={s.bottomLink} title={t('Notifications')}><Icon d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /><span>{t('Notifications')}</span>{unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}</Link>}
        <button className={s.bottomLink} onClick={() => setDark((value) => !value)} title={t(dark ? 'Light' : 'Dark')}><span className={s.controlIcon}>{dark ? '☀' : '☾'}</span><span>{t(dark ? 'Light' : 'Dark')}</span></button>
        <label className={s.language}><span className={s.controlIcon}>文</span><span>{t('Language')}</span><select aria-label={t('Language')} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">EN</option><option value="cs">CS</option><option value="ru">RU</option></select></label>
        <button className={s.collapse} onClick={() => { if (window.matchMedia?.('(max-width: 992px)').matches) onNavigate(); else onToggle(); }} aria-label={t(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}>{collapsed ? '›' : '‹'}<span>{collapsed ? t('Expand sidebar') : t('Collapse sidebar')}</span></button>
      </div>
    </aside>
  );
}
