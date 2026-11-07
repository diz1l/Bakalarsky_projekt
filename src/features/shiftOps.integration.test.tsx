import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import App from '@/App';
import { renderAtRoute } from '@/test/render';
import { db } from '@/mocks/data/db';
import { getCurrentSlot } from '@/utils/shiftUtils';

async function signIn(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password = 'password123',
) {
  await user.type(screen.getByPlaceholderText('name@hotel.com'), email);
  await user.type(screen.getByPlaceholderText('Enter your password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(JSON.parse(localStorage.getItem('auth_user') ?? '{}').email).toBe(email);
  });
  if (JSON.parse(localStorage.getItem('auth_user') ?? '{}').mustChangePassword) {
    await screen.findByRole('alert');
    await user.type(screen.getByPlaceholderText('Current password'), 'password123');
    await user.type(screen.getByPlaceholderText('New password'), 'team-member-new-password');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'team-member-new-password');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await screen.findByText('Password updated successfully');
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('auth_user') ?? '{}').mustChangePassword).toBe(false);
    });
  }
  await screen.findByRole('button', { name: 'Sign out' });
}

describe('Shift tasks and handover (mock mode)', () => {
  test('Employee completes a task of the current shift', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');
    await signIn(user, 'employee@hotel.com');

    await user.click(screen.getByRole('link', { name: 'Shift tasks' }));
    const checkbox = await screen.findByRole('checkbox', { name: /Restock minibar/ });
    expect(screen.queryByText(/Call the guest in room 204/)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Recurring checklists' })).not.toBeInTheDocument();

    await user.click(checkbox);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Restock minibar/ })).toBeChecked());
    expect(screen.getByText(/✓ Mike Wilson/)).toBeInTheDocument();
  });

  test('Manager hands information over and the next shift confirms it', async () => {
    db.shifts = [];
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');
    await signIn(user, 'manager@hotel.com');

    await user.click(screen.getByRole('link', { name: /^Shift handover/ }));
    await user.click(await screen.findByRole('button', { name: /Pass information/ }));
    await user.type(screen.getByPlaceholderText(/Water leak in room 312/), 'Late arrival in 207');
    await user.type(screen.getByLabelText(/What should the next shift know/), 'Guest arrives at 02:00, key is in the safe.');
    await user.click(screen.getByRole('button', { name: 'Pass on' }));
    await user.click(await screen.findByRole('tab', { name: 'All active' }));
    expect(await screen.findByText('Late arrival in 207')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await signIn(user, 'employee@hotel.com');
    await user.click(screen.getByRole('link', { name: /^Shift handover/ }));

    const card = (await screen.findByText('Late arrival in 207')).closest('article')!;
    await user.click(within(card as HTMLElement).getByRole('checkbox', { name: 'I have read this' }));
    expect(await screen.findByText('Nothing waiting for you')).toBeInTheDocument();
  });

  test('Guest can view tasks but not change them', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');
    await user.click(screen.getByRole('button', { name: /Continue as Guest/i }));
    await screen.findByText(/Welcome back, Guest User/i);

    await user.click(screen.getByRole('link', { name: 'Shift tasks' }));
    expect(await screen.findByRole('heading', { name: 'Shift tasks' })).toBeInTheDocument();
    await screen.findAllByRole('checkbox');
    screen.getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).toBeDisabled());
    expect(screen.queryByRole('button', { name: /Add task/ })).not.toBeInTheDocument();
  });

  test('Manager can check and uncheck the whole shift checklist and edit its chapters', async () => {
    const user = userEvent.setup();
    renderAtRoute(<App />, '/login');
    await signIn(user, 'manager@hotel.com');

    await user.click(screen.getByRole('link', { name: 'Shift tasks' }));
    await screen.findAllByRole('checkbox', { name: /Mark as done/ });
    await user.click(await screen.findByRole('button', { name: 'Check all' }));
    await waitFor(() => {
      const current = getCurrentSlot();
      const checkable = db.tasks.filter((task) =>
        task.date === current.date && task.shiftType === current.type && task.status !== 'skipped');
      expect(checkable.length).toBeGreaterThan(0);
      checkable.forEach((task) => expect(task.status).toBe('done'));
    });
    await screen.findByRole('button', { name: 'Uncheck all' });
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox', { name: /Mark as done/ });
      expect(checkboxes.length).toBeGreaterThan(0);
      checkboxes.forEach((checkbox) => expect(checkbox).toBeChecked());
    });

    await user.click(screen.getByRole('button', { name: 'Uncheck all' }));
    await screen.findByRole('button', { name: 'Check all' });
    await waitFor(() => screen.getAllByRole('checkbox', { name: /Mark as done/ })
      .forEach((checkbox) => expect(checkbox).not.toBeChecked()));

    await user.click(screen.getByRole('tab', { name: 'Recurring checklists' }));
    expect(await screen.findByRole('heading', { name: 'At the start of shift' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'During the shift' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'At the end of shift' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /New checklist item/ }));
    await screen.findByRole('heading', { name: 'New checklist item' });
    await user.type(screen.getByLabelText(/^Task/), 'Checklist task to remove');
    await user.selectOptions(screen.getByLabelText('Checklist chapter'), 'start');
    await user.selectOptions(screen.getByLabelText('Department'), 'ALL');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Checklist task to remove');

    const newTemplate = db.taskTemplates.find((template) => template.title === 'Checklist task to remove');
    expect(newTemplate?.section).toBe('start');
    const current = getCurrentSlot();
    await waitFor(() => expect(db.tasks.some((task) =>
      task.templateId === newTemplate?.id && task.date === current.date && task.shiftType === current.type)).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Delete: Checklist task to remove' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(db.taskTemplates.some((template) => template.id === newTemplate?.id)).toBe(false);
      expect(db.tasks.some((task) => task.templateId === newTemplate?.id
        && task.date === current.date && task.shiftType === current.type)).toBe(false);
    });
  });
});
