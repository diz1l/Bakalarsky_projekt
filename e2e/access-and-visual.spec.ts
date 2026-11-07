import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;

async function signInAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@hotel.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Welcome back, John Admin')).toBeVisible();
}

async function auditTextContrast(page: Page, theme: 'dark' | 'light', name: string) {
  const failures = await page.evaluate(() => {
    const parseColor = (value: string) => {
      const values = value.match(/[\d.]+/g)?.map(Number);
      if (!values || values.length < 3) return null;
      return [values[0], values[1], values[2], values[3] ?? 1] as const;
    };
    const luminance = (channel: number) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const contrastRatio = (foreground: number[], background: number[]) => {
      const fg = foreground.map(luminance);
      const bg = background.map(luminance);
      const fgLuminance = 0.2126 * fg[0] + 0.7152 * fg[1] + 0.0722 * fg[2];
      const bgLuminance = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
      return (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);
    };

    const rootBackground = parseColor(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
    const selectors = 'h1,h2,h3,h4,p,label,button,a,td,th,span,small,strong,code,select';
    return [...document.querySelectorAll<HTMLElement>(selectors)]
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).visibility !== 'hidden'
          && !!element.textContent?.trim();
      })
      .flatMap((element) => {
        const foreground = parseColor(getComputedStyle(element).color);
        if (!foreground || foreground[3] === 0) return [];

        let background = rootBackground.slice(0, 3) as number[];
        const ancestors = [element, ...Array.from((function* () {
          let parent = element.parentElement;
          while (parent) {
            yield parent;
            parent = parent.parentElement;
          }
        })())].reverse();
        for (const ancestor of ancestors) {
          const color = parseColor(getComputedStyle(ancestor).backgroundColor);
          if (!color || color[3] === 0) continue;
          background = color.slice(0, 3).map((channel, index) => channel * color[3] + background[index] * (1 - color[3]));
        }

        const ratio = contrastRatio(foreground.slice(0, 3), background);
        return ratio < 4.5
          ? [{
            text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 48),
            ratio: Number(ratio.toFixed(2)),
            foreground: getComputedStyle(element).color,
            background: `rgb(${background.join(', ')})`,
          }]
          : [];
      })
      .slice(0, 10);
  });
  expect(failures, `${name} ${theme} theme contrast failures: ${JSON.stringify(failures)}`).toEqual([]);
}

async function checkMobileWidth(page: Page) {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
}

test('login page keeps staff demo credentials private and preserves admin access', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByText(/Demo accounts/i)).toHaveCount(0);
  await expect(page.getByText(/manager@hotel\.com\s*\/\s*password123/i)).toHaveCount(0);
  await expect(page.getByText(/employee@hotel\.com\s*\/\s*password123/i)).toHaveCount(0);

  await page.getByLabel('Email').fill('admin@hotel.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Welcome back, John Admin')).toBeVisible();
});

test('temporary staff credentials are issued only by an admin and require password change', async ({ page }) => {
  await signInAsAdmin(page);
  await page.getByRole('link', { name: 'Access accounts' }).click();
  await page.getByLabel(/Employee/).selectOption('emp-4');
  await page.getByLabel(/Login/).fill('lisa.chen');
  await page.getByRole('button', { name: 'Create credentials' }).click();

  const temporaryPassword = (await page.getByTestId('issued-password').textContent()) ?? '';
  expect(temporaryPassword).toMatch(/^Temp-/);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill('lisa@hotel.com');
  await page.getByLabel('Password').fill(temporaryPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toContainText('temporary password');
  await expect(page.getByRole('heading', { name: 'Profile info' })).toHaveCount(0);
  await page.getByPlaceholder('Current password').fill(temporaryPassword);
  await page.locator('input[placeholder="New password"]').fill('lisa-new-password');
  await page.locator('input[placeholder="Confirm new password"]').fill('lisa-new-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Password updated successfully')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('light and dark themes keep key staff screens readable and usable on mobile', async ({ page }, testInfo) => {
  await signInAsAdmin(page);

  for (const theme of ['dark', 'light'] as const) {
    await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await auditTextContrast(page, theme, 'dashboard');
    await page.screenshot({ path: testInfo.outputPath(`dashboard-${theme}.png`), fullPage: true });
    await checkMobileWidth(page);

    await page.getByRole('link', { name: 'Access accounts' }).click();
    await expect(page.getByRole('heading', { name: 'Access accounts' })).toBeVisible();
    await auditTextContrast(page, theme, 'access accounts');
    await page.screenshot({ path: testInfo.outputPath(`accounts-${theme}.png`), fullPage: true });
    await checkMobileWidth(page);

    await page.getByRole('link', { name: 'Shift tasks' }).click();
    await expect(page.getByRole('heading', { name: 'Shift tasks' })).toBeVisible();
    await auditTextContrast(page, theme, 'shift tasks');
    await page.screenshot({ path: testInfo.outputPath(`tasks-${theme}.png`), fullPage: true });
    await checkMobileWidth(page);

    await page.getByRole('tab', { name: 'Recurring checklists' }).click();
    await expect(page.getByRole('heading', { name: 'At the start of shift' })).toBeVisible();
    await auditTextContrast(page, theme, 'checklist editor');
    await page.screenshot({ path: testInfo.outputPath(`checklist-${theme}.png`), fullPage: true });
    await checkMobileWidth(page);

    const additionalScreens = [
      { link: 'Employees', heading: 'Employees', slug: 'employees' },
      { link: 'Shifts', heading: 'Shift schedule', slug: 'shifts' },
      { link: /Notifications/, heading: 'Notifications', slug: 'notifications' },
      { link: 'Announcements', heading: 'Announcements', slug: 'announcements' },
      { link: 'Shift handover', heading: 'Shift handover', slug: 'handover' },
      { link: 'Profile', heading: /^Profile$/, slug: 'profile' },
    ];
    for (const screen of additionalScreens) {
      await page.getByRole('link', { name: screen.link, exact: true }).click();
      await expect(page.getByRole('heading', { name: screen.heading })).toBeVisible();
      await auditTextContrast(page, theme, screen.slug);
      await page.screenshot({ path: testInfo.outputPath(`${screen.slug}-${theme}.png`), fullPage: true });
      await checkMobileWidth(page);
    }

    await page.getByRole('link', { name: 'Dashboard' }).click();
  }
});
