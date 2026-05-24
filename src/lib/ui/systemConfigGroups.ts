/** System configuration grouping metadata for admin UI tabs. */

export type ConfigFieldType = 'number' | 'text';

export type ConfigFieldMeta = {
  label: string;
  type: ConfigFieldType;
  hint: string;
  defaultValue?: string | number;
  recommended?: string;
};

export type ConfigGroupId =
  | 'pricing'
  | 'trips'
  | 'tracking'
  | 'notifications'
  | 'chat'
  | 'payment'
  | 'support';

export type ConfigGroup = {
  id: ConfigGroupId;
  label: string;
  description: string;
  keys: string[];
};

export const CONFIG_FIELD_META: Record<string, ConfigFieldMeta> = {
  pricePerKmSar: {
    label: 'Price per KM (SAR)',
    type: 'number',
    hint: 'Distance charge per kilometre added to subscription price. Changing this affects new quotes only.',
    defaultValue: 2,
    recommended: '2.00',
  },
  extraRiderSameDropoffMultiplier: {
    label: 'Extra Rider Multiplier',
    type: 'number',
    hint: 'Fraction of primary price charged for each additional rider on the same dropoff.',
    defaultValue: 0.5,
    recommended: '0.50',
  },
  maxTripGenerationDays: {
    label: 'Max Trip Generation Days',
    type: 'number',
    hint: 'Maximum days ahead that trips are auto-generated from active subscriptions.',
    defaultValue: 7,
    recommended: '7',
  },
  supportPhone: {
    label: 'Support Phone',
    type: 'text',
    hint: 'Customer-facing support phone number shown in the app.',
    recommended: '+966XXXXXXXXX',
  },
  supportWhatsApp: {
    label: 'Support WhatsApp',
    type: 'text',
    hint: 'Customer-facing WhatsApp number for support contact.',
    recommended: '+966XXXXXXXXX',
  },
  notificationLeadTimeMinutes: {
    label: 'Notification Lead Time (minutes)',
    type: 'number',
    hint: 'Minutes before pickup that the pickup reminder notification is sent.',
    defaultValue: 30,
    recommended: '30',
  },
  loyaltyPointsPerSar: {
    label: 'Loyalty Points per SAR',
    type: 'number',
    hint: 'Loyalty points awarded for each SAR paid.',
    defaultValue: 1,
    recommended: '1',
  },
  loyaltyPointsOnSafetyApproval: {
    label: 'Loyalty Points on Safety Approval',
    type: 'number',
    hint: 'Bonus loyalty points awarded when a safety report is approved.',
    defaultValue: 50,
    recommended: '50',
  },
};

export const CONFIG_GROUPS: ConfigGroup[] = [
  {
    id: 'pricing',
    label: 'Pricing',
    description: 'Distance-based pricing and multi-rider calculations.',
    keys: ['pricePerKmSar', 'extraRiderSameDropoffMultiplier'],
  },
  {
    id: 'trips',
    label: 'Trip Generation',
    description: 'Automated trip scheduling horizon.',
    keys: ['maxTripGenerationDays'],
  },
  {
    id: 'tracking',
    label: 'Tracking & GPS',
    description: 'Distance provider and routing configuration (environment-based).',
    keys: [],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Pickup reminders and customer alerts.',
    keys: ['notificationLeadTimeMinutes'],
  },
  {
    id: 'chat',
    label: 'Chat & Moderation',
    description: 'In-trip chat moderation settings (managed via chat flags panel).',
    keys: [],
  },
  {
    id: 'payment',
    label: 'Payment',
    description: 'Loyalty rewards tied to payments.',
    keys: ['loyaltyPointsPerSar', 'loyaltyPointsOnSafetyApproval'],
  },
  {
    id: 'support',
    label: 'Support',
    description: 'Customer support contact details.',
    keys: ['supportPhone', 'supportWhatsApp'],
  },
];

export function getConfigFieldStatus(
  key: string,
  value: string,
): 'configured' | 'missing' | 'warning' {
  const meta = CONFIG_FIELD_META[key];
  if (!meta) return 'configured';
  if (!value.trim()) return 'missing';
  if (meta.type === 'number') {
    const n = parseFloat(value);
    if (Number.isNaN(n) || n < 0) return 'warning';
  }
  return 'configured';
}

export const ALL_CONFIG_KEYS = Object.keys(CONFIG_FIELD_META);
