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
import s from './NotificationsPage.module.scss';

const typeIcon: Record<string, string> = {
  info: 'i',
  warning: '!',
  success: 'ok',
  error: 'x',
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
        <div className={s.toolbar}><h1>Notifications</h1></div>
        <EmptyState title="Unable to load notifications" message="Check your connection and try again." />
        <div className={s.retry}>
          <Button variant="secondary" onClick={() => void refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={s.toolbar}>
        <h1>Notifications</h1>

        {canManage && (
          <div className={s.toolbarActions}>
            {unread.length > 0 && (
              <Button variant="secondary" size="sm" onClick={handleMarkAllRead} loading={markingAll}>
                Mark all as read ({unread.length})
              </Button>
            )}
            {!!notifications?.length && (
              <Button variant="ghost" size="sm" onClick={handleClearAll} loading={clearing}>
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      {!notifications?.length ? (
        <EmptyState title="No notifications" message="You're all caught up!" />
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
                <div className={s.time}>{new Date(item.createdAt).toLocaleString()}</div>
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
                  Mark read
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? 'Notification details'}
        size="sm"
      >
        {selected && (
          <div className={s.details}>
            <p className={s.detailMessage}>{selected.message}</p>
            <div className={s.detailGrid}>
              <span>Timestamp</span>
              <strong>{new Date(selected.createdAt).toLocaleString()}</strong>
              <span>Sender</span>
              <strong>{selected.senderName}</strong>
              <span>Sender email</span>
              <strong>{selected.senderEmail}</strong>
              <span>Related type</span>
              <strong>{selected.relatedType ?? 'N/A'}</strong>
              <span>Related ID</span>
              <strong>{selected.relatedId ?? 'N/A'}</strong>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
