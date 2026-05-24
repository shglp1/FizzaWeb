/** Human-readable audit log formatting for admin UI. */

export type AuditSeverity = 'info' | 'success' | 'warning' | 'danger' | 'admin';

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  REGISTER: 'Account registered',
  PROFILE_UPDATED: 'Profile updated',
  DRIVER_APPLICATION_SUBMITTED: 'Driver application submitted',
  DRIVER_APPLICATION_RESUBMITTED: 'Driver application resubmitted',
  DRIVER_APPROVED: 'Driver application approved',
  DRIVER_REJECTED: 'Driver application rejected',
  DRIVER_SUSPENDED: 'Driver suspended',
  DRIVER_ASSIGNED: 'Driver assigned to trip',
  SUBSCRIPTION_DRIVER_ASSIGNED: 'Driver assigned to subscription',
  SUBSCRIPTION_UPDATED: 'Subscription updated',
  SUBSCRIPTION_CANCELLED: 'Subscription cancelled',
  ADMIN_SUBSCRIPTION_CREATED: 'Subscription created by admin',
  ADMIN_SUBSCRIPTION_CANCELLED: 'Subscription cancelled by admin',
  PAYMENT_CREATED: 'Payment created',
  ONLINE_PAYMENT_CONFIRMED: 'Online payment confirmed',
  ONLINE_PAYMENT_FAILED: 'Online payment failed',
  WALLET_TOP_UP_CONFIRMED: 'Wallet top-up confirmed',
  SUBSCRIPTION_WALLET_PAYMENT: 'Subscription paid from wallet',
  SAFETY_REPORT_CREATED: 'Safety report submitted',
  SAFETY_REPORT_APPROVED: 'Safety report approved',
  SAFETY_REPORT_REJECTED: 'Safety report rejected',
  SYSTEM_CONFIG_UPDATED: 'System configuration updated',
  ADMIN_USER_UPDATED: 'User updated by admin',
  ADMIN_PACKAGE_CREATED: 'Package created',
  ADMIN_PACKAGE_UPDATED: 'Package updated',
  ADMIN_PACKAGE_DEACTIVATED: 'Package deactivated',
  ADMIN_PACKAGE_DELETED: 'Package deleted',
  ADMIN_ADDON_CREATED: 'Add-on created',
  ADMIN_ADDON_UPDATED: 'Add-on updated',
  ADMIN_ADDON_DEACTIVATED: 'Add-on deactivated',
  ADMIN_ADDON_DELETED: 'Add-on deleted',
  TRIPS_GENERATED: 'Trips generated',
  TRIP_DRIVER_REASSIGNED: 'Trip driver reassigned',
  LATE_CHECK_RUN: 'Late trip check run',
  CHAT_MESSAGE_MODERATED: 'Chat message moderated',
  CHAT_UNBLOCK: 'Chat block removed',
  USER_CHAT_BLOCKED: 'User chat blocked',
  DRIVER_CHAT_BLOCKED: 'Driver chat blocked',
};

const ACTION_SEVERITY: Record<string, AuditSeverity> = {
  DRIVER_REJECTED: 'danger',
  DRIVER_SUSPENDED: 'danger',
  ONLINE_PAYMENT_FAILED: 'danger',
  SAFETY_REPORT_REJECTED: 'danger',
  DRIVER_APPROVED: 'success',
  SAFETY_REPORT_APPROVED: 'success',
  ONLINE_PAYMENT_CONFIRMED: 'success',
  WALLET_TOP_UP_CONFIRMED: 'success',
  SYSTEM_CONFIG_UPDATED: 'admin',
  ADMIN_USER_UPDATED: 'admin',
  ADMIN_SUBSCRIPTION_CREATED: 'admin',
  ADMIN_PACKAGE_CREATED: 'admin',
  ADMIN_ADDON_CREATED: 'admin',
  DRIVER_APPLICATION_SUBMITTED: 'warning',
  SAFETY_REPORT_CREATED: 'warning',
};

const ADMIN_ACTION_PREFIXES = ['ADMIN_', 'SYSTEM_'];

export function formatAuditAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function getAuditSeverity(action: string): AuditSeverity {
  if (ACTION_SEVERITY[action]) return ACTION_SEVERITY[action];
  if (ADMIN_ACTION_PREFIXES.some((p) => action.startsWith(p))) return 'admin';
  return 'info';
}

export function isCriticalAuditAction(action: string): boolean {
  const sev = getAuditSeverity(action);
  return sev === 'danger' || sev === 'admin';
}

type ParsedDetails = Record<string, unknown>;

export function parseAuditDetails(raw: string | null): ParsedDetails | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ParsedDetails;
    }
    return { value: parsed };
  } catch {
    return { note: raw };
  }
}

export function summarizeAuditDetails(action: string, raw: string | null): string {
  const details = parseAuditDetails(raw);
  if (!details) return 'No additional details';

  const parts: string[] = [];

  if (typeof details.subscriptionId === 'string') parts.push(`Subscription ${details.subscriptionId.slice(-8)}`);
  if (typeof details.tripId === 'string') parts.push(`Trip ${details.tripId.slice(-8)}`);
  if (typeof details.driverId === 'string') parts.push(`Driver ${details.driverId.slice(-8)}`);
  if (typeof details.userId === 'string') parts.push(`User ${details.userId.slice(-8)}`);
  if (typeof details.amountSar !== 'undefined') parts.push(`Amount SAR ${Number(details.amountSar).toFixed(2)}`);
  if (typeof details.status === 'string') parts.push(`Status ${details.status}`);
  if (typeof details.reason === 'string') parts.push(details.reason);
  if (typeof details.keys === 'object' && Array.isArray(details.keys)) {
    parts.push(`Updated ${(details.keys as string[]).join(', ')}`);
  }
  if (typeof details.generated === 'number') {
    parts.push(`${details.generated} trips generated`);
  }

  if (parts.length > 0) return parts.join(' · ');

  const keys = Object.keys(details).slice(0, 3);
  if (keys.length === 0) return 'Event recorded';
  return keys.map((k) => `${k}: ${String(details[k]).slice(0, 40)}`).join(' · ');
}

export function formatAuditTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-SA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
