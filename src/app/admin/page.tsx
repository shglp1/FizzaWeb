'use client';
import { Suspense } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminShell } from '@/components/layout/AdminShell';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  ADMIN_SECTION_LABELS,
  parseAdminSection,
  type AdminSection,
} from '@/lib/adminNav';
import {
  PageHeader, Card, Alert, StatusBadge, Button, Textarea,
  Tabs, Pagination, LoadingState, ErrorState, EmptyState,
} from '@/components/ui';
import { driverApplicationService } from '@/services/driverApplicationService';
import { tripService } from '@/services/tripService';
import { safetyService } from '@/services/safetyService';
import { tripToGoogleMapsUrl, buildGoogleMapsPlaceUrl } from '@/lib/maps/googleMapsLink';
import { OverviewSection } from './sections/OverviewSection';
import { UsersSection } from './sections/UsersSection';
import { RidersSection } from './sections/RidersSection';
import { DriversSection } from './sections/DriversSection';
import { SubscriptionsSection } from './sections/SubscriptionsSection';
import { FinancialsSection } from './sections/FinancialsSection';
import { SystemConfigSection } from './sections/SystemConfigSection';
import { PackagesSection } from './sections/PackagesSection';
import { TripOperationsBoard } from './sections/TripOperationsBoard';
import { AuditLogsSection } from './sections/AuditLogsSection';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';

type Application = {
  id: string;
  status: AppStatus;
  vehicleType: string;
  vehicleCategory: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  plateNumber: string;
  vehicleColor: string;
  vehicleCapacity: number;
  licenseNumber: string;
  city: string;
  serviceArea: string;
  femaleDriver: boolean;
  driverNotes: string | null;
  adminResponse: string | null;
  submittedAt: string;
  resubmittedAt: string | null;
  applicant: { fullName: string; phone: string | null; user: { email: string } };
  reviewer: { fullName: string } | null;
};

type TripStatus = 'SCHEDULED' | 'DRIVER_ASSIGNED' | 'ON_THE_WAY' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED';

type AdminTrip = {
  id: string;
  status: TripStatus;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  actualPickupTime: string | null;
  actualDropoffTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  rider: { id: string; name: string; relationship: string } | null;
  driver: { id: string; rating: string | null; profile: { fullName: string; phone: string | null } | null } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
  subscription: { id: string; subscriptionType: string } | null;
};

type Driver = {
  id: string;
  rating: string | null;
  profile: { fullName: string; phone: string | null } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
};

type SafetyReport = {
  id: string;
  category: string;
  description: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  user: { fullName: string; phone: string | null; user: { email: string } } | null;
  trip: { id: string; scheduledDate: string; pickupLocation: string; rider: { name: string } | null; driver: { profile: { fullName: string } | null } | null } | null;
  attachments: { id: string; filePath: string }[];
  reviewer: { fullName: string } | null;
};

type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_STATUS_VARIANT: Record<AppStatus, 'warning' | 'success' | 'danger' | 'orange'> = {
  PENDING:       'warning',
  APPROVED:      'success',
  REJECTED:      'danger',
  NEEDS_CHANGES: 'orange',
};

const APP_STATUS_LABEL: Record<AppStatus, string> = {
  PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', NEEDS_CHANGES: 'Needs Changes',
};

const TRIP_STATUS_VARIANT: Record<TripStatus, 'warning' | 'info' | 'purple' | 'orange' | 'success' | 'danger'> = {
  SCHEDULED:       'warning',
  DRIVER_ASSIGNED: 'info',
  ON_THE_WAY:      'purple',
  PICKED_UP:       'orange',
  COMPLETED:       'success',
  CANCELLED:       'danger',
};

const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  SCHEDULED: 'Scheduled', DRIVER_ASSIGNED: 'Driver Assigned', ON_THE_WAY: 'On the Way',
  PICKED_UP: 'Picked Up', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

const TRIP_STATUS_FILTERS = ['', 'SCHEDULED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED', 'CANCELLED'];

const SAFETY_STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'info'> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', RESOLVED: 'info',
};

const SAFETY_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', RESOLVED: 'Resolved',
};

const SAFETY_CAT_LABELS: Record<string, string> = {
  UNSAFE_DRIVING: 'Unsafe Driving', HARASSMENT: 'Harassment', VEHICLE_CONDITION: 'Vehicle Condition',
  ROUTE_DEVIATION: 'Route Deviation', LATE_PICKUP: 'Late Pickup', BEHAVIOUR: 'Behaviour Issue', OTHER: 'Other',
};

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Section rail ─────────────────────────────────────────────────────────────

type Section = AdminSection;

const ROLE_REFRESH_HINT =
  'If your role was recently changed to Admin, sign out and sign in again to refresh your session.';

