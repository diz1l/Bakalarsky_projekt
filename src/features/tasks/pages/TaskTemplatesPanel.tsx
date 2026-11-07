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
import { CHECKLIST_SECTIONS } from '../checklist';
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
import type { ChecklistSection, TaskTemplate } from '@/types';
import s from './TasksPage.module.scss';

const templateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  section: z.enum(['start', 'during', 'end']),
  department: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']),
  dueTime: z.string().optional(),
});
type TemplateFormData = z.infer<typeof templateSchema>;

const sectionOrder: Record<ChecklistSection, number> = { start: 0, during: 1, end: 2 };

export function TaskTemplatesPanel() {
  const { t } = useLocale();
  const { showToast } = useToast();
  const { data: templates = [], isLoading, isError } = useGetTaskTemplatesQuery();
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
      section: template?.section ?? 'during',
      department: template?.department ?? SHIFT_DEPARTMENTS[0],
      priority: template?.priority ?? 'medium',
      dueTime: template?.dueTime ?? '',
    });
    setModalOpen(true);
  };

  const toPayload = (data: TemplateFormData) => {
    const section = templates.filter((template) => template.section === data.section);
    const sortOrder = editing?.section === data.section
      ? editing.sortOrder
      : Math.max(0, ...section.map((template) => template.sortOrder ?? 0)) + 1;
    return {
      title: data.title,
      section: data.section,
      sortOrder,
      shiftType: 'ANY' as const,
      department: data.department,
      priority: data.priority,
      dueTime: data.dueTime || undefined,
      weekdays: [],
      active: true,
    };
  };

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

  const removeTemplate = async () => {
    if (!deleting) return;
    try {
      await deleteTemplate(deleting.id).unwrap();
      showToast(t('Checklist item deleted'), 'success');
      setDeleting(null);
    } catch {
      showToast(t('Operation failed'), 'error');
    }
  };

  const sortedTemplates = [...templates].sort(
    (left, right) => sectionOrder[left.section ?? 'during'] - sectionOrder[right.section ?? 'during']
      || (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
  );

  if (isError) {
    return <EmptyState title={t('Unable to load checklist')} message={t('Refresh the page and try again.')} />;
  }

  return (
    <div>
      <div className={s.summary}>
        <p className={s.modalText}>{t('The same checklist is used for every day and shift. Progress is tracked separately for each shift.')}</p>
        <Button onClick={() => open(null)}>+ {t('New checklist item')}</Button>
      </div>

      {isLoading ? (
        <p className={s.modalText}>{t('Loading checklist')}…</p>
      ) : !templates.length ? (
        <EmptyState title={t('No recurring checklists')} message={t('Create the first item, e.g. “Count the cash register”.')} />
      ) : (
        <div className={s.checklistSections}>
          {CHECKLIST_SECTIONS.map((section) => {
            const items = sortedTemplates.filter((template) => (template.section ?? 'during') === section.value);
            return (
              <section key={section.value} className={s.templateSection}>
                <h2 className={s.sectionTitle}>{t(section.label)}</h2>
                {items.length ? (
                  <ul className={s.list}>
                    {items.map((template) => (
                      <li key={template.id} className={s.task}>
                        <div className={s.taskBody}>
                          <div className={s.taskTitle}>{template.title}</div>
                          <div className={s.taskMeta}>
                            <Badge variant="info">{t(template.department === 'ALL' ? 'All departments' : template.department)}</Badge>
                            <Badge variant={template.priority === 'high' ? 'danger' : template.priority === 'medium' ? 'warning' : 'success'}>
                              {t(template.priority)}
                            </Badge>
                            {template.dueTime && <span>⏰ {t('until')} {template.dueTime}</span>}
                          </div>
                        </div>
                        <div className={s.taskActions}>
                          <Button variant="ghost" size="sm" onClick={() => open(template)}>{t('Edit')}</Button>
                          <Button variant="ghost" size="sm" aria-label={`${t('Delete')}: ${template.title}`} onClick={() => setDeleting(template)}>✕</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={s.emptySection}>{t('No checklist items in this chapter yet.')}</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('Edit checklist item') : t('New checklist item')}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label={t('Task')} error={errors.title && t(errors.title.message ?? '')} required>
            <Input {...register('title')} error={!!errors.title} />
          </FormField>
          <FormField label={t('Checklist chapter')}>
            <Select {...register('section')} options={CHECKLIST_SECTIONS.map((section) => ({ value: section.value, label: t(section.label) }))} />
          </FormField>
          <FormField label={t('Department')}>
            <Select {...register('department')} options={[...toOptions(SHIFT_DEPARTMENTS, t), { value: 'ALL', label: t('All departments') }]} />
          </FormField>
          <div className={s.formRow}>
            <FormField label={t('Priority')}>
              <Select {...register('priority')} options={[{ value: 'low', label: t('low') }, { value: 'medium', label: t('medium') }, { value: 'high', label: t('high') }]} />
            </FormField>
            <FormField label={t('Until (optional)')}>
              <Input type="time" {...register('dueTime')} />
            </FormField>
          </div>
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
        onConfirm={() => void removeTemplate()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
