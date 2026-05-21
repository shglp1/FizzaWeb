'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { driverApplicationService } from '@/services/driverApplicationService';
import { tripService } from '@/services/tripService';
import { safetyService } from '@/services/safetyService';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  pickupLocation: string;
  dropoffLocation: string;
  rider: { id: string; name: string; relationship: string } | null;
  driver: {
    id: string;
    rating: string | null;
    profile: { fullName: string; phone: string | null } | null;
  } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
  subscription: { id: string; subscriptionType: string } | null;
};

type Driver = {
  id: string;
  rating: string | null;
  profile: { fullName: string; phone: string | null } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
};

type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Needs Changes', value: 'NEEDS_CHANGES' },
];

const APP_STATUS_CFG: Record<AppStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING:       { label: 'Pending',        color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  APPROVED:      { label: 'Approved',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  REJECTED:      { label: 'Rejected',       color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  NEEDS_CHANGES: { label: 'Needs Changes',  color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
};

const TRIP_STATUS_CFG: Record<TripStatus, { label: string; color: string; bg: string; border: string }> = {
  SCHEDULED:       { label: 'Scheduled',      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  DRIVER_ASSIGNED: { label: 'Driver Assigned', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  ON_THE_WAY:      { label: 'On the Way',      color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  PICKED_UP:       { label: 'Picked Up',       color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  COMPLETED:       { label: 'Completed',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  CANCELLED:       { label: 'Cancelled',       color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

const TRIP_STATUS_FILTERS = ['', 'SCHEDULED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP', 'COMPLETED', 'CANCELLED'];

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Section = 'applications' | 'trips' | 'safety';

export default function AdminPage() {
  const [section, setSection] = useState<Section>('applications');

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Admin Dashboard</h1>

      {/* Section switcher */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
        <button
          onClick={() => setSection('applications')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            section === 'applications' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Driver Applications
        </button>
        <button
          onClick={() => setSection('trips')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            section === 'trips' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Trip Operations
        </button>
        <button
          onClick={() => setSection('safety')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            section === 'safety' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Safety Reports
        </button>
      </div>

      {section === 'applications' ? (
        <ApplicationsSection />
      ) : section === 'trips' ? (
        <TripsSection />
      ) : (
        <SafetySection />
      )}
    </AppShell>
  );
}

// ─── Driver Applications section ──────────────────────────────────────────────

function ApplicationsSection() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'NEEDS_CHANGES' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

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

  useEffect(() => {
    loadApplications(activeTab, page);
  }, [activeTab, page, loadApplications]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPage(1);
    setReviewingId(null);
    setReviewAction(null);
  };

  const startReview = (id: string, action: 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES') => {
    if (reviewingId === id && reviewAction === action) {
      setReviewingId(null);
      setReviewAction(null);
      return;
    }
    setReviewingId(id);
    setReviewAction(action);
    setReasonText('');
    setReviewError('');
    setReviewSuccess('');
  };

  const submitReview = async (appId: string) => {
    if (!reviewAction) return;
    if (reviewAction !== 'APPROVE' && !reasonText.trim()) {
      setReviewError('A reason is required for this action.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    setReviewSuccess('');
    try {
      const res = await driverApplicationService.adminReview(
        appId,
        reviewAction,
        reviewAction !== 'APPROVE' ? reasonText.trim() : undefined,
      );
      if (res.data?.application) {
        setReviewSuccess(`Application ${reviewAction.toLowerCase().replace('_', ' ')} successfully.`);
        setReviewingId(null);
        setReviewAction(null);
        loadApplications(activeTab, page);
      } else {
        setReviewError(res.error?.message ?? 'Action failed. Please try again.');
      }
    } catch {
      setReviewError('Something went wrong. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Driver Applications</h2>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {APP_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.value
                ? 'bg-white shadow text-emerald-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {reviewSuccess && (
        <p className="text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 text-sm mb-4">{reviewSuccess}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading…</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : applications.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No applications found.</div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const cfg = APP_STATUS_CFG[app.status];
            const isReviewing = reviewingId === app.id;

            return (
              <div key={app.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-semibold text-base">{app.applicant.fullName}</h2>
                    <p className="text-sm text-gray-500">{app.applicant.user.email}</p>
                    {app.applicant.phone && <p className="text-sm text-gray-500">{app.applicant.phone}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-700 mb-4">
                  <p><span className="text-gray-400">Type:</span> {app.vehicleCategory}</p>
                  <p><span className="text-gray-400">Vehicle:</span> {app.vehicleBrand} {app.vehicleModel} ({app.vehicleYear})</p>
                  <p><span className="text-gray-400">Plate:</span> {app.plateNumber}</p>
                  <p><span className="text-gray-400">Color:</span> {app.vehicleColor}</p>
                  <p><span className="text-gray-400">Capacity:</span> {app.vehicleCapacity} seats</p>
                  <p><span className="text-gray-400">License:</span> {app.licenseNumber}</p>
                  <p><span className="text-gray-400">City:</span> {app.city}</p>
                  <p><span className="text-gray-400">Area:</span> {app.serviceArea}</p>
                  {app.femaleDriver && <p className="text-emerald-600 font-medium">Female driver ✓</p>}
                </div>

                {app.driverNotes && (
                  <div className="mb-3 p-2 bg-gray-50 rounded-lg text-sm text-gray-600 italic">{app.driverNotes}</div>
                )}
                {app.adminResponse && (
                  <div className="mb-3 p-2 bg-orange-50 border border-orange-100 rounded-lg text-sm text-orange-800">
                    <span className="font-medium">Previous note: </span>{app.adminResponse}
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
                        const colors = {
                          APPROVE: { active: 'bg-emerald-600 text-white border-emerald-600', idle: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' },
                          NEEDS_CHANGES: { active: 'bg-orange-500 text-white border-orange-500', idle: 'border-orange-300 text-orange-600 hover:bg-orange-50' },
                          REJECT: { active: 'bg-red-600 text-white border-red-600', idle: 'border-red-300 text-red-600 hover:bg-red-50' },
                        };
                        const labels = { APPROVE: 'Approve', NEEDS_CHANGES: 'Request Changes', REJECT: 'Reject' };
                        const active = isReviewing && reviewAction === action;
                        return (
                          <button
                            key={action}
                            onClick={() => startReview(app.id, action)}
                            className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-all ${active ? colors[action].active : colors[action].idle}`}
                          >
                            {labels[action]}
                          </button>
                        );
                      })}
                    </div>

                    {isReviewing && (
                      <div className="space-y-2">
                        {reviewAction !== 'APPROVE' && (
                          <textarea
                            className="input h-20 resize-none w-full"
                            placeholder={reviewAction === 'REJECT' ? 'Reason for rejection (required)…' : 'Describe the changes needed (required)…'}
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                          />
                        )}
                        {reviewAction === 'APPROVE' && (
                          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                            This will approve the application, create a Driver record, and upgrade the user role to Driver.
                          </p>
                        )}
                        {reviewError && <p className="text-red-600 text-sm">{reviewError}</p>}
                        <div className="flex gap-2">
                          <button onClick={() => submitReview(app.id)} disabled={reviewSubmitting} className="btn-primary text-sm px-4 py-2">
                            {reviewSubmitting ? 'Submitting…' : 'Confirm'}
                          </button>
                          <button onClick={() => { setReviewingId(null); setReviewAction(null); }} className="btn-outline text-sm px-4 py-2">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Next →</button>
        </div>
      )}
    </>
  );
}

// ─── Trip Operations section ──────────────────────────────────────────────────

function TripsSection() {
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [statusFilter, setStatusFilter] = useState('SCHEDULED');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState('');

  const [generating, setGenerating] = useState(false);
  const [genStartDate, setGenStartDate] = useState('');
  const [genEndDate, setGenEndDate] = useState('');
  const [genMsg, setGenMsg] = useState('');
  const [genResult, setGenResult] = useState<{ generated: number; skipped: number } | null>(null);

  const loadTrips = useCallback((status: string, date: string, p: number) => {
    setLoading(true);
    setPageError('');
    tripService.adminList({
      status: status || undefined,
      date: date || undefined,
      page: p,
    }).then((res) => {
      if (res.data) {
        setTrips(res.data.trips ?? []);
        setMeta(res.data.meta ?? null);
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

  useEffect(() => {
    loadTrips(statusFilter, dateFilter, page);
  }, [statusFilter, dateFilter, page, loadTrips]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const openAssign = (tripId: string) => {
    if (assigningTripId === tripId) {
      setAssigningTripId(null);
      return;
    }
    setAssigningTripId(tripId);
    setSelectedDriverId('');
    setAssignMsg('');
  };

  const submitAssign = async (tripId: string) => {
    if (!selectedDriverId) { setAssignMsg('Select a driver.'); return; }
    setAssigning(true);
    setAssignMsg('');
    const res = await tripService.adminAssignDriver(tripId, selectedDriverId);
    setAssigning(false);
    if (res.data) {
      setAssignMsg('Driver assigned successfully.');
      setAssigningTripId(null);
      loadTrips(statusFilter, dateFilter, page);
    } else {
      setAssignMsg(res.error?.message ?? 'Assignment failed.');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMsg('');
    setGenResult(null);
    const res = await tripService.adminGenerateTrips(genStartDate || undefined, genEndDate || undefined);
    setGenerating(false);
    if (res.data) {
      setGenResult({ generated: res.data.generated ?? 0, skipped: res.data.skipped ?? 0 });
      setGenMsg('Trip generation complete.');
      loadTrips(statusFilter, dateFilter, page);
    } else {
      setGenMsg(res.error?.message ?? 'Generation failed.');
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Trip Operations</h2>

      {/* Generate trips panel */}
      <div className="card mb-6 border border-emerald-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Generate Trips</h3>
        <p className="text-xs text-gray-500 mb-3">
          Creates trips from all active subscriptions for the specified date range (defaults to today + 7 days). Idempotent — safe to run multiple times.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start date</label>
            <input
              type="date"
              className="input text-sm"
              value={genStartDate}
              onChange={(e) => setGenStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End date</label>
            <input
              type="date"
              className="input text-sm"
              value={genEndDate}
              onChange={(e) => setGenEndDate(e.target.value)}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary text-sm px-5 py-2.5"
          >
            {generating ? 'Generating…' : '⚡ Generate Trips'}
          </button>
        </div>
        {genMsg && (
          <div className={`mt-3 text-sm px-4 py-2.5 rounded-xl ${
            genMsg.includes('fail') || genMsg.includes('Fail')
              ? 'text-red-700 bg-red-50'
              : 'text-emerald-700 bg-emerald-50'
          }`}>
            {genMsg}
            {genResult && (
              <span className="ml-2 font-semibold">
                {genResult.generated} created · {genResult.skipped} skipped
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            className="input text-sm"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            {TRIP_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s || 'All Statuses'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            className="input text-sm"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
          />
        </div>
        {dateFilter && (
          <button onClick={() => { setDateFilter(''); setPage(1); }} className="text-xs text-gray-500 hover:text-gray-700 underline self-end pb-2">
            Clear date
          </button>
        )}
      </div>

      {assignMsg && (
        <p className={`rounded-xl px-4 py-3 text-sm mb-4 ${
          assignMsg.includes('fail') || assignMsg.includes('Select')
            ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'
        }`}>
          {assignMsg}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading trips…</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : trips.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No trips found for the selected filters.</div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const cfg = TRIP_STATUS_CFG[trip.status];
            const isAssigning = assigningTripId === trip.id;

            return (
              <div key={trip.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-semibold text-base">
                      {new Date(trip.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                    {trip.subscription && (
                      <p className="text-xs text-gray-500 capitalize">{trip.subscription.subscriptionType}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-700 mb-3">
                  {trip.rider && (
                    <p><span className="text-gray-400">Rider:</span> {trip.rider.name} ({trip.rider.relationship})</p>
                  )}
                  <p><span className="text-gray-400">Pickup:</span> {fmtTime(trip.scheduledPickupTime)} — {trip.pickupLocation}</p>
                  <p><span className="text-gray-400">Dropoff:</span> {fmtTime(trip.scheduledDropoffTime)} — {trip.dropoffLocation}</p>
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
                        {trip.vehicle.model}<br />
                        <span className="font-mono">{trip.vehicle.plateNumber}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 mb-3 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                    No driver assigned
                  </p>
                )}

                {trip.status === 'SCHEDULED' && (
                  <div>
                    <button
                      onClick={() => openAssign(trip.id)}
                      className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-all ${
                        isAssigning
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      {isAssigning ? 'Cancel' : 'Assign Driver'}
                    </button>

                    {isAssigning && (
                      <div className="mt-3 space-y-2">
                        <select
                          className="input text-sm w-full"
                          value={selectedDriverId}
                          onChange={(e) => setSelectedDriverId(e.target.value)}
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
                        <button
                          onClick={() => submitAssign(trip.id)}
                          disabled={assigning}
                          className="btn-primary text-sm px-4 py-2"
                        >
                          {assigning ? 'Assigning…' : 'Confirm Assignment'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Next →</button>
        </div>
      )}
    </>
  );
}

// ─── Safety Reports section ───────────────────────────────────────────────────

const SAFETY_STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:  { label: 'Pending',  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  REJECTED: { label: 'Rejected', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  RESOLVED: { label: 'Resolved', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
};

const SAFETY_CAT_LABELS: Record<string, string> = {
  UNSAFE_DRIVING:    'Unsafe Driving',
  HARASSMENT:        'Harassment',
  VEHICLE_CONDITION: 'Vehicle Condition',
  ROUTE_DEVIATION:   'Route Deviation',
  LATE_PICKUP:       'Late Pickup',
  BEHAVIOUR:         'Behaviour Issue',
  OTHER:             'Other',
};

type SafetyReport = {
  id: string;
  category: string;
  description: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  user: { fullName: string; phone: string | null; user: { email: string } } | null;
  trip: {
    id: string;
    scheduledDate: string;
    pickupLocation: string;
    rider: { name: string } | null;
    driver: { profile: { fullName: string } | null } | null;
  } | null;
  attachments: { id: string; filePath: string }[];
  reviewer: { fullName: string } | null;
};

function SafetySection() {
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [safetyMeta, setSafetyMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [safetyPage, setSafetyPage] = useState(1);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'RESOLVE' | null>(null);
  const [reviewResponse, setReviewResponse] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');

  const loadReports = useCallback(
    (status: string, category: string, from: string, to: string, p: number) => {
      setLoading(true);
      setPageError('');
      safetyService
        .adminListReports({
          status: status || undefined,
          category: category || undefined,
          dateFrom: from || undefined,
          dateTo: to || undefined,
          page: p,
        })
        .then((res: { data?: { reports: SafetyReport[]; meta: PaginationMeta }; error?: { message: string } }) => {
          if (res.data) {
            setReports(res.data.reports ?? []);
            setSafetyMeta(res.data.meta ?? null);
          } else {
            setPageError(res.error?.message ?? 'Failed to load safety reports.');
          }
          setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    loadReports(statusFilter, categoryFilter, dateFrom, dateTo, safetyPage);
  }, [statusFilter, categoryFilter, dateFrom, dateTo, safetyPage, loadReports]);

  const openReview = (reportId: string) => {
    if (reviewingId === reportId) { setReviewingId(null); return; }
    setReviewingId(reportId);
    setReviewAction(null);
    setReviewResponse('');
    setReviewMsg('');
  };

  const submitReview = async (reportId: string) => {
    if (!reviewAction) { setReviewMsg('Select an action.'); return; }
    if ((reviewAction === 'REJECT' || reviewAction === 'RESOLVE') && !reviewResponse.trim()) {
      setReviewMsg('Response required for Reject/Resolve.'); return;
    }
    setReviewSubmitting(true);
    setReviewMsg('');
    const res = await safetyService.adminReviewReport(reportId, {
      action: reviewAction,
      adminResponse: reviewResponse.trim() || undefined,
    });
    setReviewSubmitting(false);
    if (res.data) {
      setReviewMsg('Review submitted.');
      setReviewingId(null);
      loadReports(statusFilter, categoryFilter, dateFrom, dateTo, safetyPage);
    } else {
      setReviewMsg(res.error?.message ?? 'Review failed.');
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Safety Reports</h2>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select className="input text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setSafetyPage(1); }}>
            <option value="">All Statuses</option>
            {['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <select className="input text-sm" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setSafetyPage(1); }}>
            <option value="">All Categories</option>
            {Object.entries(SAFETY_CAT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" className="input text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSafetyPage(1); }} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" className="input text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSafetyPage(1); }} />
        </div>
      </div>

      {reviewMsg && !reviewingId && (
        <p className={`rounded-xl px-4 py-3 text-sm mb-4 ${
          reviewMsg.includes('fail') || reviewMsg.includes('Select') || reviewMsg.includes('required')
            ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'
        }`}>
          {reviewMsg}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading safety reports...</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No safety reports found.</div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const cfg = SAFETY_STATUS_CFG[report.status] ?? SAFETY_STATUS_CFG.PENDING;
            const isReviewing = reviewingId === report.id;
            return (
              <div key={report.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-base">{SAFETY_CAT_LABELS[report.category] ?? report.category}</p>
                    {report.user && (
                      <p className="text-xs text-gray-500">{report.user.fullName} · {report.user.user.email}</p>
                    )}
                    <p className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-3">{report.description}</p>

                {report.trip && (
                  <div className="bg-gray-50 rounded-xl p-3 text-sm mb-3 space-y-1">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Linked Trip</p>
                    <p>{new Date(report.trip.scheduledDate).toLocaleDateString()} · {report.trip.pickupLocation}</p>
                    {report.trip.rider && <p>Rider: {report.trip.rider.name}</p>}
                    {report.trip.driver?.profile && <p>Driver: {report.trip.driver.profile.fullName}</p>}
                  </div>
                )}

                {report.attachments.length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {report.attachments.map((a) => (
                      <a key={a.id} href={a.filePath} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline">Attachment</a>
                    ))}
                  </div>
                )}

                {report.adminResponse && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm text-blue-800 mb-3">
                    <span className="text-xs font-semibold text-blue-600 block mb-0.5">Admin Response:</span>
                    {report.adminResponse}
                  </div>
                )}

                {report.status !== 'RESOLVED' && (
                  <div>
                    <button
                      onClick={() => openReview(report.id)}
                      className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-all ${
                        isReviewing ? 'bg-gray-600 text-white border-gray-600' : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                      }`}
                    >
                      {isReviewing ? 'Cancel' : 'Review Report'}
                    </button>
                    {isReviewing && (
                      <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                        <div className="flex flex-wrap gap-2">
                          {(['APPROVE', 'REJECT', 'RESOLVE'] as const).map((a) => (
                            <button
                              key={a}
                              onClick={() => setReviewAction(a)}
                              className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                                reviewAction === a
                                  ? a === 'APPROVE' ? 'bg-emerald-600 text-white border-emerald-600'
                                  : a === 'REJECT'  ? 'bg-red-600 text-white border-red-600'
                                  : 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                        <textarea
                          rows={2}
                          placeholder={reviewAction === 'APPROVE' ? 'Optional response...' : 'Response required for Reject/Resolve...'}
                          value={reviewResponse}
                          onChange={(e) => setReviewResponse(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {reviewMsg && <p className="text-xs text-red-600">{reviewMsg}</p>}
                        <button
                          onClick={() => submitReview(report.id)}
                          disabled={reviewSubmitting || !reviewAction}
                          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                        >
                          {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {safetyMeta && safetyMeta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setSafetyPage((p) => Math.max(1, p - 1))} disabled={safetyPage === 1} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {safetyMeta.page} of {safetyMeta.totalPages}</span>
          <button onClick={() => setSafetyPage((p) => Math.min(safetyMeta.totalPages, p + 1))} disabled={safetyPage === safetyMeta.totalPages} className="btn-outline text-sm px-4 py-2 disabled:opacity-40">Next</button>
        </div>
      )}
    </>
  );
}
