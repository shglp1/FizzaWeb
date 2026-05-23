import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(9, 'Phone number must be at least 9 characters').optional(),
  /**
   * Identifies whether the account was created via the family portal or the
   * dedicated driver portal (/driver/register).  Defaults to "FAMILY".
   * Only "DRIVER_PORTAL" grants access to /driver-application for new users.
   */
  registrationSource: z.enum(['FAMILY', 'DRIVER_PORTAL']).optional().default('FAMILY'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});
