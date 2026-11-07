import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar/Sidebar';
import { Header } from '../Header/Header';
import s from './AppLayout.module.scss';
import { LocaleContext, type Locale } from '@/app/locale';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem('staff-locale') as Locale) || 'en');
  const changeLocale = (next: Locale) => { setLocale(next); localStorage.setItem('staff-locale', next); };
  return (
    <LocaleContext.Provider value={{ locale, setLocale: changeLocale }}>
      <div className={`${s.layout} ${collapsed ? s.collapsed : ''}`}>
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggle={() => setCollapsed((value) => !value)} onNavigate={() => setMobileOpen(false)} />
        {mobileOpen && <button className={s.backdrop} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
        <div className={s.main}>
          <Header onMenuClick={() => { if (window.matchMedia?.('(max-width: 992px)').matches) setMobileOpen((value) => !value); else setCollapsed((value) => !value); }} />
          <div className={s.content}>
            <Outlet />
          </div>
        </div>
      </div>
    </LocaleContext.Provider>
  );
}