function AdminForbidden() {
  return (
    <div className="min-h-screen bg-fizza-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center card-md p-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl mb-4">
          🚫
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Admin access required</h1>
        <p className="text-sm text-gray-500 mb-4">
          You do not have permission to view the admin dashboard.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-6">
          {ROLE_REFRESH_HINT}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/dashboard" className="btn-primary btn-md">Go to Dashboard</a>
          <button
            type="button"
            className="btn-secondary btn-md"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login?from=/admin';
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin content (uses useSearchParams — must be inside Suspense) ────────────

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

  const sectionTitle = ADMIN_SECTION_LABELS[activeSection];

  return (
    <AdminShell>
      <PageHeader
        title={sectionTitle}
        subtitle="Platform management and operations"
      />

      <p className="text-xs text-gray-400 -mt-4 mb-6 hidden md:block">
        Admin session active. {ROLE_REFRESH_HINT}
      </p>

      <div className="min-w-0">
        {activeSection === 'overview'      && <OverviewSection onNavigate={(s) => router.push(`/admin?section=${s}`, { scroll: false })} />}
        {activeSection === 'users'         && <UsersSection />}
        {activeSection === 'riders'        && <RidersSection />}
        {activeSection === 'drivers'       && <DriversSection />}
        {activeSection === 'applications'  && <ApplicationsSection />}
        {activeSection === 'subscriptions' && <SubscriptionsSection />}
        {activeSection === 'trips'         && <TripsSection />}
        {activeSection === 'financials'    && <FinancialsSection />}
        {activeSection === 'safety'        && <SafetySection />}
        {activeSection === 'packages'      && <PackagesSection />}
        {activeSection === 'sysconfig'     && <SystemConfigSection />}
        {activeSection === 'audit'         && <AuditLogsSection />}
      </div>
    </AdminShell>
  );
}

// ─── Page export (Suspense required for useSearchParams) ──────────────────────

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

// ─── Driver Applications section ──────────────────────────────────────────────

const APP_TABS = [
  { label: 'All',           value: ''             },
  { label: 'Pending',       value: 'PENDING'      },
  { label: 'Approved',      value: 'APPROVED'     },
  { label: 'Rejected',      value: 'REJECTED'     },
  { label: 'Needs Changes', value: 'NEEDS_CHANGES'},
];

function ApplicationsSection() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [meta, setMeta]                 = useState<PaginationMeta | null>(null);
  const [loading, setLoading]           = useState(true);
  const [pageError, setPageError]       = useState('');
  const [activeTab, setActiveTab]       = useState('');
  const [page, setPage]                 = useState(1);

  const [reviewingId, setReviewingId]   = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'NEEDS_CHANGES' | null>(null);
  const [reasonText, setReasonText]     = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg]       = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadApplications = useCallback((status: string, p: number) => {
    setLoading(true);
    setPageError('');
    driverApplicationService.adminList(status || undefined, p).then((res) => {
      if (res.data) {
        setApplications(res.data.applications ?? []);
        setMeta(res.data.meta ?? null);
      } else {
        setPageError(res.error?.message ?? 'Failed to load applications.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadApplications(activeTab, page); }, [activeTab, page, loadApplications]);

  const handleTabChange = (value: string) => {
    setActiveTab(value); setPage(1);
    setReviewingId(null); setReviewAction(null);
  };

  const startReview = (id: string, action: 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES') => {
    if (reviewingId === id && reviewAction === action) { setReviewingId(null); setReviewAction(null); return; }
    setReviewingId(id); setReviewAction(action);
    setReasonText(''); setReviewMsg(null);
  };

  const submitReview = async (appId: string) => {
    if (!reviewAction) return;
    if (reviewAction !== 'APPROVE' && !reasonText.trim()) {
      setReviewMsg({ text: 'A reason is required for this action.', type: 'error' }); return;
    }
    setReviewSubmitting(true); setReviewMsg(null);
    try {
      const res = await driverApplicationService.adminReview(
        appId, reviewAction,
        reviewAction !== 'APPROVE' ? reasonText.trim() : undefined,
      );
      if (res.data?.application) {
        setReviewMsg({ text: `Application ${reviewAction.toLowerCase().replace('_', ' ')} successfully.`, type: 'success' });
        setReviewingId(null); setReviewAction(null);
        loadApplications(activeTab, page);
      } else {
        setReviewMsg({ text: res.error?.message ?? 'Action failed. Please try again.', type: 'error' });
      }
    } catch {
      setReviewMsg({ text: 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Driver Applications</h2>

      <Tabs tabs={APP_TABS} activeTab={activeTab} onChange={handleTabChange} className="mb-5" />

      {reviewMsg && !reviewingId && (
        <Alert variant={reviewMsg.type} className="mb-4" onClose={() => setReviewMsg(null)}>{reviewMsg.text}</Alert>
      )}

      {loading ? (
        <LoadingState message="Loading applications…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => loadApplications(activeTab, page)} />
      ) : applications.length === 0 ? (
        <EmptyState icon="📝" title="No applications found" description="No driver applications match this filter." />
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const isReviewing = reviewingId === app.id;
            return (
              <Card key={app.id}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{app.applicant.fullName}</h3>
                    <p className="text-xs text-gray-500">{app.applicant.user.email}</p>
                    {app.applicant.phone && <p className="text-xs text-gray-500">{app.applicant.phone}</p>}
                  </div>
                  <StatusBadge variant={APP_STATUS_VARIANT[app.status]}>{APP_STATUS_LABEL[app.status]}</StatusBadge>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-700 mb-4">
                  <div className="flex gap-1.5"><span className="text-gray-400 shrink-0">Type</span><span>{app.vehicleCategory}</span></div>
                  <div className="flex gap-1.5"><span className="text-gray-400 shrink-0">Vehicle</span><span>{app.vehicleBrand} {app.vehicleModel} ({app.vehicleYear})</span></div>
                  <div className="flex gap-1.5"><span className="text-gray-400 shrink-0">Plate</span><span className="font-mono">{app.plateNumber}</span></div>
                  <div className="flex gap-1.5"><span className="text-gray-400 shrink-0">Color</span><span>{app.vehicleColor}</span></div>
                  <div className="flex gap-1.5"><span className="text-gray-400 shrink-0">Capacity</span><span>{app.vehicleCapacity} seats</span></div>
                  <div className="flex gap-1.5"><span className="text-gray-400 shrink-0">License</span><span>{app.licenseNumber}</span></div>
                  <div className="flex gap-1.5"><span className="text-gray-400 shrink-0">City</span><span>{app.city}</span></div>
                  <div className="flex gap-1.5"><span className="text-gray-400 shrink-0">Area</span><span>{app.serviceArea}</span></div>
                  {app.femaleDriver && <div className="flex gap-1.5 text-fizza-secondary"><span>✓</span><span className="font-medium">Female driver</span></div>}
                </div>

                {app.driverNotes && (
                  <div className="mb-3 px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-600 italic">{app.driverNotes}</div>
                )}
                {app.adminResponse && (
                  <div className="mb-3 px-3 py-2 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-800">
                    <span className="font-semibold">Previous note: </span>{app.adminResponse}
                  </div>
                )}

                <p className="text-xs text-gray-400 mb-4">
                  Submitted {new Date(app.submittedAt).toLocaleDateString()}
                  {app.resubmittedAt && ` · Resubmitted ${new Date(app.resubmittedAt).toLocaleDateString()}`}
                  {app.reviewer && ` · Reviewed by ${app.reviewer.fullName}`}
                </p>

                {(app.status === 'PENDING' || app.status === 'NEEDS_CHANGES') && (
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex gap-2 flex-wrap mb-3">
                      {(['APPROVE', 'NEEDS_CHANGES', 'REJECT'] as const).map((action) => {
                        const variants = {
                          APPROVE:       'primary',
                          NEEDS_CHANGES: 'outline',
                          REJECT:        'danger-outline',
                        } as const;
                        const labels = { APPROVE: 'Approve', NEEDS_CHANGES: 'Request Changes', REJECT: 'Reject' };
                        const isActive = isReviewing && reviewAction === action;
                        return (
                          <Button
                            key={action}
                            variant={isActive ? (action === 'APPROVE' ? 'primary' : action === 'REJECT' ? 'danger' : 'ghost') : variants[action]}
                            size="sm"
                            onClick={() => startReview(app.id, action)}
                          >
                            {labels[action]}
                          </Button>
                        );
                      })}
                    </div>

                    {isReviewing && (
                      <div className="space-y-3">
                        {reviewAction !== 'APPROVE' && (
                          <Textarea
                            rows={3}
                            placeholder={reviewAction === 'REJECT' ? 'Reason for rejection (required)…' : 'Describe the changes needed (required)…'}
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            error={reviewMsg?.type === 'error' ? reviewMsg.text : undefined}
                          />
                        )}
                        {reviewAction === 'APPROVE' && (
                          <Alert variant="info">
                            This will approve the application, create a Driver record, and upgrade the user role to Driver.
                          </Alert>
                        )}
                        {reviewMsg && <Alert variant={reviewMsg.type}>{reviewMsg.text}</Alert>}
                        <div className="flex gap-2">
                          <Button variant="primary" size="sm" loading={reviewSubmitting} onClick={() => submitReview(app.id)}>
                            Confirm
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setReviewingId(null); setReviewAction(null); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-5" />
      )}
    </>
  );
}

// ─── Trip Operations section ──────────────────────────────────────────────────

/** Group trips by date string (YYYY-MM-DD). Returns sorted array of [dateKey, trips[]]. */
function groupTripsByDate(trips: AdminTrip[]): [string, AdminTrip[]][] {
  const map = new Map<string, AdminTrip[]>();
  for (const trip of trips) {
    const key = trip.scheduledDate.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(trip);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/** Within a date group, further group by subscription ID (or 'none'). */
function groupBySubscription(trips: AdminTrip[]): [string, AdminTrip[]][] {
  const map = new Map<string, AdminTrip[]>();
  for (const trip of trips) {
    const key = trip.subscription?.id ?? 'none';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(trip);
  }
  return Array.from(map.entries());
}

function TripCard({
  trip, drivers, assigningTripId, selectedDriverId, assigning, assignMsg,
  onOpenAssign, onSelectDriver, onSubmitAssign, onCloseMsg,
}: {
  trip: AdminTrip;
  drivers: Driver[];
  assigningTripId: string | null;
  selectedDriverId: string;
  assigning: boolean;
  assignMsg: { text: string; type: 'success' | 'error' } | null;
  onOpenAssign: (id: string) => void;
  onSelectDriver: (v: string) => void;
  onSubmitAssign: (id: string) => void;
  onCloseMsg: () => void;
}) {
  const isAssigning = assigningTripId === trip.id;
  const mapsUrl = tripToGoogleMapsUrl(trip);
  const pickupMapsUrl = (trip.pickupLat != null && trip.pickupLng != null)
    ? buildGoogleMapsPlaceUrl(trip.pickupLat, trip.pickupLng, trip.pickupLocation)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.pickupLocation)}`;
  const dropoffMapsUrl = (trip.dropoffLat != null && trip.dropoffLng != null)
    ? buildGoogleMapsPlaceUrl(trip.dropoffLat, trip.dropoffLng, trip.dropoffLocation)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.dropoffLocation)}`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="font-semibold text-gray-900">
            {new Date(trip.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {trip.subscription && (
            <p className="text-xs text-gray-500 capitalize">{trip.subscription.subscriptionType}</p>
          )}
        </div>
        <StatusBadge variant={TRIP_STATUS_VARIANT[trip.status]}>{TRIP_STATUS_LABEL[trip.status]}</StatusBadge>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-700 mb-3">
        {trip.rider && (
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Rider</span>
            <span>{trip.rider.name} ({trip.rider.relationship})</span>
          </div>
        )}
        <div className="flex gap-1.5 items-start">
          <span className="text-gray-400 shrink-0">Pickup</span>
          <span>
            {fmtTime(trip.scheduledPickupTime)} ·{' '}
            <a href={pickupMapsUrl} target="_blank" rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-fizza-primary text-gray-700">
              {trip.pickupLocation}
            </a>
          </span>
        </div>
        <div className="flex gap-1.5 items-start">
          <span className="text-gray-400 shrink-0">Dropoff</span>
          <span>
            {fmtTime(trip.scheduledDropoffTime)} ·{' '}
            <a href={dropoffMapsUrl} target="_blank" rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-fizza-primary text-gray-700">
              {trip.dropoffLocation}
            </a>
          </span>
        </div>
        {trip.actualPickupTime && (
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Actual pickup</span>
            <span className="text-emerald-700 font-medium">{fmtTime(trip.actualPickupTime)}</span>
          </div>
        )}
      </div>

      {trip.driver ? (
        <div className="flex items-center gap-3 mb-3 p-2.5 bg-gray-50 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
            {trip.driver.profile?.fullName?.[0] ?? 'D'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{trip.driver.profile?.fullName ?? 'Driver'}</p>
            {trip.driver.rating && <p className="text-xs text-amber-600">★ {Number(trip.driver.rating).toFixed(1)}</p>}
          </div>
          {trip.vehicle && (
            <p className="text-xs text-gray-500 shrink-0 text-right">
              {trip.vehicle.model}<br /><span className="font-mono">{trip.vehicle.plateNumber}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-amber-600 mb-3 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">No driver assigned</p>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {(trip.status === 'SCHEDULED' || trip.status === 'DRIVER_ASSIGNED') && (
          <Button
            variant={isAssigning ? 'ghost' : 'outline'}
            size="sm"
            onClick={() => onOpenAssign(trip.id)}
          >
            {isAssigning ? 'Cancel' : trip.driver ? 'Reassign Driver' : 'Assign Driver'}
          </Button>
        )}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" title="Open full route in Google Maps">
          <Button variant="ghost" size="sm">🗺 Route</Button>
        </a>
        {trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED' && (
          <a href={`/tracking/${trip.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">View Tracking</Button>
          </a>
        )}
      </div>

      {isAssigning && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {assignMsg && (
            <Alert variant={assignMsg.type} className="mb-2" onClose={onCloseMsg}>{assignMsg.text}</Alert>
          )}
          <select
            className="input text-sm w-full"
            value={selectedDriverId}
            onChange={(e) => onSelectDriver(e.target.value)}
          >
            <option value="">Select a driver…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.profile?.fullName ?? 'Driver'}
                {d.vehicle ? ` — ${d.vehicle.model} (${d.vehicle.plateNumber})` : ''}
                {d.rating ? ` ★ ${Number(d.rating).toFixed(1)}` : ''}
              </option>
            ))}
          </select>
          <Button variant="primary" size="sm" loading={assigning} onClick={() => onSubmitAssign(trip.id)}>
            Confirm Assignment
          </Button>
        </div>
      )}
    </Card>
  );
}

type OpsOverview = {
  today: {
    total: number; active: number; unassigned: number; completed: number;
    cancelled: number; noShow: number; gpsStale: number; chatFlagged: number;
  };
  driverCount: number;
  driverWorkload: {
    driverId: string; fullName: string; tripsToday: number;
    activeTrip: { id: string; status: string } | null;
    completedToday: number;
  }[];
};

type FlaggedMessage = {
  id: string; tripId: string; body: string; moderationStatus: string;
  senderRole: string; createdAt: string;
  trip: { scheduledDate: string; rider: { name: string } | null } | null;
};

function TripOperationsOverview() {
  const [ops, setOps] = useState<OpsOverview | null>(null);
  const [opsError, setOpsError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    tripService.adminOperations().then((res) => {
      if (res.data) setOps(res.data as OpsOverview);
      else setOpsError(res.error?.message ?? 'Failed to load operations overview.');
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  if (loading) return <LoadingState message="Loading operations overview…" />;
  if (opsError) return <Alert variant="error">{opsError}</Alert>;
  if (!ops) return null;

  const cards = [
    { label: 'Trips Today', value: ops.today.total, variant: 'default' as const },
    { label: 'Active', value: ops.today.active, variant: 'purple' as const },
    { label: 'Unassigned', value: ops.today.unassigned, variant: 'warning' as const },
    { label: 'GPS Stale', value: ops.today.gpsStale, variant: 'danger' as const },
    { label: 'No Show', value: ops.today.noShow, variant: 'danger' as const },
    { label: 'Chat Flags', value: ops.today.chatFlagged, variant: 'orange' as const },
  ];

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label} padding="sm" className="text-center">
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </Card>
        ))}
      </div>
      {ops.driverWorkload.length > 0 && (
        <Card padding="sm">
          <p className="text-sm font-semibold text-gray-800 mb-2">Driver workload today</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {ops.driverWorkload.slice(0, 10).map((d) => (
              <div key={d.driverId} className="flex justify-between text-xs border-b border-gray-50 pb-1">
                <span className="font-medium text-gray-700">{d.fullName}</span>
                <span className="text-gray-500">
                  {d.tripsToday} trips · {d.completedToday} done
                  {d.activeTrip ? ` · active: ${d.activeTrip.status}` : ''}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ChatFlagsPanel() {
  const [messages, setMessages] = useState<FlaggedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    tripService.adminChatFlags(1).then((res) => {
      if (res.data?.messages) setMessages(res.data.messages);
      else setError(res.error?.message ?? 'Failed to load flagged messages.');
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function moderate(id: string, status: 'CLEAN' | 'BLOCKED') {
    const res = await tripService.adminModerateMessage(id, { moderationStatus: status });
    if (res.data) load();
  }

  if (loading) return null;
  if (error) return <Alert variant="error" className="mb-4">{error}</Alert>;
  if (messages.length === 0) return null;

  return (
    <Card className="mb-5 border-amber-200 bg-amber-50/30">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">Flagged chat ({messages.length})</h3>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className="text-xs border border-amber-100 rounded-lg p-2 bg-white">
            <p className="text-gray-700 line-clamp-2">{m.body}</p>
            <p className="text-gray-400 mt-1">
              Trip {m.tripId.slice(0, 8)}… · {m.moderationStatus} · {m.senderRole}
            </p>
            <div className="flex gap-2 mt-2">
              <Button variant="ghost" size="sm" onClick={() => moderate(m.id, 'CLEAN')}>Clear</Button>
              <Button variant="danger-outline" size="sm" onClick={() => moderate(m.id, 'BLOCKED')}>Block</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TripsSection() {
  const [trips, setTrips]           = useState<AdminTrip[]>([]);
  const [meta, setMeta]             = useState<PaginationMeta | null>(null);
  const [loading, setLoading]       = useState(true);
  const [pageError, setPageError]   = useState('');
  const [statusFilter, setStatusFilter] = useState('SCHEDULED');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode]     = useState<'grouped' | 'flat'>('grouped');

  const [drivers, setDrivers]           = useState<Driver[]>([]);
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assigning, setAssigning]       = useState(false);
  const [assignMsg, setAssignMsg]       = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [generating, setGenerating]     = useState(false);
  const [genStartDate, setGenStartDate] = useState('');
  const [genEndDate, setGenEndDate]     = useState('');
  const [genMsg, setGenMsg]             = useState<{ text: string; type: 'success' | 'error'; result?: { generated: number; skipped: number } } | null>(null);

  const loadTrips = useCallback((status: string, date: string, p: number, silent = false) => {
    if (!silent) setLoading(true);
    setPageError('');
    tripService.adminList({ status: status || undefined, date: date || undefined, page: p }).then((res) => {
      if (res.data) {
        setTrips(res.data.trips ?? []);
        setMeta(res.data.meta ?? null);
        setLastUpdated(new Date());
      } else {
        setPageError(res.error?.message ?? 'Failed to load trips.');
      }
      setLoading(false);
    });
  }, []);

  const loadDrivers = useCallback(() => {
    tripService.adminListDrivers().then((res) => {
      if (res.data) setDrivers(res.data.drivers ?? []);
    });
  }, []);

  useEffect(() => { loadTrips(statusFilter, dateFilter, page); }, [statusFilter, dateFilter, page, loadTrips]);
  useEffect(() => { loadDrivers(); }, [loadDrivers]);
  useEffect(() => {
    const id = setInterval(() => loadTrips(statusFilter, dateFilter, page, true), 25_000);
    return () => clearInterval(id);
  }, [statusFilter, dateFilter, page, loadTrips]);

  const openAssign = (tripId: string) => {
    if (assigningTripId === tripId) { setAssigningTripId(null); return; }
    setAssigningTripId(tripId); setSelectedDriverId(''); setAssignMsg(null);
  };

  const submitAssign = async (tripId: string) => {
    if (!selectedDriverId) { setAssignMsg({ text: 'Please select a driver.', type: 'error' }); return; }
    setAssigning(true); setAssignMsg(null);
    const res = await tripService.adminAssignDriver(tripId, selectedDriverId);
    setAssigning(false);
    if (res.data) {
      setAssignMsg({ text: 'Driver assigned successfully.', type: 'success' });
      setAssigningTripId(null);
      loadTrips(statusFilter, dateFilter, page);
    } else {
      setAssignMsg({ text: res.error?.message ?? 'Assignment failed.', type: 'error' });
    }
  };

  const handleGenerate = async () => {
    setGenerating(true); setGenMsg(null);
    const res = await tripService.adminGenerateTrips(genStartDate || undefined, genEndDate || undefined);
    setGenerating(false);
    if (res.data) {
      setGenMsg({ text: 'Trip generation complete.', type: 'success', result: { generated: res.data.generated ?? 0, skipped: res.data.skipped ?? 0 } });
      loadTrips(statusFilter, dateFilter, page);
    } else {
      setGenMsg({ text: res.error?.message ?? 'Generation failed.', type: 'error' });
    }
  };

  const tripCardProps = {
    drivers, assigningTripId, selectedDriverId, assigning, assignMsg,
    onOpenAssign: openAssign,
    onSelectDriver: setSelectedDriverId,
    onSubmitAssign: submitAssign,
    onCloseMsg: () => setAssignMsg(null),
  };

  return (
    <>
      <TripOperationsOverview />
      <ChatFlagsPanel />
      <TripOperationsBoard />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Trip Board</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              className={`px-3 py-1.5 ${viewMode === 'grouped' ? 'bg-fizza-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setViewMode('grouped')}
            >
              Grouped
            </button>
            <button
              className={`px-3 py-1.5 ${viewMode === 'flat' ? 'bg-fizza-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              onClick={() => setViewMode('flat')}
            >
              Flat
            </button>
          </div>
        </div>
      </div>

      {/* Generate trips */}
      <Card className="mb-5 border-fizza-secondary/30 bg-emerald-50/20">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Generate Trips</h3>
        <p className="text-xs text-gray-500 mb-3">
          Creates trips from active subscriptions for the date range (defaults to today + 7 days). Idempotent — safe to run multiple times.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start date</label>
            <input type="date" className="input text-sm h-9" value={genStartDate} onChange={(e) => setGenStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End date</label>
            <input type="date" className="input text-sm h-9" value={genEndDate} onChange={(e) => setGenEndDate(e.target.value)} />
          </div>
          <Button variant="primary" size="sm" loading={generating} onClick={handleGenerate}>
            ⚡ Generate Trips
          </Button>
        </div>
        {genMsg && (
          <Alert variant={genMsg.type} className="mt-3" onClose={() => setGenMsg(null)}>
            {genMsg.text}
            {genMsg.result && (
              <span className="ml-2 font-semibold">{genMsg.result.generated} created · {genMsg.result.skipped} skipped</span>
            )}
          </Alert>
        )}
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select className="input text-sm h-10" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            {TRIP_STATUS_FILTERS.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" className="input text-sm h-10" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} />
        </div>
        {dateFilter && (
          <button onClick={() => { setDateFilter(''); setPage(1); }} className="text-xs text-gray-500 hover:text-gray-700 underline pb-1">
            Clear date
          </button>
        )}
      </div>

      {assignMsg && !assigningTripId && (
        <Alert variant={assignMsg.type} className="mb-4" onClose={() => setAssignMsg(null)}>{assignMsg.text}</Alert>
      )}

      {loading ? (
        <LoadingState message="Loading trips…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => loadTrips(statusFilter, dateFilter, page)} />
      ) : trips.length === 0 ? (
        <EmptyState icon="🗓️" title="No trips found" description="No trips match the selected filters." />
      ) : viewMode === 'flat' ? (
        <div className="space-y-4">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} {...tripCardProps} />
          ))}
        </div>
      ) : (
        /* ── Grouped view: date → subscription ── */
        <div className="space-y-6">
          {groupTripsByDate(trips).map(([dateKey, dateTrips]) => {
            const assigned   = dateTrips.filter((t) => t.driver != null).length;
            const unassigned = dateTrips.length - assigned;
            const label = new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            });
            return (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
                  <div className="flex gap-1.5 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{dateTrips.length} trip{dateTrips.length !== 1 ? 's' : ''}</span>
                    {assigned > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{assigned} assigned</span>}
                    {unassigned > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{unassigned} unassigned</span>}
                  </div>
                </div>

                {/* Group by subscription within this date */}
                <div className="space-y-5 pl-3 border-l-2 border-gray-100">
                  {groupBySubscription(dateTrips).map(([subId, subTrips]) => {
                    const sub = subTrips[0]?.subscription;
                    return (
                      <div key={subId}>
                        {sub && (
                          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                            {sub.subscriptionType.replace('_', ' ')} · sub {subId.slice(-6)}
                          </p>
                        )}
                        <div className="space-y-3">
                          {subTrips.map((trip) => (
                            <TripCard key={trip.id} trip={trip} {...tripCardProps} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} className="mt-5" />
      )}
    </>
  );
}

// ─── Safety Reports section ───────────────────────────────────────────────────

function SafetySection() {
  const [reports, setReports]           = useState<SafetyReport[]>([]);
  const [safetyMeta, setSafetyMeta]     = useState<PaginationMeta | null>(null);
  const [loading, setLoading]           = useState(true);
  const [pageError, setPageError]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [safetyPage, setSafetyPage]     = useState(1);

  const [reviewingId, setReviewingId]   = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'RESOLVE' | null>(null);
  const [reviewResponse, setReviewResponse] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg]       = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadReports = useCallback((status: string, category: string, from: string, to: string, p: number) => {
    setLoading(true); setPageError('');
    safetyService.adminListReports({
      status: status || undefined, category: category || undefined,
      dateFrom: from || undefined, dateTo: to || undefined, page: p,
    }).then((res: { data?: { reports: SafetyReport[]; meta: PaginationMeta }; error?: { message: string } }) => {
      if (res.data) { setReports(res.data.reports ?? []); setSafetyMeta(res.data.meta ?? null); }
      else setPageError(res.error?.message ?? 'Failed to load safety reports.');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadReports(statusFilter, categoryFilter, dateFrom, dateTo, safetyPage);
  }, [statusFilter, categoryFilter, dateFrom, dateTo, safetyPage, loadReports]);

  const openReview = (reportId: string) => {
    if (reviewingId === reportId) { setReviewingId(null); return; }
    setReviewingId(reportId); setReviewAction(null);
    setReviewResponse(''); setReviewMsg(null);
  };

  const submitReview = async (reportId: string) => {
    if (!reviewAction) { setReviewMsg({ text: 'Select an action.', type: 'error' }); return; }
    if ((reviewAction === 'REJECT' || reviewAction === 'RESOLVE') && !reviewResponse.trim()) {
      setReviewMsg({ text: 'Response required for Reject/Resolve.', type: 'error' }); return;
    }
    setReviewSubmitting(true); setReviewMsg(null);
    const res = await safetyService.adminReviewReport(reportId, {
      action: reviewAction,
      adminResponse: reviewResponse.trim() || undefined,
    });
    setReviewSubmitting(false);
    if (res.data) {
      setReviewMsg({ text: 'Review submitted.', type: 'success' });
      setReviewingId(null);
      loadReports(statusFilter, categoryFilter, dateFrom, dateTo, safetyPage);
    } else {
      setReviewMsg({ text: res.error?.message ?? 'Review failed.', type: 'error' });
    }
  };

  return (
    <>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Safety Reports</h2>

      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select className="input text-sm h-10" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setSafetyPage(1); }}>
            <option value="">All Statuses</option>
            {['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select className="input text-sm h-10" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setSafetyPage(1); }}>
            <option value="">All Categories</option>
            {Object.entries(SAFETY_CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" className="input text-sm h-10" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSafetyPage(1); }} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" className="input text-sm h-10" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSafetyPage(1); }} />
        </div>
      </div>

      {reviewMsg && !reviewingId && (
        <Alert variant={reviewMsg.type} className="mb-4" onClose={() => setReviewMsg(null)}>{reviewMsg.text}</Alert>
      )}

      {loading ? (
        <LoadingState message="Loading safety reports…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => loadReports(statusFilter, categoryFilter, dateFrom, dateTo, safetyPage)} />
      ) : reports.length === 0 ? (
        <EmptyState icon="🛡️" title="No safety reports found" description="No reports match the selected filters." />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isReviewing = reviewingId === report.id;
            return (
              <Card key={report.id}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{SAFETY_CAT_LABELS[report.category] ?? report.category}</p>
                    {report.user && (
                      <p className="text-xs text-gray-500">{report.user.fullName} · {report.user.user.email}</p>
                    )}
                    <p className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge variant={SAFETY_STATUS_VARIANT[report.status] ?? 'warning'}>
                    {SAFETY_STATUS_LABEL[report.status] ?? report.status}
                  </StatusBadge>
                </div>

                <p className="text-sm text-gray-700 mb-3 leading-relaxed">{report.description}</p>

                {report.trip && (
                  <div className="bg-gray-50 rounded-xl p-3 text-sm mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">Linked Trip</p>
                    <p className="text-gray-700">{new Date(report.trip.scheduledDate).toLocaleDateString()} · {report.trip.pickupLocation}</p>
                    {report.trip.rider && <p className="text-gray-500 text-xs">Rider: {report.trip.rider.name}</p>}
                    {report.trip.driver?.profile && <p className="text-gray-500 text-xs">Driver: {report.trip.driver.profile.fullName}</p>}
                  </div>
                )}

                {report.attachments.length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {report.attachments.map((a, i) => (
                      <a key={a.id} href={a.filePath} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline hover:text-blue-800">
                        📎 Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                )}

                {report.adminResponse && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-3">
                    <p className="text-xs font-semibold text-blue-600 mb-0.5">Admin Response</p>
                    <p className="text-sm text-blue-800">{report.adminResponse}</p>
                  </div>
                )}

                {report.status !== 'RESOLVED' && (
                  <div>
                    <Button variant={isReviewing ? 'ghost' : 'outline'} size="sm" onClick={() => openReview(report.id)}>
                      {isReviewing ? 'Cancel' : 'Review Report'}
                    </Button>

                    {isReviewing && (
                      <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                        <div className="flex flex-wrap gap-2">
                          {(['APPROVE', 'REJECT', 'RESOLVE'] as const).map((a) => (
                            <Button
                              key={a}
                              size="sm"
                              variant={reviewAction === a ? (a === 'APPROVE' ? 'primary' : a === 'REJECT' ? 'danger' : 'outline') : 'ghost'}
                              onClick={() => setReviewAction(a)}
                            >
                              {a}
                            </Button>
                          ))}
                        </div>
                        <Textarea
                          rows={2}
                          placeholder={reviewAction === 'APPROVE' ? 'Optional response…' : 'Response required for Reject/Resolve…'}
                          value={reviewResponse}
                          onChange={(e) => setReviewResponse(e.target.value)}
                        />
                        {reviewMsg && <Alert variant={reviewMsg.type}>{reviewMsg.text}</Alert>}
                        <div className="flex gap-2">
                          <Button variant="primary" size="sm" loading={reviewSubmitting} disabled={!reviewAction} onClick={() => submitReview(report.id)}>
                            Submit Review
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setReviewingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {safetyMeta && safetyMeta.totalPages > 1 && (
        <Pagination page={safetyMeta.page} totalPages={safetyMeta.totalPages} onPageChange={setSafetyPage} className="mt-5" />
      )}
    </>
  );
}
