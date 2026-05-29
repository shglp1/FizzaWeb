import { z } from 'zod';
import { uploadedOrHttpUrl } from './upload.ts';
import { isValidSaudiPlate, normalizeSaudiPlate } from './saudiPlate.ts';
import { MIN_VEHICLE_YEAR, SAUDI_VEHICLE_CATALOG, isValidCatalogMakeModel } from '../vehicles/vehicleCatalog.ts';

const VEHICLE_TYPES = ['ECONOMY', 'COMFORT', 'FAMILY', 'VAN', 'BUS', 'PREMIUM'] as const;
const CATALOG_MAKES = SAUDI_VEHICLE_CATALOG.map((e) => e.make) as [string, ...string[]];

export const driverApplicationSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES, { required_error: 'Vehicle type is required' }),
  vehicleCategory: z.string().min(1, 'Vehicle category is required'),
  vehicleBrand: z.enum(CATALOG_MAKES, { required_error: 'Select a vehicle make from the catalog' }),
  vehicleModel: z.string().min(1, 'Vehicle model is required'),
  vehicleYear: z
    .number()
    .int()
    .min(MIN_VEHICLE_YEAR, `Vehicle must be ${MIN_VEHICLE_YEAR} or newer`)
    .max(new Date().getFullYear() + 1, 'Vehicle year is too far in the future'),
  plateNumber: z.string().min(3, 'Plate number is required').refine(isValidSaudiPlate, {
    message: 'Enter a valid Saudi plate (e.g. 1234 ABC 12)',
  }),
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
}).superRefine((data, ctx) => {
  if (!isValidCatalogMakeModel(data.vehicleBrand, data.vehicleModel)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select a valid model for the chosen make',
      path: ['vehicleModel'],
    });
  }
});

export function normalizeDriverApplicationInput(input: z.infer<typeof driverApplicationSchema>) {
  return {
    ...input,
    plateNumber: normalizeSaudiPlate(input.plateNumber),
  };
}

export const adminReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'NEEDS_CHANGES']),
  adminResponse: z.string().optional(),
}).refine(
  (data) => data.action === 'APPROVE' || (data.adminResponse && data.adminResponse.trim().length > 0),
  { message: 'A reason is required when rejecting or requesting changes', path: ['adminResponse'] },
);

export type DriverApplicationInput = z.infer<typeof driverApplicationSchema>;
