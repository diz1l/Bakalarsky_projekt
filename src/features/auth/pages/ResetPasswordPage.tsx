import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useResetPasswordMutation } from '../api/authApi';
import { resetPasswordSchema } from '../schemas/resetPasswordSchema';
import type { ResetPasswordFormData } from '../schemas/resetPasswordSchema';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { useToast } from '@/components/ui/Toast';
import s from './ResetPasswordPage.module.scss';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const token = params.get('token') ?? '';
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await resetPassword({ token, newPassword: data.newPassword }).unwrap();
      showToast('Password updated. Please sign in again.', 'success');
      navigate('/login');
    } catch {
      showToast('Unable to reset password', 'error');
    }
  };

  if (!token) {
    return (
      <div className={s.page}>
        <div className={s.card}>
          <div className={s.header}>
            <h1>Invalid reset link</h1>
            <p>The reset token is missing or invalid.</p>
          </div>
          <Link className={s.backLink} to="/forgot-password">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.header}>
          <h1>Reset password</h1>
          <p>Set a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={s.form}>
          <FormField label="New Password" error={errors.newPassword?.message} required>
            <Input
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              error={!!errors.newPassword}
              {...register('newPassword')}
            />
          </FormField>
          <FormField label="Confirm New Password" error={errors.confirmPassword?.message} required>
            <Input
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              error={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
          </FormField>

          {error && <div className={s.apiError}>Unable to reset password. Check token and try again.</div>}

          <Button type="submit" loading={isLoading} className={s.submitBtn}>
            Update password
          </Button>

          <Link className={s.backLink} to="/login">
            Back to login
          </Link>
        </form>
      </div>
    </div>
  );
}
