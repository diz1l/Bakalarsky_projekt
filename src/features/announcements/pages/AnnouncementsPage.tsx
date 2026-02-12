import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCreateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useGetAnnouncementsQuery,
  useToggleAnnouncementDoneMutation,
} from '../api/announcementsApi';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button/Button';
import { Modal } from '@/components/ui/Modal/Modal';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { Badge } from '@/components/ui/Badge/Badge';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Loader } from '@/components/ui/Loader/Loader';
import clsx from 'clsx';
import s from './AnnouncementsPage.module.scss';

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  priority: z.enum(['low', 'medium', 'high']),
});

type FormData = z.infer<typeof schema>;
type Filter = 'all' | 'active' | 'completed';

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const prioVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

export function AnnouncementsPage() {
  const { can } = usePermissions();
  const canCreate = can('announcements.create');
  const canManage = can('announcements.manage');
  const { showToast } = useToast();

  const { data: announcements, isLoading } = useGetAnnouncementsQuery();
  const [create, { isLoading: creating }] = useCreateAnnouncementMutation();
  const [toggleDone, { isLoading: toggling }] = useToggleAnnouncementDoneMutation();
  const [remove, { isLoading: deleting }] = useDeleteAnnouncementMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', content: '', priority: 'medium' },
  });

  const filtered = useMemo(() => {
    const items = announcements ?? [];
    if (filter === 'active') return items.filter((item) => !item.completed);
    if (filter === 'completed') return items.filter((item) => item.completed);
    return items;
  }, [announcements, filter]);

  const onSubmit = async (data: FormData) => {
    try {
      await create(data).unwrap();
      showToast('Announcement created', 'success');
      setModalOpen(false);
      reset();
    } catch {
      showToast('Failed to create announcement', 'error');
    }
  };

  const onToggleDone = async (id: string, completed: boolean) => {
    try {
      await toggleDone({ id, completed }).unwrap();
      showToast(completed ? 'Marked as completed' : 'Marked as active', 'success');
    } catch {
      showToast('Failed to update announcement', 'error');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;

    try {
      await remove(id).unwrap();
      showToast('Announcement deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  if (isLoading) return <Loader />;

  return (
    <div>
      <div className={s.toolbar}>
        <h1>Announcements</h1>

        <div className={s.toolbarRight}>
          <div className={s.filters}>
            <button
              className={clsx(s.filterBtn, filter === 'all' && s.activeFilter)}
              onClick={() => setFilter('all')}
              type="button"
            >
              All
            </button>
            <button
              className={clsx(s.filterBtn, filter === 'active' && s.activeFilter)}
              onClick={() => setFilter('active')}
              type="button"
            >
              Active
            </button>
            <button
              className={clsx(s.filterBtn, filter === 'completed' && s.activeFilter)}
              onClick={() => setFilter('completed')}
              type="button"
            >
              Completed
            </button>
          </div>

          {canCreate && (
            <Button onClick={() => { reset(); setModalOpen(true); }}>New Announcement</Button>
          )}
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState title="No announcements" message="Nothing has been posted yet." />
      ) : (
        <div className={s.list}>
          {filtered.map((item) => (
            <article key={item.id} className={clsx(s.card, item.completed && s.completed)}>
              <div className={s.cardHeader}>
                <h3 className={clsx(item.completed && s.completedTitle)}>{item.title}</h3>
                <div className={s.headerBadges}>
                  <Badge variant={prioVariant[item.priority]}>{item.priority}</Badge>
                  {item.completed && <Badge variant="default">completed</Badge>}
                </div>
              </div>

              <p className={s.content}>{item.content}</p>

              <div className={s.meta}>
                <span>{item.authorName}</span>
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>

              {canManage && (
                <div className={s.actions}>
                  <label className={s.doneToggle}>
                    <input
                      aria-label={`mark-done-${item.id}`}
                      type="checkbox"
                      checked={item.completed}
                      disabled={toggling || deleting}
                      onChange={(event) => {
                        void onToggleDone(item.id, event.target.checked);
                      }}
                    />
                    Mark as done
                  </label>

                  <Button
                    aria-label={`delete-announcement-${item.id}`}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void onDelete(item.id);
                    }}
                    loading={deleting}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Announcement">
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Title" error={errors.title?.message} required>
            <Input {...register('title')} error={!!errors.title} />
          </FormField>
          <FormField label="Content" error={errors.content?.message} required>
            <Input {...register('content')} error={!!errors.content} />
          </FormField>
          <FormField label="Priority" error={errors.priority?.message}>
            <Select options={PRIORITIES} {...register('priority')} error={!!errors.priority} />
          </FormField>
          <div className={s.formActions}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
