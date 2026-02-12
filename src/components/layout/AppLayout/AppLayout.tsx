import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar/Sidebar';
import { Header } from '../Header/Header';
import s from './AppLayout.module.scss';

export function AppLayout() {
  return (
    <div className={s.layout}>
      <Sidebar />
      <div className={s.main}>
        <Header />
        <div className={s.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
