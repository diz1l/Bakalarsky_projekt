import { z } from 'zod';

export const profileInfoSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  login: z.string().min(3, 'Login must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
});

export type ProfileInfoFormData = z.infer<typeof profileInfoSchema>;
