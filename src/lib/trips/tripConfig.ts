/**
 * Trip operations configuration from SystemConfiguration + defaults.
 */
import { prisma } from '@/lib/prisma';

export type TripOpsConfig = {
  etaNearThresholdMinutes: number;
  pickupNearThresholdMeters: number;
  dropoffNearThresholdMeters: number;
  averageFallbackSpeedKmh: number;
  notificationCooldownMinutes: number;
  driverLateAfterMinutes: number;
};

const DEFAULTS: TripOpsConfig = {
  etaNearThresholdMinutes: 5,
  pickupNearThresholdMeters: 100,
  dropoffNearThresholdMeters: 100,
  averageFallbackSpeedKmh: 30,
  notificationCooldownMinutes: 10,
  driverLateAfterMinutes: 15,
};

function parseNum(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedConfig: { value: TripOpsConfig; at: number } | null = null;

export async function getTripOpsConfig(): Promise<TripOpsConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedConfig.at < CONFIG_CACHE_TTL_MS) {
    return cachedConfig.value;
  }

  const keys = Object.keys(DEFAULTS);
  const rows = await prisma.systemConfiguration.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });

  const config = { ...DEFAULTS };
  for (const row of rows) {
    const k = row.key as keyof TripOpsConfig;
    if (k in config) {
      config[k] = parseNum(row.value, DEFAULTS[k]);
    }
  }
  cachedConfig = { value: config, at: now };
  return config;
}

/** Pure helper for tests — merge overrides onto defaults. */
export function mergeTripOpsConfig(overrides: Partial<TripOpsConfig>): TripOpsConfig {
  return { ...DEFAULTS, ...overrides };
}
