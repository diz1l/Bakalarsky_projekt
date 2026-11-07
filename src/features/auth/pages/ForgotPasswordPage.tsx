import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForgotPasswordMutation } from '../api/authApi';
import { forgotPasswordSchema } from '../schemas/forgotPasswordSchema';
import type { ForgotPasswordFormData } from '../schemas/forgotPasswordSchema';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { useToast } from '@/components/ui/Toast';
import s from './ForgotPasswordPage.module.scss';

export function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const { showToast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      const response = await forgotPassword(data).unwrap();
      setToken(response.token ?? null);
      setSent(true);
    } catch {
      showToast('Unable to process request right now', 'error');
    }
  };

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.header}>
          <h1>Forgot password</h1>
          <p>Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div className={s.successState}>
            <p>If this email exists, we sent a reset link.</p>
            {token && <Link className={s.mockLink} to={`/reset-password?token=${encodeURIComponent(token)}`}>Open mock reset page</Link>}
            <Link className={s.backLink} to="/login">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className={s.form}>
            <FormField label="Email" error={errors.email?.message} required>
              <Input
                type="email"
                placeholder="admin@hotel.com"
                autoComplete="email"
                error={!!errors.email}
                {...register('email')}
              />
            </FormField>

            <Button type="submit" loading={isLoading} className={s.submitBtn}>
              Send reset link
            </Button>

            <Link className={s.backLink} to="/login">
              Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
