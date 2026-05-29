/**
 * Vehicle display helpers — catalog labels, legacy free-text parsing, placeholders.
 */
import {
  SAUDI_VEHICLE_CATALOG,
  formatCatalogVehicleLabel,
  getModelsForMake,
  isValidCatalogMakeModel,
} from './vehicleCatalog.ts';

export type VehicleLike = {
  model?: string | null;
  color?: string | null;
  plateNumber?: string | null;
  capacity?: number | null;
  make?: string | null;
  year?: number | null;
};

/** Parse legacy combined model strings like "Toyota Camry" or "Hyundai Sonata". */
export function parseLegacyVehicleModel(combined: string): { make: string; model: string } | null {
  const trimmed = combined.trim();
  if (!trimmed) return null;

  for (const entry of SAUDI_VEHICLE_CATALOG) {
    if (trimmed.startsWith(`${entry.make} `)) {
      const rest = trimmed.slice(entry.make.length + 1).trim();
      if (entry.models.includes(rest)) {
        return { make: entry.make, model: rest };
      }
      if (rest) return { make: entry.make, model: rest };
    }
  }
  return null;
}

/** Normalize vehicle fields for display — catalog or legacy free-text. */
export function normalizeVehicleForDisplay(vehicle: VehicleLike | null | undefined): {
  make: string | null;
  model: string;
  year: number | null;
  color: string | null;
  plateNumber: string | null;
  capacity: number | null;
  isLegacy: boolean;
  displayLabel: string;
} {
  if (!vehicle?.model) {
    return {
      make: null,
      model: 'Vehicle details pending',
      year: null,
      color: vehicle?.color ?? null,
      plateNumber: vehicle?.plateNumber ?? null,
      capacity: vehicle?.capacity ?? null,
      isLegacy: false,
      displayLabel: 'Vehicle details pending',
    };
  }

  const explicitMake = vehicle.make ?? null;
  const explicitModel = vehicle.model;
  const parsed = !explicitMake ? parseLegacyVehicleModel(explicitModel) : null;
  const make = explicitMake ?? parsed?.make ?? null;
  const model = parsed?.model ?? explicitModel;
  const isLegacy = Boolean(
    make && model && !isValidCatalogMakeModel(make, model.split(' ').pop() ?? model),
  ) || Boolean(!make && !parsed);

  const displayLabel = make
    ? formatCatalogVehicleLabel(make, model.replace(`${make} `, ''), vehicle.year)
    : explicitModel;

  return {
    make,
    model,
    year: vehicle.year ?? null,
    color: vehicle.color ?? null,
    plateNumber: vehicle.plateNumber ?? null,
    capacity: vehicle.capacity ?? null,
    isLegacy,
    displayLabel,
  };
}

/** Vehicle illustration path by make/category — local assets only. */
const MAKE_IMAGE_PATH: Record<string, string> = {
  Toyota: '/vehicles/sedan-default.svg',
  Hyundai: '/vehicles/sedan-default.svg',
  Kia: '/vehicles/sedan-default.svg',
  Nissan: '/vehicles/sedan-default.svg',
  Honda: '/vehicles/sedan-default.svg',
  Mazda: '/vehicles/sedan-default.svg',
  BMW: '/vehicles/sedan-default.svg',
  Lexus: '/vehicles/sedan-default.svg',
  Changan: '/vehicles/sedan-default.svg',
  Geely: '/vehicles/sedan-default.svg',
  GMC: '/vehicles/suv-default.svg',
  Chevrolet: '/vehicles/suv-default.svg',
  Ford: '/vehicles/suv-default.svg',
  'Mercedes-Benz': '/vehicles/van-default.svg',
};

const VAN_MODELS = new Set(['Hiace', 'Staria', 'H1', 'Urvan', 'Sprinter', 'V-Class', 'Carnival', 'Transit']);

export function getVehicleImagePath(make: string | null, model?: string | null): string {
  if (make && MAKE_IMAGE_PATH[make]) {
    if (model && VAN_MODELS.has(model)) return '/vehicles/van-default.svg';
    if (make === 'GMC' || make === 'Chevrolet' || make === 'Ford') return '/vehicles/suv-default.svg';
    return MAKE_IMAGE_PATH[make];
  }
  return '/vehicles/generic-default.svg';
}

export function getVehiclePlaceholderKey(make: string | null): string {
  const path = getVehicleImagePath(make);
  if (path.includes('suv')) return 'suv-default';
  if (path.includes('van')) return 'van-default';
  if (path.includes('sedan')) return 'sedan-default';
  return 'generic-default';
}

export function formatVehicleDisplayLine(vehicle: VehicleLike | null | undefined): string {
  const n = normalizeVehicleForDisplay(vehicle);
  const parts = [n.color, n.displayLabel].filter(Boolean);
  if (n.plateNumber) parts.push(n.plateNumber);
  if (n.capacity) parts.push(`${n.capacity} seats`);
  return parts.join(' · ') || 'Vehicle assigned';
}
