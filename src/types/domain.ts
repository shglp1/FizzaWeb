export type Role = 'PARENT' | 'RIDER' | 'DRIVER' | 'ADMIN';

export type TripStatus =
  | 'SCHEDULED'
  | 'DRIVER_ASSIGNED'
  | 'ON_THE_WAY'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'CANCELLED';

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type SafetyStatus = 'PENDING' | 'APPROVED' | 'RESOLVED' | 'REJECTED';

export interface Rider {
  id: string;
  name: string;
  school: string;
  grade: string;
  active: boolean;
  relationship: string;
}
