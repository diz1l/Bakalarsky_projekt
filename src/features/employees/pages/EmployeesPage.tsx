import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useGetEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} from '../api/employeesApi';
import { employeeSchema } from '../schemas/employeeSchema';
import type { EmployeeFormData } from '../schemas/employeeSchema';
import type { Employee } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/components/ui/Toast';
import { Table } from '@/components/ui/Table/Table';
import type { Column } from '@/components/ui/Table/Table';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { Modal } from '@/components/ui/Modal/Modal';
import { FormField } from '@/components/ui/FormField/FormField';
import { Badge } from '@/components/ui/Badge/Badge';
import s from './EmployeesPage.module.scss';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { useLocale } from '@/app/locale';

const DEPARTMENTS = [
  { value: 'Front Desk', label: 'Front Desk' },
  { value: 'Housekeeping', label: 'Housekeeping' },
  { value: 'Restaurant', label: 'Restaurant' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Management', label: 'Management' },
];

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
];

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function EmployeesPage() {
  const { can } = usePermissions();
  const { showToast } = useToast();
  const { t } = useLocale();
  const { data: employees = [], isLoading } = useGetEmployeesQuery();
  const [createEmployee, { isLoading: creating }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: updating }] = useUpdateEmployeeMutation();
  const [deleteEmployee, { isLoading: deleting }] = useDeleteEmployeeMutation();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  const openCreate = () => {
    setEditing(null);
    reset({ firstName: '', lastName: '', email: '', phone: '', role: 'EMPLOYEE', department: '', position: '', hireDate: '', status: 'active' });
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    reset({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      department: emp.department,
      position: emp.position,
      hireDate: emp.hireDate,
      status: emp.status,
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      if (editing) {
        await updateEmployee({ ...editing, ...data }).unwrap();
        showToast('Employee updated', 'success');
      } else {
        await createEmployee(data as Omit<Employee, 'id'>).unwrap();
        showToast('Employee created', 'success');
      }
      setModalOpen(false);
    } catch {
      showToast('Operation failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEmployee(id).unwrap();
      showToast('Employee deleted', 'success');
      setEmployeeToDelete(null);
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const columns: Column<Employee>[] = [
    { key: 'firstName', header: t('Name'), sortable: true, render: (e) => `${e.firstName} ${e.lastName}` },
    { key: 'email', header: t('Email'), sortable: true },
    { key: 'department', header: t('Department'), sortable: true },
    { key: 'position', header: t('Position') },
    { key: 'role', header: t('Role'), render: (e) => <Badge variant="info">{t(e.role)}</Badge> },
    {
      key: 'status',
      header: t('Status'),
      render: (e) => <Badge variant={e.status === 'active' ? 'success' : 'default'}>{t(e.status === 'active' ? 'Active' : 'Inactive')}</Badge>,
    },
    ...(can('employees.edit') || can('employees.delete')
      ? [{
          key: 'actions' as const,
          header: t('Actions'),
          render: (e: Employee) => (
            <div className={s.actions}>
              {can('employees.edit') && <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>{t('Edit')}</Button>}
              {can('employees.delete') && <Button variant="ghost" size="sm" onClick={() => setEmployeeToDelete(e)}>{t('Delete')}</Button>}
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className={s.toolbar}>
        <h1>{t('Employees')}</h1>
        <div className={s.toolbarRight}>
          <Input placeholder={t('Search...')} value={search} onChange={(e) => setSearch(e.target.value)} className={s.search} />
          {can('employees.create') && <Button onClick={openCreate}>{t('Add Employee')}</Button>}
        </div>
      </div>

      <Table columns={columns} data={filtered} keyExtractor={(e) => e.id} loading={isLoading} emptyMessage={t('No employees found')} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('Edit Employee') : t('New Employee')} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className={s.form}>
          <div className={s.formGrid}>
            <FormField label={t('First Name')} error={errors.firstName?.message} required>
              <Input {...register('firstName')} error={!!errors.firstName} />
            </FormField>
            <FormField label={t('Last Name')} error={errors.lastName?.message} required>
              <Input {...register('lastName')} error={!!errors.lastName} />
            </FormField>
            <FormField label={t('Email')} error={errors.email?.message} required>
              <Input type="email" {...register('email')} error={!!errors.email} />
            </FormField>
            <FormField label={t('Phone')} error={errors.phone?.message} required>
              <Input {...register('phone')} error={!!errors.phone} />
            </FormField>
            <FormField label={t('Department')} error={errors.department?.message} required>
              <Select options={DEPARTMENTS.map((option) => ({ ...option, label: t(option.label) }))} placeholder={t('Select department')} {...register('department')} error={!!errors.department} />
            </FormField>
            <FormField label={t('Position')} error={errors.position?.message} required>
              <Input {...register('position')} error={!!errors.position} />
            </FormField>
            <FormField label={t('Role')} error={errors.role?.message} required>
              <Select options={ROLES.map((option) => ({ ...option, label: t(option.label) }))} {...register('role')} error={!!errors.role} />
            </FormField>
            <FormField label={t('Hire Date')} error={errors.hireDate?.message} required>
              <Input type="date" {...register('hireDate')} error={!!errors.hireDate} />
            </FormField>
            <FormField label={t('Status')} error={errors.status?.message}>
              <Select options={STATUSES.map((option) => ({ ...option, label: t(option.label) }))} {...register('status')} error={!!errors.status} />
            </FormField>
          </div>
          <div className={s.formActions}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>{t('Cancel')}</Button>
            <Button type="submit" loading={creating || updating}>{editing ? t('Save') : t('Create')}</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!employeeToDelete} title={t('Delete employee?')} message={employeeToDelete ? `${t('Delete')} ${employeeToDelete.firstName} ${employeeToDelete.lastName}? ${t('This cannot be undone.')}` : ''} loading={deleting} onClose={() => setEmployeeToDelete(null)} onConfirm={() => { if (employeeToDelete) void handleDelete(employeeToDelete.id); }} confirmLabel={t('Delete')} cancelLabel={t('Cancel')} />
    </div>
  );
}
