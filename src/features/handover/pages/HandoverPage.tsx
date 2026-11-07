import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import {
  useAcknowledgeHandoverMutation,
  useCreateHandoverNoteMutation,
  useDeleteHandoverNoteMutation,
  useGetHandoverNotesQuery,
  useUpdateHandoverNoteMutation,
  type HandoverScope,
} from '../api/handoverApi';
import { needsMyAttention } from '../handoverUtils';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale } from '@/app/locale';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Modal } from '@/components/ui/Modal/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Loader } from '@/components/ui/Loader/Loader';
import { SHIFT_DEPARTMENTS, toOptions } from '@/utils/departments';
import { formatSlot, getCurrentSlot, getNextSlot } from '@/utils/shiftUtils';
import type { HandoverCategory, HandoverNote } from '@/types';
import s from './HandoverPage.module.scss';

const CATEGORIES: Record<HandoverCategory, { icon: string; label: string }> = {
  guests: { icon: '🛎', label: 'Guests' },
  rooms: { icon: '🛏', label: 'Rooms' },
  maintenance: { icon: '🔧', label: 'Maintenance' },
  cash: { icon: '💰', label: 'Cash' },
  security: { icon: '🛡', label: 'Security' },
  other: { icon: '📝', label: 'Other' },
};

const priorityVariant = { normal: 'default', important: 'warning', critical: 'danger' } as const;

const noteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  content: z.string().trim().min(1, 'Content is required'),
  category: z.enum(['guests', 'rooms', 'maintenance', 'cash', 'security', 'other']),
  priority: z.enum(['normal', 'important', 'critical']),
  department: z.string().min(1),
  requiresAction: z.boolean(),
  target: z.enum(['next', 'second', 'third']),
});
type NoteFormData = z.infer<typeof noteSchema>;

type Tab = 'mine' | 'active' | 'archive';

