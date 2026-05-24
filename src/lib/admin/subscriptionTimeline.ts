import { inferEndDateFromPackage } from '../pricing/serviceDays.ts';

type TimelineInput = {
  startsOn?: Date | string | null;
  endsOn?: Date | string | null;
  createdAt?: Date | string | null;
  package?: { billingCycle?: string | null } | null;
};

export function resolveEffectiveServiceDates(sub: TimelineInput): {
  startsOn: Date | null;
  endsOn: Date | null;
} {
  const startsOn = sub.startsOn
    ? new Date(sub.startsOn)
    : sub.createdAt
      ? new Date(sub.createdAt)
      : null;

  if (sub.endsOn) {
    return { startsOn, endsOn: new Date(sub.endsOn) };
  }

  if (!startsOn) {
    return { startsOn: null, endsOn: null };
  }

  const billingCycle = sub.package?.billingCycle ?? 'monthly';
  return { startsOn, endsOn: inferEndDateFromPackage(startsOn, billingCycle) };
}

export function computeSubscriptionDaysLeft(sub: TimelineInput): number | null {
  const { endsOn } = resolveEffectiveServiceDates(sub);
  if (!endsOn) return null;
  return Math.max(0, Math.ceil((endsOn.getTime() - Date.now()) / 86_400_000));
}
