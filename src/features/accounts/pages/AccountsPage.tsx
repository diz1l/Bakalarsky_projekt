import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCreateManagedAccountMutation,
  useGetManagedAccountsQuery,
  useResetManagedAccountPasswordMutation,
} from '@/features/auth/api/authApi';
import { useGetEmployeesQuery } from '@/features/employees/api/employeesApi';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button/Button';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { Modal } from '@/components/ui/Modal/Modal';
import { Loader } from '@/components/ui/Loader/Loader';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import s from './AccountsPage.module.scss';

const schema = z.object({
  employeeId: z.string().min(1, 'Select an employee'),
  login: z.string().min(3, 'Login must be at least 3 characters').max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, dashes, or underscores'),
});

type FormData = z.infer<typeof schema>;
interface IssuedCredential {
  employeeName: string;
  email: string;
  login: string;
  password: string;
}

export function AccountsPage() {
  const { showToast } = useToast();
  const { data: accounts = [], isLoading, isError } = useGetManagedAccountsQuery();
  const { data: employees = [], isLoading: employeesLoading, isError: employeesError } = useGetEmployeesQuery();
  const [createAccount, { isLoading: creating }] = useCreateManagedAccountMutation();
  const [resetPassword, { isLoading: resetting }] = useResetManagedAccountPasswordMutation();
  const [issuedCredential, setIssuedCredential] = useState<IssuedCredential | null>(null);
  const [accountToReset, setAccountToReset] = useState<(typeof accounts)[number] | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { employeeId: '', login: '' },
  });

  const availableEmployees = useMemo(
    () => employees.filter((employee) => employee.status === 'active' && !employee.userId),
    [employees],
  );
  const employeeOptions = availableEmployees.map((employee) => ({
    value: employee.id,
    label: `${employee.firstName} ${employee.lastName} · ${employee.role}`,
  }));

  const onCreate = async (data: FormData) => {
    try {
      const { account, temporaryPassword } = await createAccount(data).unwrap();
      setIssuedCredential({
        employeeName: account.employeeName,
        email: account.email,
        login: account.login,
        password: temporaryPassword,
      });
      reset({ employeeId: '', login: '' });
      showToast('Account created. Copy the temporary password now.', 'success');
    } catch {
      showToast('Unable to issue account credentials. Check the employee and login.', 'error');
    }
  };

  const onResetPassword = async () => {
    if (!accountToReset) return;
    try {
      const { temporaryPassword } = await resetPassword(accountToReset.id).unwrap();
      setIssuedCredential({
        employeeName: accountToReset.employeeName,
        email: accountToReset.email,
        login: accountToReset.login,
        password: temporaryPassword,
      });
      setAccountToReset(null);
      showToast('Temporary password issued. Copy it now.', 'success');
    } catch {
      showToast('Unable to reset this account password.', 'error');
    }
  };

  const copyPassword = async () => {
    if (!issuedCredential) return;
    try {
      await navigator.clipboard.writeText(issuedCredential.password);
      showToast('Temporary password copied', 'success');
    } catch {
      showToast('Clipboard access is unavailable. Select and copy the password manually.', 'error');
    }
  };

  if (isLoading || employeesLoading) return <Loader />;
  if (isError || employeesError) return <EmptyState title="Unable to load accounts" message="Refresh the page and try again." />;

  return (
    <div>
      <div className={s.header}>
        <div>
          <h1>Access accounts</h1>
          <p>Issue or reset staff sign-in credentials. Temporary passwords are shown only once.</p>
        </div>
      </div>

      <section className={s.panel} aria-labelledby="create-account-title">
        <h2 id="create-account-title">Issue account</h2>
        {availableEmployees.length ? (
          <form className={s.createForm} onSubmit={handleSubmit(onCreate)}>
            <FormField label="Employee" error={errors.employeeId?.message} required>
              <Select
                options={employeeOptions}
                placeholder="Select an employee without an account"
                {...register('employeeId')}
                error={!!errors.employeeId}
              />
            </FormField>
            <FormField label="Login" error={errors.login?.message} required>
              <Input autoComplete="off" {...register('login')} error={!!errors.login} />
            </FormField>
            <Button type="submit" loading={creating}>Create credentials</Button>
          </form>
        ) : (
          <p className={s.muted}>All active employees already have sign-in accounts.</p>
        )}
        <p className={s.note}>The employee signs in with their work email and this login, then must set a personal password.</p>
      </section>

      <section className={s.panel} aria-labelledby="accounts-list-title">
        <h2 id="accounts-list-title">Issued accounts</h2>
        {accounts.length ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr><th>Employee</th><th>Email</th><th>Login</th><th>Role</th><th>Password status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.employeeName}</td>
                    <td>{account.email}</td>
                    <td>{account.login}</td>
                    <td>{account.role}</td>
                    <td>
                      <span className={account.mustChangePassword ? s.pending : s.active}>
                        {account.mustChangePassword ? 'Temporary password' : 'Set by user'}
                      </span>
                    </td>
                    <td>
                      {account.role !== 'ADMIN' && (
                        <Button variant="secondary" size="sm" onClick={() => setAccountToReset(account)}>
                          Reset password
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No linked accounts" message="Create an account for an active employee above." />
        )}
      </section>

      <Modal
        isOpen={!!issuedCredential}
        onClose={() => setIssuedCredential(null)}
        title="Temporary credentials"
        size="sm"
      >
        {issuedCredential && (
          <div className={s.credentials}>
            <p>Give these credentials directly to <strong>{issuedCredential.employeeName}</strong>. This password will not be shown again.</p>
            <dl>
              <dt>Work email</dt><dd>{issuedCredential.email}</dd>
              <dt>Login</dt><dd>{issuedCredential.login}</dd>
              <dt>Temporary password</dt>
              <dd><code data-testid="issued-password">{issuedCredential.password}</code></dd>
            </dl>
            <div className={s.modalActions}>
              <Button variant="secondary" onClick={() => void copyPassword()}>Copy password</Button>
              <Button onClick={() => setIssuedCredential(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!accountToReset}
        onClose={() => setAccountToReset(null)}
        title="Reset account password"
        size="sm"
      >
        {accountToReset && (
          <div className={s.credentials}>
            <p>Reset the password for <strong>{accountToReset.employeeName}</strong>? Their current password will stop working and they must choose a new one at next sign-in.</p>
            <div className={s.modalActions}>
              <Button variant="secondary" onClick={() => setAccountToReset(null)}>Cancel</Button>
              <Button variant="danger" loading={resetting} onClick={() => void onResetPassword()}>Issue temporary password</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
