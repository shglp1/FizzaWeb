'use client';

import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, CreditCard, UserX, Clock, MapPin, ExternalLink } from 'lucide-react';
import { adminSubscriptionService } from '@/services/adminService';
import { Button, Alert, Textarea, ErrorState } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';
import {
  formatRouteSummary,
  formatScheduleSummary,
  formatServiceDaysSummary,
  formatServicePeriod,
  formatDaysLeft,
  formatDateLabel,
  formatEffectiveDateLabel,
  pickupLabel,
  dropoffLabel,
} from '@/lib/ui/subscriptionSummary';
import { buildGoogleMapsPlaceUrl, tripToGoogleMapsUrl } from '@/lib/maps/googleMapsLink';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminDataCard,
  AdminMetaItem,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
  AdminFilterSelect,
  AdminSectionLoading,
  AdminAvatar,
  useDebouncedValue,
} from '@/components/admin/AdminUI';
import { formatSar } from '@/lib/ui/adminCurrency';
import { mapDistanceProviderLabel } from '@/lib/ui/mapLocation';

type AssignedDriver = {
  id: string;
  profile: { fullName: string; phone: string | null } | null;
  vehicle: { model: string; plateNumber: string } | null;
};

type AvailableDriver = {
  id: string;
  fullName: string;
  phone: string | null;
  availability: boolean;
  rating: number | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
  isCurrentlyAssigned: boolean;
  hasScheduleConflict: boolean;
  activeSubscriptionCount: number;
};

type SubRow = {
  id: string;
  subscriptionType: string;
  status: string;
  paymentStatus: string;
  autoRenewal: boolean;
  startsOn: string | null;
  endsOn: string | null;
  finalPriceSar: string;
  cancellationReason: string | null;
  createdAt: string;
  user: { id: string; fullName: string; phone?: string | null; user: { email: string } };
  rider: { id: string; name: string; school: string | null } | null;
  package: { id: string; name: string; billingCycle: string } | null;
  subscriptionRiders: { rider: { id: string; name: string; school?: string | null }; isPrimary: boolean }[];
  assignedDriverId: string | null;
  assignedDriver: AssignedDriver | null;
  packagePriceSar?: string;
  addOnsPriceSar?: string;
  distancePriceSar?: string;
  extraRidersPriceSar?: string;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  normalizedPickupLabel?: string | null;
  normalizedDropoffLabel?: string | null;
  tripDirection?: string | null;
  pickupTime?: string | null;
  returnTime?: string | null;
  actualServiceDays?: number | null;
  schedules?: { weekday: number; isOffDay: boolean }[];
  ridesUsed: number;
  daysLeft: number | null;
  _count: { trips: number };
};

type SubDetail = SubRow & {
  femaleDriverPreference?: boolean;
  oneWayDistanceKm?: string | number | null;
  chargeableDistanceKm?: string | number | null;
  distanceProvider?: string | null;
  distanceApproximate?: boolean | null;
  dailyChargeableDistanceKm?: string | number | null;
  totalChargeableDistanceKm?: string | number | null;
  pricePerKmSarSnapshot?: string | number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  addOns?: { addOn: { id: string; name: string; priceSar: string | number } }[];
  payments?: { id: string; amountSar: string; status: string; purpose: string; createdAt: string }[];
  trips?: { id: string; status: string; scheduledDate: string; scheduledPickupTime: string | null }[];
  ridesUsed?: number;
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

function MapLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline min-h-[44px]"
    >
      <MapPin className="h-3.5 w-3.5" aria-hidden />
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

const SUB_LABELS: Record<string, string> = {
  PENDING: 'Pending', ACTIVE: 'Active', PAUSED: 'Paused', EXPIRED: 'Expired', CANCELLED: 'Cancelled',
};
const PAY_LABELS: Record<string, string> = {
  PENDING: 'Pending', PAID: 'Paid', FAILED: 'Failed', REFUNDED: 'Refunded',
};

function AssignDriverPanel({ subscriptionId, onSuccess, onClose }: { subscriptionId: string; onSuccess: () => void; onClose: () => void }) {
  const [drivers, setDrivers] = useState<AvailableDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    adminSubscriptionService.listAvailableDrivers(subscriptionId).then((res) => {
      if (res.data) setDrivers(res.data as AvailableDriver[]);
      setLoading(false);
    });
  }, [subscriptionId]);

  const handleSubmit = async () => {
    if (!selectedDriverId) { setMsg({ text: 'Select a driver.', type: 'error' }); return; }
    setSubmitting(true);
    const res = await adminSubscriptionService.assignDriver(subscriptionId, { driverId: selectedDriverId });
    setSubmitting(false);
    if (res.data) { onSuccess(); } else { setMsg({ text: res.error?.message ?? 'Failed.', type: 'error' }); }
  };

  if (loading) return <p className="text-sm text-gray-500 animate-pulse py-4">Loading drivers…</p>;

  return (
    <div className="space-y-3">
      {msg && <Alert variant={msg.type}>{msg.text}</Alert>}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {drivers.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelectedDriverId(d.id)}
            disabled={!d.availability}
            className={`w-full text-left rounded-xl border-2 p-3 min-h-[44px] ${selectedDriverId === d.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100'}`}
          >
            <p className="font-medium text-sm">{d.fullName}</p>
            <p className="text-xs text-gray-500">{d.vehicle?.model} · {d.vehicle?.plateNumber}</p>
            {d.hasScheduleConflict && <p className="text-xs text-amber-700 mt-1">Schedule conflict possible</p>}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" loading={submitting} onClick={handleSubmit} className="min-h-[44px]">Confirm assignment</Button>
        <Button variant="ghost" size="sm" onClick={onClose} className="min-h-[44px]">Cancel</Button>
      </div>
    </div>
  );
}

