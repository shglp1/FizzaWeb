/** Helpers for driver application document display (admin + tests). */

export type DriverApplicationDocuments = {
  nationalIdUrl?: string | null;
  driverLicenseUrl?: string | null;
  vehicleRegistrationUrl?: string | null;
  vehicleInsuranceUrl?: string | null;
  vehiclePhotoUrl?: string | null;
};

export const DRIVER_DOC_LABELS: Record<keyof DriverApplicationDocuments, string> = {
  nationalIdUrl: 'National ID / Iqama',
  driverLicenseUrl: 'Driving license',
  vehicleRegistrationUrl: 'Vehicle registration',
  vehicleInsuranceUrl: 'Vehicle insurance',
  vehiclePhotoUrl: 'Vehicle photo',
};

export function listDriverApplicationDocuments(
  app: DriverApplicationDocuments,
): { key: keyof DriverApplicationDocuments; label: string; url: string }[] {
  const keys = Object.keys(DRIVER_DOC_LABELS) as (keyof DriverApplicationDocuments)[];
  return keys
    .filter((k) => typeof app[k] === 'string' && (app[k] as string).trim().length > 0)
    .map((k) => ({ key: k, label: DRIVER_DOC_LABELS[k], url: app[k] as string }));
}

export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp)(\?|$)/i.test(url);
}
