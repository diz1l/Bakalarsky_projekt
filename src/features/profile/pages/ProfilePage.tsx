import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/app/hooks';
import { patchSessionUser } from '@/features/auth/slices/authSlice';
import { useChangePasswordMutation, useUpdateProfileMutation } from '@/features/auth/api/authApi';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { FormField } from '@/components/ui/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { changePasswordSchema } from '../schemas/changePasswordSchema';
import type { ChangePasswordFormData } from '../schemas/changePasswordSchema';
import { profileInfoSchema } from '../schemas/profileInfoSchema';
import type { ProfileInfoFormData } from '../schemas/profileInfoSchema';
import s from './ProfilePage.module.scss';

export function ProfilePage() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();

  const [updateProfile, { isLoading: isSavingProfile }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();

  const profileForm = useForm<ProfileInfoFormData>({
    resolver: zodResolver(profileInfoSchema),
    defaultValues: {
      name: user?.name ?? '',
      login: user?.login ?? '',
      email: user?.email ?? '',
    },
  });

  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    profileForm.reset({
      name: user?.name ?? '',
      login: user?.login ?? '',
      email: user?.email ?? '',
    });
  }, [profileForm, user?.email, user?.login, user?.name]);

  if (!user) return null;

  const onSubmitProfile = async (data: ProfileInfoFormData) => {
    try {
      const updatedUser = await updateProfile(data).unwrap();
      dispatch(
        patchSessionUser({
          name: updatedUser.name,
          login: updatedUser.login,
          email: updatedUser.email,
        }),
      );
      showToast('Profile updated for current session', 'success');
    } catch {
      showToast('Unable to update profile', 'error');
    }
  };

  const onSubmitPassword = async (data: ChangePasswordFormData) => {
    try {
      await changePassword({ oldPassword: data.oldPassword, newPassword: data.newPassword }).unwrap();
      passwordForm.reset({ oldPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password updated in mock mode', 'success');
    } catch {
      showToast('Unable to update password', 'error');
    }
  };

  return (
    <div>
      <h1 className={s.title}>Profile</h1>

      <div className={s.card}>
        <div className={s.avatar}>{user.name.charAt(0).toUpperCase()}</div>
        <div className={s.info}>
          <h2>{user.name}</h2>
          <p className={s.email}>{user.email}</p>
          <div className={s.badges}>
            <Badge variant="info">{user.role}</Badge>
            <Badge variant="default">@{user.login}</Badge>
          </div>
        </div>
      </div>

      <div className={s.formsGrid}>
        <section className={s.panel}>
          <h3>Profile info</h3>
          <form onSubmit={profileForm.handleSubmit(onSubmitProfile)}>
            <FormField label="Full name" error={profileForm.formState.errors.name?.message} required>
              <Input
                placeholder="John Admin"
                {...profileForm.register('name')}
                error={!!profileForm.formState.errors.name}
              />
            </FormField>
            <FormField label="Login" error={profileForm.formState.errors.login?.message} required>
              <Input
                placeholder="admin"
                {...profileForm.register('login')}
                error={!!profileForm.formState.errors.login}
              />
            </FormField>
            <FormField label="Email" error={profileForm.formState.errors.email?.message} required>
              <Input
                type="email"
                placeholder="admin@hotel.com"
                {...profileForm.register('email')}
                error={!!profileForm.formState.errors.email}
              />
            </FormField>

            <div className={s.formActions}>
              <Button type="submit" loading={isSavingProfile}>
                Save profile
              </Button>
            </div>
          </form>
        </section>

        <section className={s.panel}>
          <h3>Change password</h3>
          <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)}>
            <FormField label="Old password" error={passwordForm.formState.errors.oldPassword?.message} required>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                {...passwordForm.register('oldPassword')}
                error={!!passwordForm.formState.errors.oldPassword}
              />
            </FormField>
            <FormField label="New password" error={passwordForm.formState.errors.newPassword?.message} required>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                {...passwordForm.register('newPassword')}
                error={!!passwordForm.formState.errors.newPassword}
              />
            </FormField>
            <FormField
              label="Confirm new password"
              error={passwordForm.formState.errors.confirmPassword?.message}
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                {...passwordForm.register('confirmPassword')}
                error={!!passwordForm.formState.errors.confirmPassword}
              />
            </FormField>

            <div className={s.formActions}>
              <Button type="submit" loading={isChangingPassword}>
                Update password
              </Button>
            </div>
          </form>
        </section>
      </div>

      <p className={s.note}>Some settings are stored in mock mode and will be synced to backend later.</p>
    </div>
  );
}
