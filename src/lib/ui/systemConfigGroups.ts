/** System configuration grouping metadata for admin UI tabs. */

export type ConfigFieldType = 'number' | 'text' | 'boolean';

export type ConfigFieldMeta = {
  label: string;
  type: ConfigFieldType;
  hint: string;
  defaultValue?: string | number | boolean;
  recommended?: string;
};

export type ConfigGroupId =
  | 'pricing'
  | 'trips'
  | 'tracking'
  | 'notifications'
  | 'chat'
  | 'payment'
  | 'payroll'
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
    recommended: '14',
  },
  dispatchBufferMinutes: {
    label: 'Dispatch Buffer (minutes)',
    type: 'number',
    hint: 'Safety buffer between consecutive trips when checking driver timeline feasibility.',
    defaultValue: 15,
    recommended: '15',
  },
  defaultLegDurationMinutes: {
    label: 'Default Leg Duration (minutes)',
    type: 'number',
    hint: 'Estimated trip leg duration when drop-off time is unknown.',
    defaultValue: 45,
    recommended: '45',
  },
  defaultTravelMinutesNoCoords: {
    label: 'Default Travel Time (minutes)',
    type: 'number',
    hint: 'Conservative travel time between trips when coordinates are missing.',
    defaultValue: 20,
    recommended: '20',
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
  loyaltyRedemptionEnabled: {
    label: 'Loyalty Redemption Enabled',
    type: 'boolean',
    hint: 'When true, parents can redeem points at checkout. Not yet implemented in the app — keep false until redemption ships.',
    defaultValue: false,
    recommended: 'false',
  },
  loyaltyRedemptionPointsPerSar: {
    label: 'Points Required per SAR Discount',
    type: 'number',
    hint: 'Future setting: how many points equal SAR 1 off at checkout. Redemption UI is not live yet.',
    defaultValue: 100,
    recommended: '100',
  },
  driverPayRatePerKmSar: {
    label: 'Driver pay rate per km (SAR)',
    type: 'number',
    hint: 'Default trip-based pay rate for drivers (billable km × rate). Separate from parent subscription pricing.',
    defaultValue: 1.5,
    recommended: '1.50',
  },
  driverPlatformFeePercent: {
    label: 'Driver platform fee (%)',
    type: 'number',
    hint: 'Percentage deducted from driver trip gross earnings before payout.',
    defaultValue: 15,
    recommended: '15',
  },
  chatOpenMinutesBeforePickup: {
    label: 'Chat opens (minutes before pickup)',
    type: 'number',
    hint: 'Parent and driver chat becomes available this many minutes before scheduled pickup.',
    defaultValue: 20,
    recommended: '20',
  },
  chatCloseMinutesAfterDropoff: {
    label: 'Chat closes (minutes after drop-off)',
    type: 'number',
    hint: 'Chat remains open for this long after trip completion, cancellation, or no-show.',
    defaultValue: 60,
    recommended: '60',
  },
  chatAllowImageAttachments: {
    label: 'Allow chat image attachments',
    type: 'boolean',
    hint: 'When enabled, users can attach photos in trip chat.',
    defaultValue: true,
    recommended: 'true',
  },
  chatMaxMessageLength: {
    label: 'Max chat message length',
    type: 'number',
    hint: 'Maximum characters per chat message.',
    defaultValue: 500,
    recommended: '500',
  },
  chatPollingIntervalSeconds: {
    label: 'Chat polling interval (seconds)',
    type: 'number',
    hint: 'How often clients poll for new chat messages.',
    defaultValue: 5,
    recommended: '5',
  },
  chatProfanityModerationEnabled: {
    label: 'Profanity moderation enabled',
    type: 'boolean',
    hint: 'When enabled, flagged profanity is blocked or moderated in chat.',
    defaultValue: true,
    recommended: 'true',
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
    keys: ['maxTripGenerationDays', 'dispatchBufferMinutes', 'defaultLegDurationMinutes', 'defaultTravelMinutesNoCoords'],
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
    description: 'In-trip chat timing, attachments, and moderation defaults.',
    keys: [
      'chatOpenMinutesBeforePickup',
      'chatCloseMinutesAfterDropoff',
      'chatAllowImageAttachments',
      'chatMaxMessageLength',
      'chatPollingIntervalSeconds',
      'chatProfanityModerationEnabled',
    ],
  },
  {
    id: 'payment',
    label: 'Payment',
    description: 'Loyalty rewards tied to payments.',
    keys: ['loyaltyPointsPerSar', 'loyaltyPointsOnSafetyApproval', 'loyaltyRedemptionEnabled', 'loyaltyRedemptionPointsPerSar'],
  },
  {
    id: 'payroll',
    label: 'Driver Payroll',
    description: 'Trip-based driver compensation defaults.',
    keys: ['driverPayRatePerKmSar', 'driverPlatformFeePercent'],
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
