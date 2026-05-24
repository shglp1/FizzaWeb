/**
 * Central icon helpers — lucide-react only in UI (Task 13).
 */
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarDays,
  Car,
  CarFront,
  ClipboardList,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Navigation,
  Receipt,
  Route,
  Settings,
  Shield,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
  ClipboardCheck,
  Search,
  Ban,
  Radio,
  type LucideProps,
} from 'lucide-react';

export {
  Bell,
  CalendarDays,
  Car,
  CarFront,
  ClipboardList,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Navigation,
  Receipt,
  Route,
  Settings,
  Shield,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
  ClipboardCheck,
  Search,
  Ban,
  Radio,
};

const EMPTY_ICON_MAP: Record<string, LucideIcon> = {
  clipboard: ClipboardList,
  calendar: CalendarDays,
  map: MapPin,
  shield: Shield,
  bell: Bell,
  card: CreditCard,
  wallet: Wallet,
  users: Users,
  car: Car,
  file: FileText,
  settings: Settings,
  radio: Radio,
  pin: MapPin,
  rider: UserRound,
};

export type AppIconProps = LucideProps & {
  icon: LucideIcon;
};

/** Renders a lucide icon at consistent enterprise size. */
export function AppIcon({ icon: Icon, className = '', size = 20, ...props }: AppIconProps) {
  return <Icon className={className} size={size} strokeWidth={1.75} aria-hidden {...props} />;
}

export function resolveEmptyIcon(icon: string): LucideIcon {
  return EMPTY_ICON_MAP[icon] ?? Inbox;
}
