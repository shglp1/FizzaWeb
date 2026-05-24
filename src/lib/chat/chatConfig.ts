import { prisma } from '../prisma.ts';

export type ChatConfig = {
  chatOpenMinutesBeforePickup: number;
  chatCloseMinutesAfterDropoff: number;
  chatAllowImageAttachments: boolean;
  chatMaxMessageLength: number;
  chatPollingIntervalSeconds: number;
  chatProfanityModerationEnabled: boolean;
};

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  chatOpenMinutesBeforePickup: 20,
  chatCloseMinutesAfterDropoff: 60,
  chatAllowImageAttachments: true,
  chatMaxMessageLength: 500,
  chatPollingIntervalSeconds: 5,
  chatProfanityModerationEnabled: true,
};

const CHAT_KEYS = Object.keys(DEFAULT_CHAT_CONFIG) as (keyof ChatConfig)[];

function parseConfigValue(key: keyof ChatConfig, raw: unknown): ChatConfig[keyof ChatConfig] {
  const defaults = DEFAULT_CHAT_CONFIG;
  if (raw === null || raw === undefined) return defaults[key];
  if (typeof defaults[key] === 'boolean') {
    if (typeof raw === 'boolean') return raw as ChatConfig[keyof ChatConfig];
    const s = String(raw).toLowerCase();
    return (s === 'true' || s === '1') as ChatConfig[keyof ChatConfig];
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return n as ChatConfig[keyof ChatConfig];
  return defaults[key];
}

export async function loadChatConfig(): Promise<ChatConfig> {
  const rows = await prisma.systemConfiguration.findMany({
    where: { key: { in: [...CHAT_KEYS] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const config = { ...DEFAULT_CHAT_CONFIG };
  for (const key of CHAT_KEYS) {
    config[key] = parseConfigValue(key, map[key]) as never;
  }
  return config;
}

export function chatUnavailableLabel(openMinutesBefore: number): string {
  return `Chat opens ${openMinutesBefore} minutes before pickup.`;
}
