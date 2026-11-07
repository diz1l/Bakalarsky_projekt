import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useGuestLoginMutation, useLoginMutation } from '../api/authApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setCredentials } from '../slices/authSlice';
import { useEffect } from 'react';
import { loginSchema } from '../schemas/loginSchema';
import type { LoginFormData } from '../schemas/loginSchema';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { useToast } from '@/components/ui/Toast';
import s from './LoginPage.module.scss';

export function LoginPage() {
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('staff-theme') === 'dark' ? 'dark' : 'light';
  }, []);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const [login, { isLoading, error }] = useLoginMutation();
  const [guestLogin, { isLoading: isGuestLoading }] = useGuestLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (token && user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (data: LoginFormData) => {
    const res = await login(data)
      .unwrap()
      .catch(() => null);
    if (!res) return;

    dispatch(setCredentials(res));
    navigate(res.user.mustChangePassword ? '/profile?forcePasswordChange=true' : '/dashboard');
  };

  const onGuestSubmit = async () => {
    try {
      const res = await guestLogin().unwrap();
      dispatch(setCredentials(res));
      navigate('/dashboard');
    } catch {
      showToast('Unable to continue as guest', 'error');
    }
  };

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={s.header}>
          <h1>Staff Manager</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className={s.form}>
          <FormField label="Email" error={errors.email?.message} required>
            <Input
              type="email"
              placeholder="name@hotel.com"
              autoComplete="email"
              error={!!errors.email}
              {...register('email')}
            />
          </FormField>

          <FormField label="Password" error={errors.password?.message} required>
            <Input
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              error={!!errors.password}
              {...register('password')}
            />
          </FormField>

          <div className={s.links}>
            <Link to="/forgot-password" className={s.forgotLink}>
              Forgot password?
            </Link>
          </div>

          {error && <div className={s.apiError}>Invalid email or password</div>}

          <Button type="submit" loading={isLoading} className={s.submitBtn}>
            Sign in
          </Button>

          <Button
            type="button"
            variant="secondary"
            loading={isGuestLoading}
            className={s.guestBtn}
            onClick={onGuestSubmit}
          >
            Continue as Guest
          </Button>
        </form>

      </div>
    </div>
  );
}