export function SubscriptionsSection() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [selected, setSelected] = useState<SubRow | null>(null);
  const [detail, setDetail] = useState<SubDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback((s: string, ps: string, df: string, search: string, p: number, l: number) => {
    setLoading(true);
    setError('');
    adminSubscriptionService.list({
      status: s || undefined,
      paymentStatus: ps || undefined,
      search: search || undefined,
      unassigned: df === 'unassigned' ? true : undefined,
      assigned: df === 'assigned' ? true : undefined,
      page: p,
      limit: l,
    }).then((res) => {
      if (res.data) {
        setSubs((res.data as { subscriptions: SubRow[]; meta: Meta }).subscriptions ?? []);
        setMeta((res.data as { subscriptions: SubRow[]; meta: Meta }).meta ?? null);
      } else {
        setError(res.error?.message ?? 'Failed to load subscriptions.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(statusFilter, payStatusFilter, driverFilter, debouncedSearch, page, limit); }, [statusFilter, payStatusFilter, driverFilter, debouncedSearch, page, limit, load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailError('');
      return;
    }
    setDetailLoading(true);
    setDetailError('');
    adminSubscriptionService.get(selected.id).then((res) => {
      if (res.data) {
        setDetail(res.data as SubDetail);
      } else {
        setDetail(selected as SubDetail);
        setDetailError(res.error?.message ?? 'Could not load full subscription details.');
      }
      setDetailLoading(false);
    }).catch(() => {
      setDetail(selected as SubDetail);
      setDetailError('Could not load full subscription details.');
      setDetailLoading(false);
    });
  }, [selected]);

  const kpis = {
    active: subs.filter((s) => s.status === 'ACTIVE').length,
    pendingPay: subs.filter((s) => s.paymentStatus === 'PENDING').length,
    cancelled: subs.filter((s) => s.status === 'CANCELLED').length,
    unassigned: subs.filter((s) => !s.assignedDriverId && s.status === 'ACTIVE').length,
    expiring: subs.filter((s) => s.daysLeft != null && s.daysLeft <= 7 && s.status === 'ACTIVE').length,
  };

  const submitCancel = async (id: string) => {
    if (!cancelReason.trim()) { setActionMsg({ text: 'Reason required.', type: 'error' }); return; }
    setCancelling(true);
    const res = await adminSubscriptionService.cancel(id, cancelReason.trim());
    setCancelling(false);
    if (res.data) {
      setActionMsg({ text: 'Subscription cancelled.', type: 'success' });
      setSelected(null);
      load(statusFilter, payStatusFilter, driverFilter, debouncedSearch, page, limit);
    } else {
      setActionMsg({ text: res.error?.message ?? 'Failed.', type: 'error' });
    }
  };

  return (
    <div>
      <AdminSectionHeader title="Subscriptions" subtitle="Active plans, payments, and driver assignments" count={meta?.total} countLabel="subscriptions" />

      <AdminMetricGrid
        columns={5}
        items={[
          { label: 'Active', value: kpis.active, color: '#059669' },
          { label: 'Pending Payment', value: kpis.pendingPay, color: '#D97706', icon: CreditCard },
          { label: 'Cancelled', value: kpis.cancelled, color: '#6B7280' },
          { label: 'Unassigned Driver', value: kpis.unassigned, color: '#DC2626', icon: UserX },
          { label: 'Expiring Soon', value: kpis.expiring, color: '#EA580C', icon: Clock },
        ]}
      />

      <AdminToolbar
        search={searchInput}
        onSearchChange={(v) => { setSearchInput(v); setPage(1); }}
        searchPlaceholder="Search parent, rider, or route…"
        filters={[
          { id: 'sub-status', label: 'Status', element: <AdminFilterSelect id="sub-status" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={[{ value: '', label: 'All' }, ...Object.entries(SUB_LABELS).map(([v, l]) => ({ value: v, label: l }))]} /> },
          { id: 'sub-pay', label: 'Payment', element: <AdminFilterSelect id="sub-pay" value={payStatusFilter} onChange={(v) => { setPayStatusFilter(v); setPage(1); }} options={[{ value: '', label: 'All' }, ...Object.entries(PAY_LABELS).map(([v, l]) => ({ value: v, label: l }))]} /> },
          { id: 'sub-driver', label: 'Driver', element: <AdminFilterSelect id="sub-driver" value={driverFilter} onChange={(v) => { setDriverFilter(v); setPage(1); }} options={[{ value: '', label: 'All' }, { value: 'assigned', label: 'Assigned' }, { value: 'unassigned', label: 'Unassigned' }]} /> },
        ]}
      />

      {actionMsg && !selected && <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>{actionMsg.text}</Alert>}

      {loading ? (
        <AdminSectionLoading message="Loading subscriptions…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(statusFilter, payStatusFilter, driverFilter, debouncedSearch, page, limit)} />
      ) : subs.length === 0 ? (
        <AdminEmptyState icon={ClipboardList} title="No subscriptions" description="No subscriptions match your filters." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {subs.map((sub) => {
            const riders = sub.subscriptionRiders.length > 0
              ? sub.subscriptionRiders.map((sr) => sr.rider.name).join(', ')
              : sub.rider?.name ?? '—';
            return (
              <AdminDataCard
                key={sub.id}
                title={sub.user.fullName}
                subtitle={`${sub.package?.name ?? 'No package'} · ${riders}`}
                badges={<><AdminStatusBadge status={sub.status} label={SUB_LABELS[sub.status]} /><AdminStatusBadge status={sub.paymentStatus} label={PAY_LABELS[sub.paymentStatus]} /></>}
                onClick={() => { setSelected(sub); setAssigning(false); setCancelReason(''); }}
                metadata={
                  <>
                    <AdminMetaItem label="Route" value={formatRouteSummary(sub)} />
                    <AdminMetaItem label="Schedule" value={formatScheduleSummary(sub)} />
                    <AdminMetaItem label="Service days" value={formatServiceDaysSummary(sub)} />
                    <AdminMetaItem label="Price" value={formatSar(sub.finalPriceSar)} />
                    <AdminMetaItem label="Driver" value={sub.assignedDriver?.profile?.fullName ?? 'Unassigned'} />
                    <AdminMetaItem label="Payment" value={PAY_LABELS[sub.paymentStatus] ?? sub.paymentStatus} />
                  </>
                }
                compact
              />
            );
          })}
        </div>
      )}

      <AdminPagination
        meta={meta}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        className="mt-5"
      />

      <AdminDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.user.fullName ?? ''}
        subtitle={selected?.package?.name}
        width="lg"
      >
        {selected && (
          <>
            {detailLoading && (
              <p className="text-sm text-gray-500 animate-pulse mb-4">Loading full subscription details…</p>
            )}
            {detailError && (
              <Alert variant="warning" className="mb-4">{detailError}</Alert>
            )}

            {(detail ?? selected) && (() => {
              const d = (detail ?? selected) as SubDetail;
              const routeMapsUrl = tripToGoogleMapsUrl({
                pickupLocation: d.pickupLocation ?? pickupLabel(d),
                dropoffLocation: d.dropoffLocation ?? dropoffLabel(d),
                pickupLat: d.pickupLat,
                pickupLng: d.pickupLng,
                dropoffLat: d.dropoffLat,
                dropoffLng: d.dropoffLng,
              });
              const riders = d.subscriptionRiders?.length
                ? d.subscriptionRiders.map((sr) => `${sr.rider.name}${sr.isPrimary ? ' (primary)' : ''}`).join(', ')
                : d.rider?.name ?? '—';
              const completedTrips = d.ridesUsed ?? selected?.ridesUsed ?? 0;
              const totalTrips = d._count?.trips ?? selected?._count?.trips ?? 0;
              const remainingTrips = Math.max(0, totalTrips - completedTrips);

              return (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <AdminStatusBadge status={d.status} label={SUB_LABELS[d.status]} />
                    <AdminStatusBadge status={d.paymentStatus} label={PAY_LABELS[d.paymentStatus]} />
                    {d.daysLeft != null && d.status === 'ACTIVE' && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        {formatDaysLeft(d.daysLeft, d.endsOn, d)}
                      </span>
                    )}
                  </div>

                  <AdminDrawerSection title="Parent & contact">
                    <AdminDrawerRow label="Name" value={d.user.fullName} />
                    <AdminDrawerRow label="Email" value={d.user.user.email} />
                    <AdminDrawerRow label="Phone" value={d.user.phone ?? '—'} />
                    <AdminDrawerRow label="Subscribed on" value={formatDateLabel(d.createdAt)} />
                  </AdminDrawerSection>

                  <AdminDrawerSection title="Service timeline">
                    <AdminDrawerRow label="Service start" value={formatEffectiveDateLabel(d, 'startsOn')} />
                    <AdminDrawerRow label="Service end" value={formatEffectiveDateLabel(d, 'endsOn')} />
                    <AdminDrawerRow label="Days remaining" value={formatDaysLeft(d.daysLeft, d.endsOn, d)} />
                    <AdminDrawerRow label="Service period" value={formatServicePeriod(d)} />
                    <AdminDrawerRow label="Auto renewal" value={d.autoRenewal ? 'Yes' : 'No'} />
                    {d.cancellationReason && (
                      <AdminDrawerRow label="Cancellation reason" value={d.cancellationReason} />
                    )}
                  </AdminDrawerSection>

                  <AdminDrawerSection title="Route & schedule">
                    <AdminDrawerRow label="Pickup" value={pickupLabel(d)} />
                    <AdminDrawerRow label="Drop-off" value={dropoffLabel(d)} />
                    <AdminDrawerRow label="Route" value={formatRouteSummary(d)} />
                    <AdminDrawerRow label="Schedule" value={formatScheduleSummary(d)} />
                    <AdminDrawerRow label="Service days" value={formatServiceDaysSummary(d)} />
                    {d.oneWayDistanceKm != null && (
                      <AdminDrawerRow label="Distance (one-way)" value={`${Number(d.oneWayDistanceKm).toFixed(1)} km`} />
                    )}
                    {d.chargeableDistanceKm != null && (
                      <AdminDrawerRow label="Chargeable distance" value={`${Number(d.chargeableDistanceKm).toFixed(1)} km`} />
                    )}
                    {d.distanceProvider && (
                      <AdminDrawerRow
                        label="Distance source"
                        value={mapDistanceProviderLabel(d.distanceProvider, d.distanceApproximate ?? false)}
                      />
                    )}
                    {d.distanceApproximate && (
                      <p className="text-xs text-amber-700">Approximate distance was used — final price may need admin review.</p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <MapLink href={routeMapsUrl} label="Open route in Google Maps" />
                      {d.pickupLat != null && d.pickupLng != null && (
                        <MapLink href={buildGoogleMapsPlaceUrl(d.pickupLat, d.pickupLng, pickupLabel(d))} label="Pickup on map" />
                      )}
                      {d.dropoffLat != null && d.dropoffLng != null && (
                        <MapLink href={buildGoogleMapsPlaceUrl(d.dropoffLat, d.dropoffLng, dropoffLabel(d))} label="Drop-off on map" />
                      )}
                    </div>
                  </AdminDrawerSection>

                  <AdminDrawerSection title="Subscription & pricing">
                    <AdminDrawerRow label="Type" value={d.subscriptionType.replace(/_/g, ' ')} />
                    <AdminDrawerRow label="Package" value={d.package?.name ?? '—'} />
                    <AdminDrawerRow label="Billing cycle" value={d.package?.billingCycle ?? '—'} />
                    <AdminDrawerRow label="Final price" value={formatSar(d.finalPriceSar)} />
                    <AdminDrawerRow label="Package price" value={formatSar(d.packagePriceSar ?? 0)} />
                    <AdminDrawerRow label="Distance price" value={formatSar(d.distancePriceSar ?? 0)} />
                    <AdminDrawerRow label="Add-ons price" value={formatSar(d.addOnsPriceSar ?? 0)} />
                    {d.extraRidersPriceSar != null && Number(d.extraRidersPriceSar) > 0 && (
                      <AdminDrawerRow label="Extra riders" value={formatSar(d.extraRidersPriceSar)} />
                    )}
                    <AdminDrawerRow label="Female driver preference" value={d.femaleDriverPreference ? 'Yes' : 'No'} />
                  </AdminDrawerSection>

                  <AdminDrawerSection title="Riders">
                    <AdminDrawerRow label="Riders" value={riders} />
                    {d.subscriptionRiders?.map((sr) => (
                      <AdminDrawerRow
                        key={sr.rider.id}
                        label={sr.isPrimary ? 'Primary rider' : 'Additional rider'}
                        value={`${sr.rider.name}${sr.rider.school ? ` · ${sr.rider.school}` : ''}`}
                      />
                    ))}
                  </AdminDrawerSection>

                  {d.addOns && d.addOns.length > 0 && (
                    <AdminDrawerSection title="Add-ons">
                      {d.addOns.map((a) => (
                        <AdminDrawerRow key={a.addOn.id} label={a.addOn.name} value={formatSar(a.addOn.priceSar)} />
                      ))}
                    </AdminDrawerSection>
                  )}

                  <AdminDrawerSection title="Trip usage">
                    <AdminDrawerRow label="Trips generated" value={totalTrips} />
                    <AdminDrawerRow label="Trips completed" value={completedTrips} />
                    <AdminDrawerRow label="Remaining (est.)" value={remainingTrips} />
                  </AdminDrawerSection>

                  <AdminDrawerSection title="Assigned driver">
                    {d.assignedDriver ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <AdminAvatar name={d.assignedDriver.profile?.fullName ?? 'D'} />
                          <div>
                            <p className="font-medium text-sm">{d.assignedDriver.profile?.fullName}</p>
                            {d.assignedDriver.profile?.phone && (
                              <p className="text-xs text-gray-500">{d.assignedDriver.profile.phone}</p>
                            )}
                          </div>
                        </div>
                        {d.assignedDriver.vehicle && (
                          <AdminDrawerRow label="Vehicle" value={`${d.assignedDriver.vehicle.model} · ${d.assignedDriver.vehicle.plateNumber}`} />
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-amber-700">No driver assigned — future trips will be unassigned.</p>
                    )}
                    {d.status !== 'CANCELLED' && (
                      <Button variant="outline" size="sm" onClick={() => setAssigning(!assigning)} className="mt-2 min-h-[44px]">
                        {assigning ? 'Close assignment' : d.assignedDriver ? 'Reassign driver' : 'Assign driver'}
                      </Button>
                    )}
                    {assigning && (
                      <AssignDriverPanel
                        subscriptionId={d.id}
                        onSuccess={() => {
                          setAssigning(false);
                          setSelected(null);
                          load(statusFilter, payStatusFilter, driverFilter, debouncedSearch, page, limit);
                        }}
                        onClose={() => setAssigning(false)}
                      />
                    )}
                  </AdminDrawerSection>

                  {d.payments && d.payments.length > 0 && (
                    <AdminDrawerSection title="Recent payments">
                      {d.payments.map((p) => (
                        <div key={p.id} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0">
                          <span className="text-gray-600">{p.purpose.replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium tabular-nums">{formatSar(p.amountSar)}</span>
                            <AdminStatusBadge status={p.status} />
                          </div>
                        </div>
                      ))}
                    </AdminDrawerSection>
                  )}

                  {d.trips && d.trips.length > 0 && (
                    <AdminDrawerSection title="Recent trips">
                      {d.trips.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0">
                          <span className="text-gray-600">{formatDateLabel(t.scheduledDate)}</span>
                          <AdminStatusBadge status={t.status} />
                        </div>
                      ))}
                    </AdminDrawerSection>
                  )}

                  {d.status !== 'CANCELLED' && (
                    <AdminDrawerSection title="Cancel subscription">
                      <Textarea rows={2} placeholder="Cancellation reason (required)…" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                      <Button variant="danger" size="sm" loading={cancelling} onClick={() => submitCancel(d.id)} className="mt-2 min-h-[44px]">
                        Confirm cancellation
                      </Button>
                    </AdminDrawerSection>
                  )}
                </>
              );
            })()}
          </>
        )}
      </AdminDrawer>
    </div>
  );
}
