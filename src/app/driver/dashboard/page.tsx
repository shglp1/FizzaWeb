'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader, StatCard, Card, Alert, Badge, StatusBadge, Button, LoadingState, ErrorState,
} from '@/components/ui';
import { driverApplicationService } from '@/services/driverApplicationService';
import { tripService } from '@/services/tripService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';

type Application = {
  id: string;
  status: AppStatus;
  vehicleType: string;
  vehicleBrand: string;
  vehicleModel: string;
  plateNumber: string;
  city: string;
  adminResponse: string | null;
  submittedAt: string;
};

type TripStatus = 'SCHEDULED' | 'DRIVER_ASSIGNED' | 'ON_THE_WAY' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED';

type Trip = {
  id: string;
  status: TripStatus;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  rider: { name: string; school: string | null } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<AppStatus, 'warning' | 'success' | 'danger' | 'orange'> = {
  PENDING:       'warning',
  APPROVED:      'success',
  REJECTED:      'danger',
  NEEDS_CHANGES: 'orange',
};

const STATUS_LABEL: Record<AppStatus, string> = {
  PENDING:       'Under Review',
  APPROVED:      'Approved Driver',
  REJECTED:      'Rejected',
  NEEDS_CHANGES: 'Changes Needed',
};

const TRIP_VARIANT: Record<TripStatus, 'warning' | 'info' | 'purple' | 'success' | 'danger' | 'orange'> = {
  SCHEDULED:       'warning',
  DRIVER_ASSIGNED: 'info',
  ON_THE_WAY:      'purple',
  PICKED_UP:       'orange',
  COMPLETED:       'success',
  CANCELLED:       'danger',
};

function fmtTime(t: string | null) {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-SA', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Status tracker ───────────────────────────────────────────────────────────

const STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'review',    label: 'Under Review' },
  { key: 'decision',  label: 'Decision' },
];

