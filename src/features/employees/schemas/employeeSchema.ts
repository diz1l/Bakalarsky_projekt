import { z } from 'zod';

export const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone is required'),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE'], { required_error: 'Role is required' }),
  department: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  hireDate: z.string().min(1, 'Hire date is required'),
  status: z.enum(['active', 'inactive']),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;
