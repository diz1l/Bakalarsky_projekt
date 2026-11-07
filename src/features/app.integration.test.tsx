import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import App from '@/App';
import { renderAtRoute } from '@/test/render';

async function signInAsAdmin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('admin@hotel.com'), 'admin@hotel.com');
  await user.type(screen.getByPlaceholderText('password123'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByText(/Welcome back, John Admin/i);
}

describe('App flows (mock mode)', () => {
  test('Guest login should navigate to dashboard and store GUEST role', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');

    await user.click(screen.getByRole('button', { name: /Continue as Guest/i }));

    expect(await screen.findByText(/Welcome back, Guest User/i)).toBeInTheDocument();

    const rawUser = localStorage.getItem('auth_user');
    expect(localStorage.getItem('access_token')).toBe('mock-jwt-usr-guest');
    expect(rawUser).toBeTruthy();
    expect(JSON.parse(rawUser ?? '{}').role).toBe('GUEST');
  });

  test('Guest permissions should hide mutating actions', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');

    await user.click(screen.getByRole('button', { name: /Continue as Guest/i }));
    await screen.findByText(/Welcome back, Guest User/i);

    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Shifts' }));
    expect(await screen.findByRole('heading', { name: 'Shift schedule' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Shift' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /^Notifications/ }));
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark all as read/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Announcements' }));
    expect(await screen.findByRole('heading', { name: 'Announcements' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Announcement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('Forgot password should show success and mock reset link', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/forgot-password');

    await user.type(screen.getByPlaceholderText('admin@hotel.com'), 'admin@hotel.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/If this email exists, we sent a reset link/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Open mock reset page' });
    expect(link.getAttribute('href')).toContain('/reset-password?token=mock-reset-');
  });

  test('Reset password should validate mismatch and redirect after success', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/reset-password?token=mock-reset-123');

    await user.type(screen.getByPlaceholderText('Current password'), 'password123');
    await user.type(screen.getByPlaceholderText('New password'), 'newpassword123');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'different123');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Confirm new password'));
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Sign in to your account')).toBeInTheDocument();
  });

  test('Notifications should open details modal and support clear all', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');
    await signInAsAdmin(user);

    let initialUnreadCount = 0;
    await waitFor(() => {
      initialUnreadCount = Number(screen.getByTitle('Notifications').querySelector('b')?.textContent);
      expect(initialUnreadCount).toBeGreaterThan(0);
    });
    await user.click(screen.getByRole('link', { name: /^Notifications/ }));
    await screen.findByRole('heading', { name: 'Notifications' });

    const cards = await screen.findAllByTestId(/notification-card-/);
    await user.click(cards[0]);
    expect(await screen.findByText('Sender email')).toBeInTheDocument();
    expect(screen.getByText(/@hotel\.com/)).toBeInTheDocument();
    await waitFor(() => {
      const unreadBadge = screen.getByTitle('Notifications').querySelector('b');
      expect(unreadBadge).toBeInTheDocument();
      expect(Number(unreadBadge?.textContent)).toBe(initialUnreadCount - 1);
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: /Mark all as read/ }));
    await waitFor(() => {
      expect(screen.queryByTitle('Notifications')?.querySelector('b')).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(await screen.findByText('No notifications')).toBeInTheDocument();
  });

  test('Announcements should support mark done and delete', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');
    await signInAsAdmin(user);

    await user.click(screen.getByRole('link', { name: 'Announcements' }));
    await screen.findByRole('heading', { name: 'Announcements' });

    await user.click(screen.getByLabelText('mark-done-ann-1'));
    expect(await screen.findByText('completed')).toBeInTheDocument();

    await user.click(screen.getByLabelText('delete-announcement-ann-1'));
    await waitFor(() => {
      expect(screen.queryByText('Staff Meeting')).not.toBeInTheDocument();
    });
  });

  test('Profile should update session info and validate password form', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');
    await signInAsAdmin(user);

    await user.click(screen.getByRole('link', { name: 'Profile' }));
    await screen.findByRole('heading', { name: 'Profile' });

    const nameInput = screen.getByPlaceholderText('John Admin');
    const loginInput = screen.getByPlaceholderText('admin');
    const emailInput = screen.getByPlaceholderText('admin@hotel.com');

    await user.clear(nameInput);
    await user.type(nameInput, 'John Updated');
    await user.clear(loginInput);
    await user.type(loginInput, 'admin_updated');
    await user.clear(emailInput);
    await user.type(emailInput, 'updated-admin@hotel.com');

    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    expect(await screen.findByText('Profile updated for current session')).toBeInTheDocument();

    const sessionUser = JSON.parse(localStorage.getItem('auth_user') ?? '{}');
    expect(sessionUser.name).toBe('John Updated');
    expect(sessionUser.login).toBe('admin_updated');
    expect(sessionUser.email).toBe('updated-admin@hotel.com');

    await user.type(screen.getByPlaceholderText('Current password'), 'password123');
    await user.type(screen.getByPlaceholderText('New password'), 'newpass123');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'mismatch123');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('Confirm new password'));
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Password updated in mock mode')).toBeInTheDocument();
  });
});