function StatusTracker({ status }: { status: AppStatus }) {
  const stepIndex = status === 'PENDING' ? 1 : 2;
  return (
    <div className="flex items-center mt-4">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
              i <= stepIndex
                ? 'border-fizza-secondary bg-fizza-secondary/10 text-fizza-secondary'
                : 'border-gray-200 bg-white text-gray-300'
            }`}>
              {i + 1}
            </div>
            <p className={`text-[10px] mt-1 font-medium ${i <= stepIndex ? 'text-fizza-secondary' : 'text-gray-300'}`}>
              {s.label}
            </p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mb-4 mx-1 ${i < stepIndex ? 'bg-fizza-secondary' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriverDashboardPage() {
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Client-side role guard
    fetch('/api/me')
      .then((r) => r.json())
      .then(({ data }) => {
        if (data?.role === 'ADMIN')  { router.replace('/admin'); return; }
        if (data?.role === 'PARENT') { router.replace('/dashboard'); return; }
      })
      .catch(() => {});

    Promise.all([
      driverApplicationService.get(),
      tripService.list('upcoming'),
    ])
      .then(([appRes, tripsRes]) => {
        setApplication(appRes.data?.application ?? null);
        setTrips(Array.isArray(tripsRes.data) ? tripsRes.data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Unable to load driver dashboard.');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toDateString();
  const todayTrips  = trips.filter((t) => new Date(t.scheduledDate).toDateString() === today);
  const activeTrips = trips.filter((t) => t.status === 'ON_THE_WAY' || t.status === 'PICKED_UP').length;
  const completedTrips = trips.filter((t) => t.status === 'COMPLETED').length;
  const nextTrip    = trips.find((t) => t.status === 'SCHEDULED' || t.status === 'DRIVER_ASSIGNED');
  const isApproved  = application?.status === 'APPROVED';

  return (
    <AppShell>
      <PageHeader title="Driver Dashboard" subtitle="Today's schedule and performance" />

      {loading ? (
        <LoadingState message="Loading driver dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-6">

          {/* ── Application status banner (not yet approved) ── */}
          {!isApproved && (
            <Card className="border-fizza-secondary/20 bg-emerald-50/30">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h2 className="text-base font-semibold text-gray-900">Driver Application Status</h2>
                    {application && (
                      <StatusBadge variant={STATUS_BADGE[application.status]}>
                        {STATUS_LABEL[application.status]}
                      </StatusBadge>
                    )}
                  </div>

                  {!application ? (
                    <>
                      <p className="text-sm text-gray-600 mb-3">
                        You haven&apos;t submitted a driver application yet. Apply to start accepting trips on the Fizza platform.
                      </p>
                      <Button variant="primary" size="sm" onClick={() => router.push('/driver-application')}>
                        Apply to Become a Driver
                      </Button>
                    </>
                  ) : application.status === 'PENDING' ? (
                    <>
                      <p className="text-sm text-gray-600">
                        Your application is under review. We&apos;ll notify you once a decision has been made (usually 1–3 business days).
                      </p>
                      <StatusTracker status={application.status} />
                    </>
                  ) : application.status === 'NEEDS_CHANGES' ? (
                    <>
                      {application.adminResponse && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 mb-3">
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Admin Feedback</p>
                          <p className="text-sm text-amber-900">{application.adminResponse}</p>
                        </div>
                      )}
                      <p className="text-sm text-gray-600 mb-3">Please update your application based on the feedback above.</p>
                      <Button variant="primary" size="sm" onClick={() => router.push('/driver-application')}>
                        Update Application
                      </Button>
                    </>
                  ) : application.status === 'REJECTED' ? (
                    <>
                      {application.adminResponse && (
                        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 mb-3">
                          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Rejection Reason</p>
                          <p className="text-sm text-red-900">{application.adminResponse}</p>
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => router.push('/driver-application')}>
                        Resubmit Application
                      </Button>
                    </>
                  ) : null}
                </div>
                {application && (
                  <p className="text-xs text-gray-400 shrink-0">
                    Submitted {new Date(application.submittedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* ── Approved driver stats ── */}
          {isApproved && (
            <>
              <Alert variant="success">
                🎉 You are an approved Fizza driver. Your dashboard shows your assigned trips and schedule.
              </Alert>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Today's Trips"
                  value={todayTrips.length}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
                  color="#1D4ED8"
                />
                <StatCard
                  label="Active Now"
                  value={activeTrips}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                  color="#14A34A"
                />
                <StatCard
                  label="Completed"
                  value={completedTrips}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>}
                  color="#0B683A"
                />
                <StatCard
                  label="Upcoming"
                  value={trips.filter((t) => t.status === 'SCHEDULED' || t.status === 'DRIVER_ASSIGNED').length}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><circle cx="12" cy="10" r="2" /></svg>}
                  color="#7C3AED"
                />
              </div>
            </>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              {/* ── Next pickup ── */}
              {nextTrip ? (
                <Card>
                  <div className="section-header">
                    <h2 className="text-base font-semibold text-gray-900">Next Pickup</h2>
                    <StatusBadge variant={TRIP_VARIANT[nextTrip.status]}>
                      {nextTrip.status.replace(/_/g, ' ')}
                    </StatusBadge>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Rider</p>
                      <p className="font-semibold text-gray-900">{nextTrip.rider?.name ?? 'Unknown'}</p>
                      {nextTrip.rider?.school && (
                        <p className="text-xs text-gray-500 mt-0.5">🏫 {nextTrip.rider.school}</p>
                      )}
                    </div>
                    <div className="rounded-xl bg-gray-50 px-4 py-3">
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Scheduled</p>
                      <p className="font-semibold text-gray-900">{fmtDate(nextTrip.scheduledDate)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Pickup {fmtTime(nextTrip.scheduledPickupTime)}
                        {nextTrip.scheduledDropoffTime && <> → Drop-off {fmtTime(nextTrip.scheduledDropoffTime)}</>}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-4 py-3">
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium mb-1">Pickup Location</p>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{nextTrip.pickupLocation}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-4 py-3">
                      <p className="text-xs text-blue-600 uppercase tracking-wide font-medium mb-1">Drop-off Location</p>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{nextTrip.dropoffLocation}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => router.push('/trips')}>
                      Open Trip Details
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/tracking/${nextTrip.id}`)}>
                      GPS Tracking
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="flex flex-col items-center py-8 gap-3 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-2xl">✅</div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">No upcoming trips</p>
                      <p className="text-xs text-gray-400 mt-0.5">You&apos;re all caught up</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* ── Today's schedule ── */}
              {todayTrips.length > 0 && (
                <Card>
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Today&apos;s Schedule</h2>
                  <div className="divide-y divide-gray-50">
                    {todayTrips.map((trip) => (
                      <div key={trip.id} className="flex items-center gap-3 py-3">
                        <div className="flex flex-col items-center text-center min-w-[48px]">
                          <p className="text-xs font-bold text-gray-900">{fmtTime(trip.scheduledPickupTime)}</p>
                          <p className="text-[10px] text-gray-400">pickup</p>
                        </div>
                        <div className="w-px h-8 bg-gray-200 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{trip.rider?.name ?? 'Unknown rider'}</p>
                          <p className="text-xs text-gray-400 truncate">{trip.pickupLocation}</p>
                        </div>
                        <StatusBadge variant={TRIP_VARIANT[trip.status]}>
                          {trip.status.replace(/_/g, ' ')}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* ── Quick actions + GPS + vehicle ── */}
            <div className="flex flex-col gap-4">
              <Card>
                <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  {[
                    { href: '/trips',              emoji: '🗓️', title: 'Assigned Trips',      sub: `${trips.length} total`,                          bg: 'bg-blue-50 text-blue-600' },
                    { href: '/notifications',      emoji: '🔔', title: 'Notifications',        sub: 'Check your alerts',                              bg: 'bg-amber-50 text-amber-600' },
                    { href: '/safety',             emoji: '🛡️', title: 'Submit Safety Report', sub: 'Report an incident',                             bg: 'bg-red-50 text-red-500' },
                    { href: '/profile',            emoji: '👤', title: 'Update Profile',       sub: 'Edit your information',                          bg: 'bg-emerald-50 text-fizza-secondary' },
                    { href: '/driver-application', emoji: '📋', title: 'Application Status',   sub: application ? STATUS_LABEL[application.status] : 'No application', bg: 'bg-purple-50 text-purple-600' },
                  ].map((item) => (
                    <a key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-base shrink-0 ${item.bg}`}>
                        {item.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                        <p className="text-xs text-gray-400 truncate">{item.sub}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </Card>

              <Card className="bg-emerald-50/50 border-fizza-secondary/20">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">📍 GPS Sharing</h2>
                <p className="text-xs text-gray-600 mb-3">
                  GPS sharing activates automatically when you start a trip. Open trip details to begin tracking.
                </p>
                <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/trips')}>
                  Open Trips →
                </Button>
              </Card>

              {application && (
                <Card padding="sm">
                  <div className="px-1 py-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vehicle</p>
                    <p className="text-sm font-medium text-gray-900">{application.vehicleBrand} {application.vehicleModel}</p>
                    <p className="text-xs text-gray-500">{application.plateNumber} · {application.city}</p>
                    <div className="mt-2">
                      <Badge variant={STATUS_BADGE[application.status]}>
                        {STATUS_LABEL[application.status]}
                      </Badge>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
