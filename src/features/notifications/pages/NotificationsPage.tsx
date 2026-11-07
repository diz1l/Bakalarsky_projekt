import { useMemo, useState } from 'react';
import {
  useClearAllNotificationsMutation,
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkReadMutation,
} from '../api/notificationsApi';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button/Button';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Loader } from '@/components/ui/Loader/Loader';
import { Modal } from '@/components/ui/Modal/Modal';
import type { Notification } from '@/types';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import s from './NotificationsPage.module.scss';
import { useLocale } from '@/app/locale';

const typeIcon: Record<string, string> = {
  info: 'i',
  warning: '!',
  success: 'ok',
  error: 'x',
};

const relatedPaths: Record<string, string> = {
  shift: '/shifts', task: '/tasks', handover: '/handover', announcement: '/announcements', employee: '/employees',
};

export function NotificationsPage() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const canManage = can('notifications.manage');
  const { data: notifications, isLoading, isError, refetch } = useGetNotificationsQuery(user?.id ?? '');
  const [markRead] = useMarkReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const [clearAll, { isLoading: clearing }] = useClearAllNotificationsMutation();
  const { showToast } = useToast();
  const { locale, t } = useLocale();
  const [selected, setSelected] = useState<Notification | null>(null);

  const unread = useMemo(() => notifications?.filter((item) => !item.read) ?? [], [notifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await markRead(id).unwrap();
    } catch {
      showToast('Failed to mark as read', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead().unwrap();
      showToast('All marked as read', 'success');
    } catch {
      showToast('Unable to mark all as read', 'error');
    }
  };

  const openNotification = (item: Notification) => {
    setSelected(item);
    if (canManage && !item.read) void handleMarkRead(item.id);
  };

  const handleClearAll = async () => {
    try {
      await clearAll().unwrap();
      showToast('All notifications cleared', 'success');
      setSelected(null);
    } catch {
      showToast('Unable to clear notifications', 'error');
    }
  };

  if (isLoading) return <Loader />;

  if (isError) {
    return (
      <div>
        <div className={s.toolbar}><h1>{t('Notifications')}</h1></div>
        <EmptyState title={t('Unable to load notifications')} message={t('Check your connection and try again.')} />
        <div className={s.retry}>
          <Button variant="secondary" onClick={() => void refetch()}>{t('Try again')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={s.toolbar}>
        <h1>{t('Notifications')}</h1>

        {canManage && (
          <div className={s.toolbarActions}>
            {unread.length > 0 && (
              <Button variant="secondary" size="sm" onClick={handleMarkAllRead} loading={markingAll}>
                {t('Mark all as read')} ({unread.length})
              </Button>
            )}
            {!!notifications?.length && (
              <Button variant="ghost" size="sm" onClick={handleClearAll} loading={clearing}>
                {t('Clear all')}
              </Button>
            )}
          </div>
        )}
      </div>

      {!notifications?.length ? (
        <EmptyState title={t('No notifications')} message={t("You're all caught up!")} />
      ) : (
        <div className={s.list}>
          {notifications.map((item) => (
            <div
              key={item.id}
              data-testid={`notification-card-${item.id}`}
              className={clsx(s.card, !item.read && s.unread)}
              onClick={() => openNotification(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openNotification(item);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className={clsx(s.icon, s[item.type])}>{typeIcon[item.type]}</div>
              <div className={s.body}>
                <div className={s.title}>{item.title}</div>
                <div className={s.msg}>{item.message}</div>
                <div className={s.time}>{new Date(item.createdAt).toLocaleString(locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US')}</div>
              </div>
              {canManage && !item.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleMarkRead(item.id);
                  }}
                >
                  {t('Mark read')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? t('Notification details')}
        size="sm"
      >
        {selected && (
          <div className={s.details}>
            <p className={s.detailMessage}>{selected.message}</p>
            <div className={s.detailGrid}>
              <span>{t('Timestamp')}</span>
              <strong>{new Date(selected.createdAt).toLocaleString(locale === 'cs' ? 'cs-CZ' : locale === 'ru' ? 'ru-RU' : 'en-US')}</strong>
              <span>{t('Sender')}</span>
              <strong>{selected.senderName}</strong>
              <span>{t('Sender email')}</span>
              <strong>{selected.senderEmail}</strong>
              {selected.relatedType && selected.relatedId && relatedPaths[selected.relatedType] && <><span>{t('Related item')}</span><strong><Link to={relatedPaths[selected.relatedType]} onClick={() => setSelected(null)}>{t('Open')} {t(selected.relatedType)}</Link></strong></>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
