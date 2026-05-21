import { z } from 'zod';

export const DRIVER_TRANSITIONS: Record<string, string[]> = {
  DRIVER_ASSIGNED: ['ON_THE_WAY'],
  ON_THE_WAY: ['PICKED_UP'],
  PICKED_UP: ['COMPLETED'],
};

export const ADMIN_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED'],
  DRIVER_ASSIGNED: ['ON_THE_WAY', 'PICKED_UP', 'COMPLETED'],
  ON_THE_WAY: ['PICKED_UP', 'COMPLETED'],
  PICKED_UP: ['COMPLETED'],
};

export function isValidStatusTransition(
  current: string,
  next: string,
  role: string,
): boolean {
  const allowed =
    role === 'ADMIN' ? ADMIN_TRANSITIONS[current] : DRIVER_TRANSITIONS[current];
  return (allowed ?? []).includes(next);
}

// Statuses a parent is allowed to cancel from
export const CANCELLABLE_BY_PARENT = ['SCHEDULED', 'DRIVER_ASSIGNED'];

export const tripStatusUpdateSchema = z.object({
  status: z.enum(['DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED'], {
    required_error: 'Status is required',
  }),
});

export const driverLocationSchema = z.object({
  lat: z.number().min(-90, 'Latitude must be between -90 and 90').max(90),
  lng: z.number().min(-180, 'Longitude must be between -180 and 180').max(180),
});

export const driverAssignSchema = z.object({
  driverId: z.string().uuid('Driver ID must be a valid UUID'),
});

export const tripGenerateSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD')
    .optional(),
});
