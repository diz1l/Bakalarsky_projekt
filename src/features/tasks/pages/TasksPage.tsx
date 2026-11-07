import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useGetTasksQuery,
  useUpdateTaskMutation,
  useUpdateTasksBulkMutation,
} from '../api/tasksApi';
import { CHECKLIST_SECTIONS } from '../checklist';
import { TaskTemplatesPanel } from './TaskTemplatesPanel';
import { useGetEmployeesQuery } from '@/features/employees/api/employeesApi';
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
import {
  compareSlots,
  formatSlot,
  getCurrentSlot,
  getNextSlot,
  getPreviousSlot,
  isSameSlot,
  slotTimeToDate,
  type ShiftSlot,
} from '@/utils/shiftUtils';
import type { ShiftTask } from '@/types';
import s from './TasksPage.module.scss';

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  section: z.enum(['start', 'during', 'end']),
  department: z.string().min(1),
  assigneeId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  dueTime: z.string().optional(),
  slot: z.enum(['viewed', 'next']),
});
type TaskFormData = z.infer<typeof taskSchema>;

const priorityVariant = { low: 'success', medium: 'warning', high: 'danger' } as const;

export function TasksPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const canManage = can('tasks.manage');

  const currentSlot = getCurrentSlot();
  const [slot, setSlot] = useState<ShiftSlot>(currentSlot);
  const [tab, setTab] = useState<'tasks' | 'templates'>('tasks');
  const [modalOpen, setModalOpen] = useState(false);
  const [skipping, setSkipping] = useState<ShiftTask | null>(null);
  const [skipComment, setSkipComment] = useState('');
  const [deleting, setDeleting] = useState<ShiftTask | null>(null);

  const { data: employees = [] } = useGetEmployeesQuery(undefined, { skip: !can('tasks.create') });
  const currentEmployee = employees.find((employee) => employee.userId === user?.id);
  const ownDepartment = !canManage && currentEmployee ? currentEmployee.department : '';
  const [departmentFilter, setDepartmentFilter] = useState('');
  const department = ownDepartment || departmentFilter;

  const { data: tasks = [], isLoading } = useGetTasksQuery(
    { date: slot.date, shiftType: slot.type, department: department || undefined },
    { pollingInterval: 60_000, skip: user?.role === 'EMPLOYEE' && !currentEmployee },
  );
  const [createTask, { isLoading: creating }] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [updateTasksBulk, { isLoading: bulkUpdating }] = useUpdateTasksBulkMutation();
  const [deleteTask, { isLoading: removing }] = useDeleteTaskMutation();

  const isCurrent = isSameSlot(slot, currentSlot);
  const isPast = compareSlots(slot, currentSlot) < 0;
  const canAddHere = can('tasks.create') && (canManage || isCurrent || isSameSlot(slot, getNextSlot(currentSlot)));
  const done = tasks.filter((task) => task.status === 'done').length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const checkableTasks = tasks.filter((task) => task.status !== 'skipped');
  const allChecked = checkableTasks.length > 0 && checkableTasks.every((task) => task.status === 'done');
  const now = new Date();

  const employeeNames = new Map(employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`]));
  const employeeName = (id: string) => employeeNames.get(id);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
  });

  const openCreate = () => {
    reset({
      title: '',
      description: '',
      section: 'during',
      department: ownDepartment || departmentFilter || SHIFT_DEPARTMENTS[0],
      assigneeId: '',
      priority: 'medium',
      dueTime: '',
      slot: 'viewed',
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: TaskFormData) => {
    const target = data.slot === 'next' ? getNextSlot(slot) : slot;
    try {
      await createTask({
        title: data.title,
        description: data.description || undefined,
        section: data.section,
        sortOrder: Math.max(0, ...tasks
          .filter((task) => (task.section ?? 'during') === data.section)
          .map((task) => task.sortOrder ?? 0)) + 1,
        department: data.department,
        assigneeId: data.assigneeId || undefined,
        priority: data.priority,
        dueTime: data.dueTime || undefined,
        date: target.date,
        shiftType: target.type,
      }).unwrap();
      showToast(t('Task added'), 'success');
      setModalOpen(false);
    } catch (error) {
      showToast((error as { data?: { message?: string } }).data?.message ?? t('Operation failed'), 'error');
    }
  };

  const toggleDone = async (task: ShiftTask) => {
    try {
      await updateTask({ id: task.id, status: task.status === 'open' ? 'done' : 'open' }).unwrap();
    } catch (error) {
      showToast((error as { data?: { message?: string } }).data?.message ?? t('Operation failed'), 'error');
    }
  };

  const toggleAll = async () => {
    const status = allChecked ? 'open' : 'done';
    const ids = checkableTasks
      .filter((task) => task.status !== status)
      .map((task) => task.id);
    if (!ids.length) return;
    try {
      await updateTasksBulk({ ids, status }).unwrap();
      showToast(t(status === 'done' ? 'All checklist items checked' : 'All checklist items unchecked'), 'success');
    } catch (error) {
      showToast((error as { data?: { message?: string } }).data?.message ?? t('Operation failed'), 'error');
    }
  };

  const confirmSkip = async () => {
    if (!skipping || !skipComment.trim()) return;
    try {
      await updateTask({ id: skipping.id, status: 'skipped', comment: skipComment.trim() }).unwrap();
      setSkipping(null);
      setSkipComment('');
    } catch {
      showToast(t('Operation failed'), 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTask(deleting.id).unwrap();
      showToast(t('Task deleted'), 'success');
      setDeleting(null);
    } catch {
      showToast(t('Operation failed'), 'error');
    }
  };

  return (
    <div>
      <div className={s.toolbar}>
        <div>
          <h1>{t('Shift tasks')}</h1>
          <p className={s.subtitle}>
            {formatSlot(slot, t, locale)}
            {isCurrent && <span className={s.nowBadge}>{t('Current shift')}</span>}
          </p>
        </div>
        <div className={s.slotNav}>
          <Button variant="secondary" size="sm" onClick={() => setSlot(getPreviousSlot(slot))}>← {t('Previous shift')}</Button>
          <Button variant="ghost" size="sm" onClick={() => setSlot(currentSlot)} disabled={isCurrent}>{t('Current shift')}</Button>
          <Button variant="secondary" size="sm" onClick={() => setSlot(getNextSlot(slot))}>{t('Next shift')} →</Button>
        </div>
      </div>

      {can('tasks.manageTemplates') && (
        <div className={s.tabs} role="tablist">
          <button role="tab" aria-selected={tab === 'tasks'} className={clsx(s.tab, tab === 'tasks' && s.activeTab)} onClick={() => setTab('tasks')}>{t('Tasks')}</button>
          <button role="tab" aria-selected={tab === 'templates'} className={clsx(s.tab, tab === 'templates' && s.activeTab)} onClick={() => setTab('templates')}>{t('Recurring checklists')}</button>
        </div>
      )}

      {tab === 'templates' ? (
        <TaskTemplatesPanel />
      ) : (
        <>
          <div className={s.summary}>
            <div className={s.progressWrap}>
              <div className={s.progressLabel}>
                <span>{t('Done')} {done} / {tasks.length}</span>
                <strong>{progress}%</strong>
              </div>
              <div className={s.progress}><span style={{ width: `${progress}%` }} /></div>
            </div>
            <div className={s.summaryActions}>
              {can('tasks.complete') && (
                <Button
                  variant="secondary"
                  onClick={() => void toggleAll()}
                  disabled={!checkableTasks.length || bulkUpdating}
                  loading={bulkUpdating}
                >
                  {t(allChecked ? 'Uncheck all' : 'Check all')}
                </Button>
              )}
              {canManage || !ownDepartment ? (
                <Select
                  aria-label={t('Department')}
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  options={[{ value: '', label: t('All departments') }, ...toOptions(SHIFT_DEPARTMENTS, t)]}
                />
              ) : (
                <Badge variant="info">{t(ownDepartment)}</Badge>
              )}
              {canAddHere && <Button onClick={openCreate}>+ {t('Add task')}</Button>}
            </div>
          </div>

          {isLoading ? (
            <Loader />
          ) : !tasks.length ? (
            <EmptyState title={t('No tasks for this shift')} message={canAddHere ? t('Add a task so the shift does not forget it.') : t('Nothing was planned for this shift.')} />
          ) : (
            <ul className={s.list}>
              {CHECKLIST_SECTIONS.flatMap((section) => {
                const sectionTasks = tasks
                  .filter((task) => (task.section ?? 'during') === section.value)
                  .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
                if (!sectionTasks.length) return [];
                return [
                  <li key={`section-${section.value}`} className={s.sectionHeading}>
                    <h2>{t(section.label)}</h2>
                  </li>,
                  ...sectionTasks.map((task) => {
                const overdue = task.status === 'open' && !!task.dueTime && slotTimeToDate(slot, task.dueTime) < now;
                const canDelete = canManage || task.createdBy === user?.id;
                return (
                  <li key={task.id} className={clsx(s.task, task.status !== 'open' && s.taskDone, task.status === 'skipped' && s.taskSkipped)}>
                    <label className={s.check}>
                      <input
                        type="checkbox"
                        aria-label={`${t('Mark as done')}: ${task.title}`}
                        checked={task.status === 'done'}
                        disabled={!can('tasks.complete') || task.status === 'skipped' || bulkUpdating}
                        onChange={() => void toggleDone(task)}
                      />
                      <span />
                    </label>
                    <div className={s.taskBody}>
                      <div className={s.taskTitle}>{task.title}</div>
                      {task.description && <p className={s.taskDescription}>{task.description}</p>}
                      <div className={s.taskMeta}>
                        <Badge variant={priorityVariant[task.priority]}>{t(task.priority)}</Badge>
                        {task.dueTime && <span className={clsx(overdue && s.overdue)}>⏰ {t('until')} {task.dueTime}</span>}
                        <span>{task.department === 'ALL' ? t('All departments') : t(task.department)}</span>
                        {task.assigneeId && <span>👤 {employeeName(task.assigneeId) ?? task.assigneeId}</span>}
                        {task.templateId && <Badge variant="default">{t('Checklist')}</Badge>}
                        {task.carriedOverFrom && <Badge variant="warning">{t('Carried over from previous shift')}</Badge>}
                      </div>
                      {task.status !== 'open' && (
                        <div className={s.completedInfo}>
                          {task.status === 'done' ? '✓' : '↷'} {task.completedByName} · {task.completedAt && new Date(task.completedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                          {task.comment && <> — <em>{task.comment}</em></>}
                        </div>
                      )}
                      {isPast && task.status === 'open' && !task.templateId && (
                        <div className={s.completedInfo}>{t('Not done — moved to the next shift')}</div>
                      )}
                    </div>
                    <div className={s.taskActions}>
                      {task.status === 'open' && can('tasks.complete') && (
                        <Button variant="ghost" size="sm" onClick={() => { setSkipping(task); setSkipComment(''); }}>{t('Skip')}</Button>
                      )}
                      {task.status === 'skipped' && can('tasks.complete') && (
                        <Button variant="ghost" size="sm" onClick={() => void toggleDone(task)}>{t('Reopen')}</Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" aria-label={`${t('Delete')}: ${task.title}`} onClick={() => setDeleting(task)}>✕</Button>
                      )}
                    </div>
                  </li>
                );
                  }),
                ];
              })}
            </ul>
          )}
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('New task')}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label={t('Task')} error={errors.title && t(errors.title.message ?? '')} required>
            <Input placeholder={t('What needs to be done?')} {...register('title')} error={!!errors.title} />
          </FormField>
          <FormField label={t('Details')}>
            <Textarea rows={3} {...register('description')} />
          </FormField>
          <FormField label={t('Checklist chapter')}>
            <Select {...register('section')} options={CHECKLIST_SECTIONS.map((section) => ({ value: section.value, label: t(section.label) }))} />
          </FormField>
          <FormField label={t('Shift')}>
            <Select
              {...register('slot')}
              options={[
                { value: 'viewed', label: formatSlot(slot, t, locale) },
                { value: 'next', label: formatSlot(getNextSlot(slot), t, locale) },
              ]}
            />
          </FormField>
          <div className={s.formRow}>
            <FormField label={t('Department')}>
              <Select {...register('department')} disabled={!!ownDepartment} options={[...toOptions(SHIFT_DEPARTMENTS, t), { value: 'ALL', label: t('All departments') }]} />
            </FormField>
            <FormField label={t('Priority')}>
              <Select {...register('priority')} options={[{ value: 'low', label: t('low') }, { value: 'medium', label: t('medium') }, { value: 'high', label: t('high') }]} />
            </FormField>
          </div>
          <div className={s.formRow}>
            <FormField label={t('Responsible (optional)')}>
              <Select
                {...register('assigneeId')}
                options={[
                  { value: '', label: t('Whole shift') },
                  ...employees.filter((employee) => employee.status === 'active').map((employee) => ({ value: employee.id, label: `${employee.firstName} ${employee.lastName}` })),
                ]}
              />
            </FormField>
            <FormField label={t('Until (optional)')}>
              <Input type="time" {...register('dueTime')} />
            </FormField>
          </div>
          <div className={s.formActions}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" loading={creating}>{t('Create')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!skipping} onClose={() => setSkipping(null)} title={t('Skip task')} size="sm">
        <p className={s.modalText}>{skipping?.title}</p>
        <FormField label={t('Why was it not done?')} required>
          <Textarea rows={3} value={skipComment} onChange={(event) => setSkipComment(event.target.value)} />
        </FormField>
        <div className={s.formActions}>
          <Button variant="secondary" type="button" onClick={() => setSkipping(null)}>{t('Cancel')}</Button>
          <Button type="button" onClick={() => void confirmSkip()} disabled={!skipComment.trim()}>{t('Skip')}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        title={t('Delete task?')}
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
