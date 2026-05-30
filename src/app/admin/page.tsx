'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Ban } from 'lucide-react';
import { AdminShell } from '@/components/layout/AdminShell';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ADMIN_SECTION_LABELS, parseAdminSection } from '@/lib/adminNav';
import { PageHeader, LoadingState } from '@/components/ui';
import { OverviewSection } from './sections/OverviewSection';
import { UsersSection } from './sections/UsersSection';
import { RidersSection } from './sections/RidersSection';
import { DriversSection } from './sections/DriversSection';
import { ApplicationsSection } from './sections/ApplicationsSection';
import { SubscriptionsSection } from './sections/SubscriptionsSection';
import { FinancialsSection } from './sections/FinancialsSection';
import { PayrollSection } from './sections/PayrollSection';
import { SystemConfigSection } from './sections/SystemConfigSection';
import { PackagesSection } from './sections/PackagesSection';
import { PromoCodesSection } from './sections/PromoCodesSection';
import { MapPlacesSection } from './sections/MapPlacesSection';
import { TripsSection } from './sections/TripsSection';
import { LiveOperationsSection } from './sections/LiveOperationsSection';
import { FinancialReviewSection } from './sections/FinancialReviewSection';
import { SafetySection } from './sections/SafetySection';
import { AuditLogsSection } from './sections/AuditLogsSection';

const ROLE_REFRESH_HINT =
  'If your role was recently changed to Admin, sign out and sign in again to refresh your session.';

function AdminForbidden() {
  return (
    <div className="min-h-screen bg-fizza-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center card-md p-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 mb-4">
          <Ban className="h-8 w-8 text-red-500" strokeWidth={1.75} aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Admin access required</h1>
        <p className="text-sm text-gray-500 mb-4">You do not have permission to view the admin dashboard.</p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-6">{ROLE_REFRESH_HINT}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/dashboard" className="btn-primary btn-md">Go to Dashboard</a>
          <button
            type="button"
            className="btn-secondary btn-md"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/admin-port?from=/admin';
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, isUnauthorized } = useCurrentUser();
  const activeSection = parseAdminSection(searchParams.get('section'));

  useEffect(() => {
    if (loading) return;
    if (isUnauthorized) {
      window.location.href = '/login?from=/admin';
      return;
    }
    if (user && user.role !== 'ADMIN') {
      const dest =
        user.driverState === 'APPROVED_DRIVER'
          ? '/driver/dashboard'
          : user.driverState === 'DRIVER_APPLICANT'
          ? '/driver-application'
          : '/forbidden';
      router.replace(dest);
    }
  }, [loading, isUnauthorized, user, router]);

  if (loading) {
    return (
      <AdminShell>
        <LoadingState message="Loading admin dashboard…" />
      </AdminShell>
    );
  }

  if (isUnauthorized || !user || user.role !== 'ADMIN') {
    return <AdminForbidden />;
  }

  return (
    <AdminShell>
      <PageHeader title={ADMIN_SECTION_LABELS[activeSection]} subtitle="Platform management and operations" />
      <p className="text-xs text-gray-400 -mt-4 mb-6 hidden md:block">Admin session active. {ROLE_REFRESH_HINT}</p>

      <div className="min-w-0">
        {activeSection === 'overview' && <OverviewSection onNavigate={(s) => router.push(`/admin?section=${s}`, { scroll: false })} />}
        {activeSection === 'users' && <UsersSection />}
        {activeSection === 'riders' && <RidersSection />}
        {activeSection === 'drivers' && <DriversSection />}
        {activeSection === 'applications' && <ApplicationsSection />}
        {activeSection === 'subscriptions' && <SubscriptionsSection />}
        {activeSection === 'trips' && <TripsSection />}
        {activeSection === 'live-ops' && <LiveOperationsSection />}
        {activeSection === 'financial-review' && <FinancialReviewSection />}
        {activeSection === 'financials' && <FinancialsSection />}
        {activeSection === 'payroll' && <PayrollSection />}
        {activeSection === 'safety' && <SafetySection />}
        {activeSection === 'packages' && <PackagesSection />}
        {activeSection === 'promo-codes' && <PromoCodesSection />}
        {activeSection === 'map-places' && <MapPlacesSection />}
        {activeSection === 'sysconfig' && <SystemConfigSection />}
        {activeSection === 'audit' && <AuditLogsSection />}
      </div>
    </AdminShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-fizza-bg flex items-center justify-center">
          <LoadingState message="Loading admin dashboard…" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
