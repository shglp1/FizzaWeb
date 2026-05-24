import { prisma } from '../prisma';
import { getTripOpsConfig } from '../trips/tripConfig';
import type { DispatchConfig } from './types';

const DEFAULTS = {
  dispatchBufferMinutes: 15,
  defaultLegDurationMinutes: 45,
  defaultTravelMinutesNoCoords: 20,
  maxTripGenerationDays: 14,
};

function parseNum(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export async function getDispatchConfig(): Promise<DispatchConfig> {
  const [ops, rows] = await Promise.all([
    getTripOpsConfig(),
    prisma.systemConfiguration.findMany({
      where: {
        key: {
          in: [
            'dispatchBufferMinutes',
            'defaultLegDurationMinutes',
            'defaultTravelMinutesNoCoords',
            'maxTripGenerationDays',
          ],
        },
      },
      select: { key: true, value: true },
    }),
  ]);

  const cfg = { ...DEFAULTS };
  for (const row of rows) {
    if (row.key === 'dispatchBufferMinutes') cfg.dispatchBufferMinutes = parseNum(row.value, DEFAULTS.dispatchBufferMinutes);
    if (row.key === 'defaultLegDurationMinutes') cfg.defaultLegDurationMinutes = parseNum(row.value, DEFAULTS.defaultLegDurationMinutes);
    if (row.key === 'defaultTravelMinutesNoCoords') cfg.defaultTravelMinutesNoCoords = parseNum(row.value, DEFAULTS.defaultTravelMinutesNoCoords);
    if (row.key === 'maxTripGenerationDays') cfg.maxTripGenerationDays = parseNum(row.value, DEFAULTS.maxTripGenerationDays);
  }

  return {
    bufferMinutes: cfg.dispatchBufferMinutes,
    defaultLegDurationMinutes: cfg.defaultLegDurationMinutes,
    defaultTravelMinutesNoCoords: cfg.defaultTravelMinutesNoCoords,
    averageFallbackSpeedKmh: ops.averageFallbackSpeedKmh,
    generationHorizonDays: Math.min(31, Math.max(1, cfg.maxTripGenerationDays)),
  };
}

/** Pure helper for tests. */
export function mergeDispatchConfig(overrides: Partial<DispatchConfig>): DispatchConfig {
  return {
    bufferMinutes: 15,
    defaultLegDurationMinutes: 45,
    defaultTravelMinutesNoCoords: 20,
    averageFallbackSpeedKmh: 30,
    generationHorizonDays: 14,
    ...overrides,
  };
}
