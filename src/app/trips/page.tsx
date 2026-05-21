'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { tripService } from '@/services/tripService';

type TripStatus = 'SCHEDULED' | 'DRIVER_ASSIGNED' | 'ON_THE_WAY' | 'PICKED_UP' | 'COMPLETED' | 'CANCELLED';

type Trip = {
  id: string;
  status: TripStatus;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  actualPickupTime: string | null;
  actualDropoffTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  rider: { id: string; name: string; relationship: string; school: string | null } | null;
  driver: {
    id: string;
    rating: string | null;
    profile: { fullName: string; phone: string | null; avatarUrl: string | null } | null;
  } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
  subscription: { id: string; subscriptionType: string; package: { name: string } | null } | null;
};

const TABS = [
  { label: 'Upcoming', filter: 'upcoming' },
  { label: 'Active',   filter: 'active' },
  { label: 'Completed', filter: 'completed' },
  { label: 'Cancelled', filter: 'cancelled' },
];

const STATUS_CFG: Record<TripStatus, { label: string; color: string; bg: string; border: string }> = {
  SCHEDULED:       { label: 'Scheduled',       color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  DRIVER_ASSIGNED: { label: 'Driver Assigned', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  ON_THE_WAY:      { label: 'On the Way',      color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  PICKED_UP:       { label: 'Picked Up',       color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  COMPLETED:       { label: 'Completed',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  CANCELLED:       { label: 'Cancelled',       color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

const CANCELLABLE: TripStatus[] = ['SCHEDULED', 'DRIVER_ASSIGNED'];
const TRACKABLE: TripStatus[] = ['DRIVER_ASSIGNED', 'ON_THE_WAY', 'PICKED_UP'];

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TripsPage() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const loadTrips = (filter: string) => {
    setLoading(true);
    setPageError('');
    tripService.list(filter).then((res) => {
      if (res.data) setTrips(res.data);
      else setPageError(res.error?.message ?? 'Failed to load trips.');
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTrips(activeTab); }, [activeTab]);

  const handleCancel = async (trip: Trip) => {
    if (!confirm(`Cancel trip on ${new Date(trip.scheduledDate).toLocaleDateString()}?`)) return;
    setCancelling(trip.id);
    setActionMsg('');
    const res = await tripService.cancel(trip.id);
    setCancelling(null);
    if (res.data) {
      setActionMsg('Trip cancelled.');
      loadTrips(activeTab);
    } else {
      setActionMsg(res.error?.message ?? 'Cancel failed.');
    }
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">My Trips</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.filter}
            onClick={() => { setActiveTab(tab.filter); setActionMsg(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.filter ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionMsg && (
        <p className={`rounded-xl px-4 py-3 text-sm mb-4 ${
          actionMsg.toLowerCase().includes('fail') || actionMsg.toLowerCase().includes('error')
            ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'
        }`}>
          {actionMsg}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading trips…</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : trips.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-1">No {activeTab} trips</p>
          <p className="text-gray-400 text-sm">
            {activeTab === 'upcoming'
              ? 'Trips are generated from your active subscriptions by the admin team.'
              : `No ${activeTab} trips found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const cfg = STATUS_CFG[trip.status];
            return (
              <div key={trip.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-semibold text-base">
                      {new Date(trip.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                    {trip.subscription && (
                      <p className="text-sm text-gray-500 capitalize">
                        {trip.subscription.subscriptionType}
                        {trip.subscription.package ? ` · ${trip.subscription.package.name}` : ''}
                      </p>
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
                  {trip.actualPickupTime && (
                    <p><span className="text-gray-400">Actual pickup:</span> {fmtTime(trip.actualPickupTime)}</p>
                  )}
                  {trip.actualDropoffTime && (
                    <p><span className="text-gray-400">Actual dropoff:</span> {fmtTime(trip.actualDropoffTime)}</p>
                  )}
                </div>

                {trip.driver && (
                  <div className="flex items-center gap-3 mb-3 p-2.5 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                      {trip.driver.profile?.fullName?.[0] ?? 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{trip.driver.profile?.fullName ?? 'Driver'}</p>
                      {trip.driver.rating && (
                        <p className="text-xs text-amber-600">★ {Number(trip.driver.rating).toFixed(1)}</p>
                      )}
                    </div>
                    {trip.vehicle && (
                      <p className="text-xs text-gray-500 shrink-0 text-right">
                        {trip.vehicle.model}<br />
                        <span className="font-mono">{trip.vehicle.plateNumber}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {TRACKABLE.includes(trip.status) && (
                    <Link
                      href={`/tracking/${trip.id}`}
                      className="text-sm px-4 py-2 rounded-xl font-semibold border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      View Tracking →
                    </Link>
                  )}
                  {CANCELLABLE.includes(trip.status) && (
                    <button
                      onClick={() => handleCancel(trip)}
                      disabled={cancelling === trip.id}
                      className="text-sm px-4 py-2 rounded-xl font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancelling === trip.id ? 'Cancelling…' : 'Cancel Trip'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
