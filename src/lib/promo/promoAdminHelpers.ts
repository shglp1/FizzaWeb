/** Pure helpers for admin promo code management — testable without DB. */

export type PromoCodeStatus = 'active' | 'expired' | 'disabled' | 'exhausted';

export type PromoCodeSummary = {
  id: string;
  code: string;
  partnerName: string | null;
  discountPercent: number;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | Date | null;
  isActive: boolean;
  totalDiscountSar: string | number;
  totalPaidSar: string | number;
  notes: string | null;
  createdAt: string | Date;
};

export type PromoStatusFilter = 'all' | PromoCodeStatus;
export type PromoSortKey = 'newest' | 'most_used' | 'highest_revenue';

const CAMPAIGN_PREFIX = 'Campaign: ';

export function normalizePromoCodeInput(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function encodePromoNotes(campaignName?: string | null, notes?: string | null): string | null {
  const parts: string[] = [];
  if (campaignName?.trim()) parts.push(`${CAMPAIGN_PREFIX}${campaignName.trim()}`);
  if (notes?.trim()) parts.push(notes.trim());
  return parts.length ? parts.join('\n') : null;
}

export function decodePromoNotes(notes: string | null | undefined): {
  campaignName: string | null;
  notes: string | null;
} {
  if (!notes?.trim()) return { campaignName: null, notes: null };
  const lines = notes.split('\n');
  if (lines[0]?.startsWith(CAMPAIGN_PREFIX)) {
    return {
      campaignName: lines[0].slice(CAMPAIGN_PREFIX.length).trim() || null,
      notes: lines.slice(1).join('\n').trim() || null,
    };
  }
  return { campaignName: null, notes: notes.trim() };
}

export function getPromoCodeStatus(promo: Pick<
  PromoCodeSummary,
  'isActive' | 'expiresAt' | 'maxUses' | 'useCount'
>): PromoCodeStatus {
  if (!promo.isActive) return 'disabled';
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) return 'expired';
  if (promo.maxUses != null && promo.useCount >= promo.maxUses) return 'exhausted';
  return 'active';
}

export function remainingPromoUses(promo: Pick<PromoCodeSummary, 'maxUses' | 'useCount'>): number | null {
  if (promo.maxUses == null) return null;
  return Math.max(0, promo.maxUses - promo.useCount);
}

export function averageOrderAfterDiscount(promo: Pick<PromoCodeSummary, 'useCount' | 'totalPaidSar'>): number {
  const uses = promo.useCount;
  if (uses <= 0) return 0;
  return Math.round((Number(promo.totalPaidSar) / uses) * 100) / 100;
}

export function isPromoExpiringSoon(
  promo: Pick<PromoCodeSummary, 'expiresAt' | 'isActive'>,
  withinDays = 7,
  now = Date.now(),
): boolean {
  if (!promo.isActive || !promo.expiresAt) return false;
  const expiry = new Date(promo.expiresAt).getTime();
  if (expiry <= now) return false;
  return expiry - now <= withinDays * 24 * 60 * 60 * 1000;
}

export function computePromoKpis(codes: PromoCodeSummary[]) {
  const active = codes.filter((c) => getPromoCodeStatus(c) === 'active').length;
  const totalRedemptions = codes.reduce((sum, c) => sum + c.useCount, 0);
  const totalDiscount = codes.reduce((sum, c) => sum + Number(c.totalDiscountSar), 0);
  const totalPaid = codes.reduce((sum, c) => sum + Number(c.totalPaidSar), 0);
  const expiringSoon = codes.filter((c) => isPromoExpiringSoon(c)).length;
  return { active, totalRedemptions, totalDiscount, totalPaid, expiringSoon };
}

export function filterPromoCodes(
  codes: PromoCodeSummary[],
  search: string,
  status: PromoStatusFilter,
): PromoCodeSummary[] {
  const q = search.trim().toLowerCase();
  return codes.filter((c) => {
    const codeStatus = getPromoCodeStatus(c);
    if (status !== 'all' && codeStatus !== status) return false;
    if (!q) return true;
    const { campaignName } = decodePromoNotes(c.notes);
    const haystack = [c.code, c.partnerName ?? '', campaignName ?? ''].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function sortPromoCodes(codes: PromoCodeSummary[], sort: PromoSortKey): PromoCodeSummary[] {
  const copy = [...codes];
  switch (sort) {
    case 'most_used':
      return copy.sort((a, b) => b.useCount - a.useCount || b.createdAt.toString().localeCompare(a.createdAt.toString()));
    case 'highest_revenue':
      return copy.sort(
        (a, b) => Number(b.totalPaidSar) - Number(a.totalPaidSar) || b.createdAt.toString().localeCompare(a.createdAt.toString()),
      );
    case 'newest':
    default:
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export type PromoFormInput = {
  code: string;
  discountPercent: string;
  partnerName: string;
  campaignName: string;
  maxUses: string;
  expiresAt: string;
  isActive: boolean;
  notes: string;
};

export function validatePromoForm(
  form: PromoFormInput,
  existingCodes: PromoCodeSummary[],
  editingId?: string | null,
): string | null {
  const code = normalizePromoCodeInput(form.code);
  if (code.length < 3) return 'Code must be at least 3 characters';
  if (/\s/.test(form.code.trim())) return 'Code cannot contain spaces';
  if (!/^[A-Z0-9_-]+$/.test(code)) return 'Use letters, numbers, dash or underscore only';

  const duplicate = existingCodes.find((c) => c.code === code && c.id !== editingId);
  if (duplicate) return 'This code already exists';

  const pct = Number(form.discountPercent);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return 'Discount must be between 1 and 100';

  if (form.maxUses.trim()) {
    const max = Number(form.maxUses);
    if (!Number.isInteger(max) || max < 1) return 'Max uses must be a positive whole number';
  }

  if (form.isActive && form.expiresAt) {
    const expiry = new Date(form.expiresAt).getTime();
    if (Number.isFinite(expiry) && expiry <= Date.now()) {
      return 'Expiry must be in the future for an active code';
    }
  }

  return null;
}

export function promoCodesToCsv(codes: PromoCodeSummary[]): string {
  const header = [
    'Code',
    'Discount %',
    'Partner',
    'Status',
    'Uses',
    'Max Uses',
    'Remaining',
    'Total Discount SAR',
    'Total Paid SAR',
    'Expiry',
    'Created',
  ];
  const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = codes.map((c) => {
    const status = getPromoCodeStatus(c);
    const remaining = remainingPromoUses(c);
    return [
      c.code,
      String(c.discountPercent),
      c.partnerName ?? '',
      status,
      String(c.useCount),
      c.maxUses != null ? String(c.maxUses) : 'unlimited',
      remaining != null ? String(remaining) : 'unlimited',
      Number(c.totalDiscountSar).toFixed(2),
      Number(c.totalPaidSar).toFixed(2),
      c.expiresAt ? new Date(c.expiresAt).toISOString() : '',
      new Date(c.createdAt).toISOString(),
    ]
      .map(escape)
      .join(',');
  });
  return [header.join(','), ...lines].join('\n');
}
