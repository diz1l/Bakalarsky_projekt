import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCreateTaskTemplateMutation,
  useDeleteTaskTemplateMutation,
  useGetTaskTemplatesQuery,
  useUpdateTaskTemplateMutation,
} from '../api/tasksApi';
import { useLocale } from '@/app/locale';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Modal } from '@/components/ui/Modal/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { SHIFT_DEPARTMENTS, toOptions } from '@/utils/departments';
import type { TaskTemplate } from '@/types';
import s from './TasksPage.module.scss';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const templateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  shiftType: z.enum(['DAY', 'NIGHT', 'ANY']),
  department: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']),
  dueTime: z.string().optional(),
  weekdays: z.array(z.string()).optional(),
});
type TemplateFormData = z.infer<typeof templateSchema>;

export function TaskTemplatesPanel() {
  const { t } = useLocale();
  const { showToast } = useToast();
  const { data: templates = [] } = useGetTaskTemplatesQuery();
  const [createTemplate, { isLoading: creating }] = useCreateTaskTemplateMutation();
  const [updateTemplate, { isLoading: updating }] = useUpdateTaskTemplateMutation();
  const [deleteTemplate, { isLoading: removing }] = useDeleteTaskTemplateMutation();
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<TaskTemplate | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
  });

  const open = (template: TaskTemplate | null) => {
    setEditing(template);
    reset({
      title: template?.title ?? '',
      shiftType: template?.shiftType ?? 'ANY',
      department: template?.department ?? SHIFT_DEPARTMENTS[0],
      priority: template?.priority ?? 'medium',
      dueTime: template?.dueTime ?? '',
      weekdays: template?.weekdays.map(String) ?? [],
    });
    setModalOpen(true);
  };

  const toPayload = (data: TemplateFormData) => ({
    title: data.title,
    shiftType: data.shiftType,
    department: data.department,
    priority: data.priority,
    dueTime: data.dueTime || undefined,
    weekdays: (data.weekdays ?? []).map(Number).sort(),
    active: editing?.active ?? true,
  });

  const onSubmit = async (data: TemplateFormData) => {
    try {
      if (editing) await updateTemplate({ ...toPayload(data), id: editing.id }).unwrap();
      else await createTemplate(toPayload(data)).unwrap();
      showToast(t('Checklist saved'), 'success');
      setModalOpen(false);
    } catch {
      showToast(t('Operation failed'), 'error');
    }
  };

  const toggleActive = async (template: TaskTemplate) => {
    try {
      await updateTemplate({
        id: template.id,
        title: template.title,
        description: template.description,
        shiftType: template.shiftType,
        department: template.department,
        weekdays: template.weekdays,
        dueTime: template.dueTime,
        priority: template.priority,
        active: !template.active,
      }).unwrap();
    } catch {
      showToast(t('Operation failed'), 'error');
    }
  };

  const describeDays = (weekdays: number[]) =>
    weekdays.length ? weekdays.map((day) => t(WEEKDAYS[day - 1])).join(', ') : t('Every day');

  return (
    <div>
      <div className={s.summary}>
        <p className={s.modalText}>{t('Recurring checklists are added automatically to every matching shift.')}</p>
        <Button onClick={() => open(null)}>+ {t('New checklist item')}</Button>
      </div>

      {!templates.length ? (
        <EmptyState title={t('No recurring checklists')} message={t('Create the first item, e.g. “Count the cash register”.')} />
      ) : (
        <ul className={s.list}>
          {templates.map((template) => (
            <li key={template.id} className={`${s.task} ${template.active ? '' : s.taskDone}`}>
              <div className={s.taskBody}>
                <div className={s.taskTitle}>{template.title}</div>
                <div className={s.taskMeta}>
                  <Badge variant="info">{template.shiftType === 'ANY' ? t('Every shift') : t(template.shiftType === 'DAY' ? 'Day shift' : 'Night shift')}</Badge>
                  <span>{template.department === 'ALL' ? t('All departments') : t(template.department)}</span>
                  <span>{describeDays(template.weekdays)}</span>
                  {template.dueTime && <span>⏰ {t('until')} {template.dueTime}</span>}
                  {!template.active && <Badge variant="default">{t('Paused')}</Badge>}
                </div>
              </div>
              <div className={s.taskActions}>
                <Button variant="ghost" size="sm" onClick={() => void toggleActive(template)}>{template.active ? t('Pause') : t('Resume')}</Button>
                <Button variant="ghost" size="sm" onClick={() => open(template)}>{t('Edit')}</Button>
                <Button variant="ghost" size="sm" aria-label={`${t('Delete')}: ${template.title}`} onClick={() => setDeleting(template)}>✕</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('Edit checklist item') : t('New checklist item')}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label={t('Task')} error={errors.title && t(errors.title.message ?? '')} required>
            <Input {...register('title')} error={!!errors.title} />
          </FormField>
          <div className={s.formRow}>
            <FormField label={t('Shift')}>
              <Select {...register('shiftType')} options={[{ value: 'ANY', label: t('Every shift') }, { value: 'DAY', label: t('Day shift') }, { value: 'NIGHT', label: t('Night shift') }]} />
            </FormField>
            <FormField label={t('Department')}>
              <Select {...register('department')} options={[...toOptions(SHIFT_DEPARTMENTS, t), { value: 'ALL', label: t('All departments') }]} />
            </FormField>
          </div>
          <div className={s.formRow}>
            <FormField label={t('Priority')}>
              <Select {...register('priority')} options={[{ value: 'low', label: t('low') }, { value: 'medium', label: t('medium') }, { value: 'high', label: t('high') }]} />
            </FormField>
            <FormField label={t('Until (optional)')}>
              <Input type="time" {...register('dueTime')} />
            </FormField>
          </div>
          <FormField label={t('Days (none selected = every day)')}>
            <div className={s.weekdays}>
              {WEEKDAYS.map((day, index) => (
                <label key={day}>
                  <input type="checkbox" value={String(index + 1)} {...register('weekdays')} />
                  <span>{t(day)}</span>
                </label>
              ))}
            </div>
          </FormField>
          <div className={s.formActions}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" loading={creating || updating}>{t('Save')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        title={t('Delete checklist item?')}
        message={deleting?.title ?? ''}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        loading={removing}
        onConfirm={() => {
          if (!deleting) return;
          void deleteTemplate(deleting.id).unwrap().then(() => setDeleting(null)).catch(() => showToast(t('Operation failed'), 'error'));
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
