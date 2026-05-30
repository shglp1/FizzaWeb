/** Saudi vehicle catalog — config-only (no DB migration required). */

export type VehicleCatalogEntry = {
  make: string;
  models: string[];
};

export const SAUDI_VEHICLE_CATALOG: VehicleCatalogEntry[] = [
  { make: 'Toyota', models: ['Camry', 'Corolla', 'Yaris', 'Fortuner', 'Hiace', 'Land Cruiser', 'RAV4'] },
  { make: 'Hyundai', models: ['Sonata', 'Elantra', 'Accent', 'Staria', 'H1', 'Tucson', 'Creta'] },
  { make: 'Kia', models: ['K5', 'Cerato', 'Pegas', 'Carnival', 'Sorento', 'Sportage', 'Seltos'] },
  { make: 'Nissan', models: ['Sunny', 'Altima', 'X-Trail', 'Urvan', 'Patrol', 'Kicks'] },
  { make: 'GMC', models: ['Yukon', 'Suburban', 'Sierra', 'Acadia'] },
  { make: 'Chevrolet', models: ['Tahoe', 'Suburban', 'Traverse', 'Malibu', 'Captiva'] },
  { make: 'Mercedes-Benz', models: ['V-Class', 'Sprinter', 'E-Class', 'S-Class', 'GLC'] },
  { make: 'BMW', models: ['5 Series', '7 Series', 'X5', 'X3'] },
  { make: 'Ford', models: ['Explorer', 'Taurus', 'Transit', 'Territory'] },
  { make: 'Honda', models: ['Accord', 'Civic', 'CR-V', 'Pilot'] },
  { make: 'Mazda', models: ['Mazda6', 'CX-5', 'CX-9'] },
  { make: 'Lexus', models: ['ES', 'RX', 'LX'] },
  { make: 'Changan', models: ['CS35', 'CS75', 'Eado'] },
  { make: 'Geely', models: ['Coolray', 'Emgrand', 'Azkarra'] },
];

export const VEHICLE_COLORS = [
  'White', 'Black', 'Silver', 'Gray', 'Blue', 'Red', 'Beige', 'Brown', 'Gold',
] as const;

export const MIN_VEHICLE_YEAR = 2020;

export function getModelsForMake(make: string): string[] {
  return SAUDI_VEHICLE_CATALOG.find((e) => e.make === make)?.models ?? [];
}

export function isValidCatalogMakeModel(make: string, model: string): boolean {
  const models = getModelsForMake(make);
  return models.includes(model);
}

export function formatCatalogVehicleLabel(make: string, model: string, year?: number | null): string {
  const parts = [make, model];
  if (year) parts.push(String(year));
  return parts.filter(Boolean).join(' ');
}

/** Resolve legacy application values into catalog make/model when possible. */
export function resolveLegacyVehicleFields(
  brand: string,
  model: string,
): { vehicleBrand: string; vehicleModel: string; isLegacy: boolean } {
  if (isValidCatalogMakeModel(brand, model)) {
    return { vehicleBrand: brand, vehicleModel: model, isLegacy: false };
  }
  const combined = `${brand} ${model}`.trim();
  for (const entry of SAUDI_VEHICLE_CATALOG) {
    if (combined.startsWith(`${entry.make} `)) {
      const rest = combined.slice(entry.make.length + 1).trim();
      if (entry.models.includes(rest)) {
        return { vehicleBrand: entry.make, vehicleModel: rest, isLegacy: false };
      }
    }
  }
  if (getModelsForMake(brand).length > 0) {
    return { vehicleBrand: brand, vehicleModel: model, isLegacy: true };
  }
  return { vehicleBrand: brand || 'Other', vehicleModel: model, isLegacy: true };
}
