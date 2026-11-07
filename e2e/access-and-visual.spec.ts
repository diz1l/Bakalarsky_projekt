import { expect, test } from '@playwright/test';

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@hotel.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Welcome back, John Admin')).toBeVisible();
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

test('light and dark themes keep visible text readable without mobile overflow', async ({ page }, testInfo) => {
  await signInAsAdmin(page);
  const themeButton = page.getByRole('button', { name: 'Dark' });
  await expect(themeButton).toBeVisible();

  for (const theme of ['dark', 'light'] as const) {
    await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const audit = await page.evaluate(() => {
      const parseColor = (value: string) => {
        const values = value.match(/[\d.]+/g)?.map(Number);
        if (!values || values.length < 3) return null;
        return [values[0], values[1], values[2], values[3] ?? 1] as const;
      };
      const luminance = (channel: number) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      const ratio = (foreground: number[], background: number[]) => {
        const fg = foreground.map(luminance);
        const bg = background.map(luminance);
        const foregroundLuminance = 0.2126 * fg[0] + 0.7152 * fg[1] + 0.0722 * fg[2];
        const backgroundLuminance = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
        return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
          / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
      };

      const rootBackground = parseColor(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
      const selectors = 'h1,h2,h3,h4,p,label,button,a,td,th,span,small,strong';
      const failures = [...document.querySelectorAll<HTMLElement>(selectors)]
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

          const contrast = ratio(foreground.slice(0, 3), background);
          return contrast < 4.5
            ? [{
              text: element.textContent.trim().replace(/\s+/g, ' ').slice(0, 48),
              contrast: Number(contrast.toFixed(2)),
              foreground: getComputedStyle(element).color,
              background: `rgb(${background.join(', ')})`,
            }]
            : [];
        });

      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        failures: failures.slice(0, 10),
        failureCount: failures.length,
      };
    });

    expect(audit.failures, `${theme} theme contrast failures: ${JSON.stringify(audit.failures)}`).toEqual([]);
    if (theme === 'light') {
      await page.screenshot({ path: testInfo.outputPath('dashboard-light.png'), fullPage: true });
    } else {
      await page.screenshot({ path: testInfo.outputPath('dashboard-dark.png'), fullPage: true });
    }
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
