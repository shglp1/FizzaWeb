import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().min(9, 'Phone number must be at least 9 characters').optional(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});
