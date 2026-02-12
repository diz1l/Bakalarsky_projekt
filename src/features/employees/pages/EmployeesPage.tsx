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
  const { data: employees = [], isLoading } = useGetEmployeesQuery();
  const [createEmployee, { isLoading: creating }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: updating }] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

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
    if (!confirm('Delete this employee?')) return;
    try {
      await deleteEmployee(id).unwrap();
      showToast('Employee deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const columns: Column<Employee>[] = [
    { key: 'firstName', header: 'Name', sortable: true, render: (e) => `${e.firstName} ${e.lastName}` },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'position', header: 'Position' },
    { key: 'role', header: 'Role', render: (e) => <Badge variant="info">{e.role}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <Badge variant={e.status === 'active' ? 'success' : 'default'}>{e.status}</Badge>,
    },
    ...(can('employees.edit') || can('employees.delete')
      ? [{
          key: 'actions' as const,
          header: 'Actions',
          render: (e: Employee) => (
            <div className={s.actions}>
              {can('employees.edit') && <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>Edit</Button>}
              {can('employees.delete') && <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)}>Delete</Button>}
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <div className={s.toolbar}>
        <h1>Employees</h1>
        <div className={s.toolbarRight}>
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className={s.search} />
          {can('employees.create') && <Button onClick={openCreate}>Add Employee</Button>}
        </div>
      </div>

      <Table columns={columns} data={filtered} keyExtractor={(e) => e.id} loading={isLoading} emptyMessage="No employees found" />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Employee' : 'New Employee'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className={s.form}>
          <div className={s.formGrid}>
            <FormField label="First Name" error={errors.firstName?.message} required>
              <Input {...register('firstName')} error={!!errors.firstName} />
            </FormField>
            <FormField label="Last Name" error={errors.lastName?.message} required>
              <Input {...register('lastName')} error={!!errors.lastName} />
            </FormField>
            <FormField label="Email" error={errors.email?.message} required>
              <Input type="email" {...register('email')} error={!!errors.email} />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message} required>
              <Input {...register('phone')} error={!!errors.phone} />
            </FormField>
            <FormField label="Department" error={errors.department?.message} required>
              <Select options={DEPARTMENTS} placeholder="Select department" {...register('department')} error={!!errors.department} />
            </FormField>
            <FormField label="Position" error={errors.position?.message} required>
              <Input {...register('position')} error={!!errors.position} />
            </FormField>
            <FormField label="Role" error={errors.role?.message} required>
              <Select options={ROLES} {...register('role')} error={!!errors.role} />
            </FormField>
            <FormField label="Hire Date" error={errors.hireDate?.message} required>
              <Input type="date" {...register('hireDate')} error={!!errors.hireDate} />
            </FormField>
            <FormField label="Status" error={errors.status?.message}>
              <Select options={STATUSES} {...register('status')} error={!!errors.status} />
            </FormField>
          </div>
          <div className={s.formActions}>
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={creating || updating}>{editing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
