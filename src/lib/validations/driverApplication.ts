import { z } from 'zod';
import { uploadedOrHttpUrl } from './upload.ts';

const VEHICLE_TYPES = ['ECONOMY', 'COMFORT', 'FAMILY', 'VAN', 'BUS', 'PREMIUM'] as const;

export const driverApplicationSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES, { required_error: 'Vehicle type is required' }),
  vehicleCategory: z.string().min(1, 'Vehicle category is required'),
  vehicleBrand: z.string().min(1, 'Vehicle brand is required'),
  vehicleModel: z.string().min(1, 'Vehicle model is required'),
  vehicleYear: z
    .number()
    .int()
    .min(2000, 'Vehicle year must be 2000 or later')
    .max(new Date().getFullYear() + 1, 'Vehicle year is too far in the future'),
  plateNumber: z.string().min(2, 'Plate number is required'),
  vehicleColor: z.string().min(1, 'Vehicle color is required'),
  vehicleCapacity: z.number().int().min(1).max(60),
  licenseNumber: z.string().min(3, 'License number is required'),
  driverLicenseUrl: uploadedOrHttpUrl.optional().or(z.literal('')),
  vehicleRegistrationUrl: uploadedOrHttpUrl.optional().or(z.literal('')),
  nationalIdUrl: uploadedOrHttpUrl.optional().or(z.literal('')),
  vehicleInsuranceUrl: uploadedOrHttpUrl.optional().or(z.literal('')),
  vehiclePhotoUrl: uploadedOrHttpUrl.optional().or(z.literal('')),
  driverNotes: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  serviceArea: z.string().min(1, 'Service area is required'),
  femaleDriver: z.boolean().optional().default(false),
});

export const adminReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'NEEDS_CHANGES']),
  adminResponse: z.string().optional(),
}).refine(
  (data) => data.action === 'APPROVE' || (data.adminResponse && data.adminResponse.trim().length > 0),
  { message: 'A reason is required when rejecting or requesting changes', path: ['adminResponse'] },
);

export type DriverApplicationInput = z.infer<typeof driverApplicationSchema>;