export function HandoverPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const canManage = can('handover.manage');

  const [tab, setTab] = useState<Tab>('mine');
  const scope: HandoverScope = tab === 'archive' ? 'archive' : 'active';
  const { data: notes = [], isLoading } = useGetHandoverNotesQuery(scope, { pollingInterval: 30_000 });
  const [createNote, { isLoading: creating }] = useCreateHandoverNoteMutation();
  const [updateNote] = useUpdateHandoverNoteMutation();
  const [deleteNote, { isLoading: removing }] = useDeleteHandoverNoteMutation();
  const [acknowledge, { isLoading: acknowledging }] = useAcknowledgeHandoverMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [actionNote, setActionNote] = useState<HandoverNote | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [deleting, setDeleting] = useState<HandoverNote | null>(null);

  const currentSlot = getCurrentSlot();
  const nextSlot = getNextSlot(currentSlot);
  const secondSlot = getNextSlot(nextSlot);
  const targets = { next: nextSlot, second: secondSlot, third: getNextSlot(secondSlot) };

  const mine = useMemo(() => notes.filter((note) => needsMyAttention(note, user?.id)), [notes, user?.id]);
  const visible = tab === 'mine' ? mine : notes;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
  });

  const openCreate = () => {
    reset({
      title: '',
      content: '',
      category: 'guests',
      priority: 'normal',
      department: 'ALL',
      requiresAction: false,
      target: 'next',
    });
    setModalOpen(true);
  };

  const errorMessage = (error: unknown) => (error as { data?: { message?: string } }).data?.message ?? t('Operation failed');

  const onSubmit = async ({ target, ...data }: NoteFormData) => {
    try {
      await createNote({ ...data, targetDate: targets[target].date, targetShiftType: targets[target].type }).unwrap();
      showToast(t('Information passed to the next shift'), 'success');
      setModalOpen(false);
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  };

  const toggleRead = async (note: HandoverNote, read: boolean) => {
    try {
      await acknowledge({ id: note.id, read }).unwrap();
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  };

  const confirmAction = async () => {
    if (!actionNote || !actionComment.trim()) return;
    try {
      await acknowledge({ id: actionNote.id, actionTaken: true, comment: actionComment.trim() }).unwrap();
      showToast(t('Thank you, action recorded'), 'success');
      setActionNote(null);
      setActionComment('');
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  };

  const setResolved = async (note: HandoverNote, resolved: boolean) => {
    try {
      await updateNote({ id: note.id, status: resolved ? 'resolved' : 'open' }).unwrap();
      showToast(resolved ? t('Moved to archive') : t('Reopened'), 'success');
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteNote(deleting.id).unwrap();
      setDeleting(null);
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  };

  const time = (value: string) =>
    new Date(value).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className={s.toolbar}>
        <div>
          <h1>{t('Shift handover')}</h1>
          <p className={s.subtitle}>{t('Now')}: {formatSlot(currentSlot, t, locale)} · {t('Next')}: {formatSlot(nextSlot, t, locale)}</p>
        </div>
        {can('handover.create') && <Button onClick={openCreate}>+ {t('Pass information')}</Button>}
      </div>

      <div className={s.tabs} role="tablist">
        <button role="tab" aria-selected={tab === 'mine'} className={clsx(s.tab, tab === 'mine' && s.activeTab)} onClick={() => setTab('mine')}>
          {t('Waiting for me')}
          {tab !== 'archive' && mine.length > 0 && <b className={s.count}>{mine.length}</b>}
        </button>
        <button role="tab" aria-selected={tab === 'active'} className={clsx(s.tab, tab === 'active' && s.activeTab)} onClick={() => setTab('active')}>{t('All active')}</button>
        <button role="tab" aria-selected={tab === 'archive'} className={clsx(s.tab, tab === 'archive' && s.activeTab)} onClick={() => setTab('archive')}>{t('Archive')}</button>
      </div>

      {isLoading ? (
        <Loader />
      ) : !visible.length ? (
        <EmptyState
          title={tab === 'mine' ? t('Nothing waiting for you') : t('No handover notes')}
          message={tab === 'mine' ? t('You have confirmed all information for your shift.') : t('Nothing has been passed on yet.')}
        />
      ) : (
        <div className={s.list}>
          {visible.map((note) => {
            const myAck = note.acknowledgements.find((ack) => ack.userId === user?.id);
            const isAuthor = note.authorId === user?.id;
            const pending = (note.expectedRecipients ?? []).filter(
              (recipient) => !note.acknowledgements.some((ack) => ack.userId === recipient.userId),
            );
            const canAck = can('handover.acknowledge') && !isAuthor && note.status !== 'resolved';
            return (
              <article key={note.id} className={clsx(s.card, s[note.priority], note.status === 'resolved' && s.resolved)} data-testid={`handover-${note.id}`}>
                <div className={s.cardHeader}>
                  <span className={s.categoryIcon} title={t(CATEGORIES[note.category].label)}>{CATEGORIES[note.category].icon}</span>
                  <div className={s.headerText}>
                    <h3>{note.title}</h3>
                    <div className={s.meta}>
                      {note.authorName} · {time(note.createdAt)} · {formatSlot({ date: note.date, type: note.shiftType }, t, locale)} → <strong>{formatSlot({ date: note.targetDate, type: note.targetShiftType }, t, locale)}</strong>
                    </div>
                  </div>
                  <div className={s.badges}>
                    <Badge variant={priorityVariant[note.priority]}>{t(note.priority)}</Badge>
                    <Badge variant="info">{note.department === 'ALL' ? t('All departments') : t(note.department)}</Badge>
                    {note.requiresAction && <Badge variant="warning">{t('Action required')}</Badge>}
                    <Badge variant={note.status === 'open' ? 'danger' : note.status === 'acknowledged' ? 'success' : 'default'}>{t(`status.${note.status}`)}</Badge>
                  </div>
                </div>

                <p className={s.content}>{note.content}</p>

                {canAck && (
                  <div className={s.ackRow}>
                    <label className={s.ackCheck}>
                      <input type="checkbox" checked={!!myAck} disabled={acknowledging || !!myAck?.actionTakenAt} onChange={(event) => void toggleRead(note, event.target.checked)} />
                      {t('I have read this')}
                    </label>
                    {note.requiresAction && (
                      <label className={s.ackCheck}>
                        <input
                          type="checkbox"
                          checked={!!myAck?.actionTakenAt}
                          disabled={acknowledging}
                          onChange={(event) => {
                            if (event.target.checked) { setActionNote(note); setActionComment(''); }
                            else void acknowledge({ id: note.id, actionTaken: false });
                          }}
                        />
                        {t('Action taken')}
                      </label>
                    )}
                  </div>
                )}

                <div className={s.acks}>
                  {note.acknowledgements.map((ack) => (
                    <span key={ack.userId} className={clsx(s.ack, ack.actionTakenAt && s.ackAction)} title={ack.comment}>
                      ✓ {ack.userName} · {time(ack.actionTakenAt ?? ack.readAt)}
                      {ack.comment && <em> — {ack.comment}</em>}
                    </span>
                  ))}
                  {note.status !== 'resolved' && pending.map((recipient) => (
                    <span key={recipient.userId} className={clsx(s.ack, s.ackPending)}>○ {recipient.name}</span>
                  ))}
                </div>

                {(canManage || isAuthor) && (
                  <div className={s.cardActions}>
                    {note.status === 'resolved' ? (
                      <>
                        <span className={s.meta}>{t('Closed by')} {note.resolvedBy} · {note.resolvedAt && time(note.resolvedAt)}</span>
                        <Button variant="ghost" size="sm" onClick={() => void setResolved(note, false)}>{t('Reopen')}</Button>
                      </>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => void setResolved(note, true)}>{t('Close and archive')}</Button>
                    )}
                    {(canManage || !note.acknowledgements.length) && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(note)}>{t('Delete')}</Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('Pass information to the next shift')} size="lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label={t('Title')} error={errors.title && t(errors.title.message ?? '')} required>
            <Input placeholder={t('e.g. Water leak in room 312')} {...register('title')} error={!!errors.title} />
          </FormField>
          <FormField label={t('What should the next shift know?')} error={errors.content && t(errors.content.message ?? '')} required>
            <Textarea rows={5} {...register('content')} error={!!errors.content} />
          </FormField>
          <div className={s.formRow}>
            <FormField label={t('Category')}>
              <Select {...register('category')} options={Object.entries(CATEGORIES).map(([value, category]) => ({ value, label: `${category.icon} ${t(category.label)}` }))} />
            </FormField>
            <FormField label={t('Priority')}>
              <Select {...register('priority')} options={[{ value: 'normal', label: t('normal') }, { value: 'important', label: t('important') }, { value: 'critical', label: t('critical') }]} />
            </FormField>
          </div>
          <div className={s.formRow}>
            <FormField label={t('Department')}>
              <Select {...register('department')} options={[{ value: 'ALL', label: t('All departments') }, ...toOptions(SHIFT_DEPARTMENTS, t)]} />
            </FormField>
            <FormField label={t('For which shift')}>
              <Select
                {...register('target')}
                options={[
                  { value: 'next', label: `${t('Next shift')} — ${formatSlot(nextSlot, t, locale)}` },
                  { value: 'second', label: formatSlot(targets.second, t, locale) },
                  { value: 'third', label: formatSlot(targets.third, t, locale) },
                ]}
              />
            </FormField>
          </div>
          <label className={s.ackCheck}>
            <input type="checkbox" {...register('requiresAction')} />
            {t('The next shift must take action (not just read)')}
          </label>
          <div className={s.formActions}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" loading={creating}>{t('Pass on')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!actionNote} onClose={() => setActionNote(null)} title={t('What was done?')} size="sm">
        <p className={s.modalText}>{actionNote?.title}</p>
        <FormField label={t('Describe the action taken')} required>
          <Textarea rows={3} value={actionComment} onChange={(event) => setActionComment(event.target.value)} />
        </FormField>
        <div className={s.formActions}>
          <Button variant="secondary" type="button" onClick={() => setActionNote(null)}>{t('Cancel')}</Button>
          <Button type="button" onClick={() => void confirmAction()} disabled={!actionComment.trim()} loading={acknowledging}>{t('Confirm')}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        title={t('Delete handover note?')}
        message={deleting?.title ?? ''}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        loading={removing}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
