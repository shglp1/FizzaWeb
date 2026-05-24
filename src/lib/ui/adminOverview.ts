/** Static overview KPI and quick-action configuration for admin homepage. */

import type { LucideIcon } from 'lucide-react';
import {
  Users,
  ClipboardList,
  Calendar,
  Wallet,
  CreditCard,
  Shield,
  FileText,
  MessageSquareWarning,
} from 'lucide-react';

export type OverviewKpiKey =
  | 'users'
  | 'activeSubscriptions'
  | 'tripsToday'
  | 'revenue'
  | 'pendingPayments'
  | 'openSafetyReports'
  | 'pendingApplications'
  | 'chatFlags';

export type OverviewKpiConfig = {
  key: OverviewKpiKey;
  label: string;
  icon: LucideIcon;
  color: string;
  section?: string;
};

export const OVERVIEW_KPI_CONFIG: OverviewKpiConfig[] = [
  { key: 'users', label: 'Users', icon: Users, color: '#3B82F6', section: 'users' },
  { key: 'activeSubscriptions', label: 'Active Subscriptions', icon: ClipboardList, color: '#10B981', section: 'subscriptions' },
  { key: 'tripsToday', label: 'Trips Today', icon: Calendar, color: '#0EA5E9', section: 'trips' },
  { key: 'revenue', label: 'Revenue', icon: Wallet, color: '#059669', section: 'financials' },
  { key: 'pendingPayments', label: 'Pending Payments', icon: CreditCard, color: '#EF4444', section: 'financials' },
  { key: 'openSafetyReports', label: 'Open Safety Reports', icon: Shield, color: '#F43F5E', section: 'safety' },
  { key: 'pendingApplications', label: 'Pending Applications', icon: FileText, color: '#F59E0B', section: 'applications' },
  { key: 'chatFlags', label: 'Chat Flags', icon: MessageSquareWarning, color: '#8B5CF6', section: 'audit' },
];

export type OverviewQuickAction = {
  label: string;
  section: string;
  description: string;
};

export const OVERVIEW_QUICK_ACTIONS: OverviewQuickAction[] = [
  { label: 'Generate trips', section: 'trips', description: 'Run trip generation for active subscriptions' },
  { label: 'Review applications', section: 'applications', description: 'Pending driver applications' },
  { label: 'View safety reports', section: 'safety', description: 'Open safety queue' },
  { label: 'Check late trips', section: 'trips', description: 'Operations board and late detection' },
  { label: 'System config', section: 'sysconfig', description: 'Pricing, distance, and ops settings' },
];
