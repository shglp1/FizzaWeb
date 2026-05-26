'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Copy,
  MapPin,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import type { MapPlaceType } from '@prisma/client';
import {
  adminMapDiagnosticsService,
  adminMapPlaceService,
  adminMapLocationReviewService,
} from '@/services/adminService';
import { Alert, Button, Input, Textarea } from '@/components/ui';
import { MapPlaceTypeIcon } from '@/components/location/MapPlaceTypeIcon';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminTable,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDrawer,
  AdminDrawerSection,
  AdminFilterSelect,
  AdminDataCard,
  AdminMetaItem,
  AdminDrawerRow,
} from '@/components/admin/AdminUI';
import { MAP_PLACE_TYPES, mapPlaceTypeLabel } from '@/lib/maps/mapPlaceTypes';

type MapPlaceRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  type: MapPlaceType;
  city: string;
  region: string | null;
  latitude: string | number;
  longitude: string | number;
  aliasesAr: unknown;
  aliasesEn: unknown;
  isActive: boolean;
  isVerified: boolean;
  notes: string | null;
  updatedAt?: string;
};

type FormState = {
  nameAr: string;
  nameEn: string;
  type: MapPlaceType;
  city: string;
  region: string;
  latitude: string;
  longitude: string;
  aliasesAr: string;
  aliasesEn: string;
  isActive: boolean;
  isVerified: boolean;
  notes: string;
};

const EMPTY: FormState = {
  nameAr: '',
  nameEn: '',
  type: 'LANDMARK',
  city: '',
  region: '',
  latitude: '',
  longitude: '',
  aliasesAr: '',
  aliasesEn: '',
  isActive: true,
  isVerified: false,
  notes: '',
};

function aliasesToString(v: unknown): string {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join(', ');
  return '';
}

function aliasesFromString(v: string): string[] {
  return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

function inferTypeFromKind(kind: string): MapPlaceType {
  const k = kind.toUpperCase();
  if (k.includes('PICKUP') || k.includes('DROPOFF')) return 'LANDMARK';
  if (k.includes('SCHOOL')) return 'SCHOOL';
  if (k.includes('UNIVERSITY')) return 'UNIVERSITY';
  return 'LANDMARK';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type ListResponse = {
  items: MapPlaceRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  stats?: { total: number; verified: number; inactive: number; cities: number };
};

type ReviewRow = {
  id: string;
  label: string;
  locationKind: string;
  city?: string | null;
  latitude: string | number;
  longitude: string | number;
  source: string;
  confidence: string;
  status: string;
  createdAt?: string;
  subscriptionId?: string | null;
  subscription?: { id: string; pickupLocation?: string; dropoffLocation?: string } | null;
};

type DiagnosticsData = {
  timestamp: string;
  osmTileCspConfigured: boolean;
  orsConfigured: boolean;
  osrmReachable: boolean;
  nominatimReachable: boolean;
  mapSearchProvider: string;
  mapRouteProvider: string;
  mapPlaces: { total: number; verified: number; inactive: number; cities: number };
  geocodeCache: { total: number; active: number; expired: number };
  storageDriver: string;
  seedPlacesPresent: boolean;
};

function PlaceFormFields({
  form,
  setForm,
  idPrefix,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  idPrefix: string;
}) {
  return (
    <>
      <AdminDrawerSection title="Basic information">
        <Input label="Arabic name" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
        <Input label="English name" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />
        <div>
          <label htmlFor={`${idPrefix}-type`} className="block text-xs font-medium text-gray-600 mb-1">
            Type
          </label>
          <AdminFilterSelect
            id={`${idPrefix}-type`}
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v as MapPlaceType })}
            options={MAP_PLACE_TYPES.map((t) => ({ value: t, label: mapPlaceTypeLabel(t) }))}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
          <Input label="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </div>
      </AdminDrawerSection>

      <AdminDrawerSection title="Location">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Latitude" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required />
          <Input label="Longitude" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required />
        </div>
        {form.latitude && form.longitude && (
          <p className="text-xs text-gray-500 font-mono pt-1">
            Preview: {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
          </p>
        )}
      </AdminDrawerSection>

      <AdminDrawerSection title="Aliases">
        <Input label="Arabic aliases" value={form.aliasesAr} onChange={(e) => setForm({ ...form, aliasesAr: e.target.value })} helpText="Comma-separated alternate names" />
        <Input label="English aliases" value={form.aliasesEn} onChange={(e) => setForm({ ...form, aliasesEn: e.target.value })} helpText="Comma-separated alternate names" />
      </AdminDrawerSection>

      <AdminDrawerSection title="Status">
        <label className="flex items-center gap-2 text-sm min-h-[44px] cursor-pointer">
          <input type="checkbox" checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} className="rounded accent-emerald-600 h-4 w-4" />
          Verified place
        </label>
        <label className="flex items-center gap-2 text-sm min-h-[44px] cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded accent-emerald-600 h-4 w-4" />
          Active
        </label>
      </AdminDrawerSection>

      <AdminDrawerSection title="Notes">
        <Textarea label="Admin notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </AdminDrawerSection>
    </>
  );
}

export function MapPlacesSection() {
  const [places, setPlaces] = useState<MapPlaceRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, verified: 0, inactive: 0, cities: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingReviews, setPendingReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [convertReviewId, setConvertReviewId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState<FormState>(EMPTY);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setTableLoading(true);
    adminMapPlaceService
      .list({
        q: search || undefined,
        city: cityFilter || undefined,
        type: typeFilter || undefined,
        verified: verifiedFilter || undefined,
        active: activeFilter || undefined,
        page,
        limit: 25,
      })
      .then((res) => {
        if (res.error) setError(res.error.message);
        else {
          const data = res.data as ListResponse;
          setPlaces(data?.items ?? []);
          setTotalPages(data?.pages ?? 1);
          if (data?.stats) setStats(data.stats);
        }
        setLoading(false);
        setTableLoading(false);
      });
    adminMapLocationReviewService.list({ status: 'PENDING', limit: 10 }).then((res) => {
      if (res.data) {
        const d = res.data as { items?: ReviewRow[]; total?: number };
        setPendingReviews(d.items ?? []);
        setPendingCount(d.total ?? d.items?.length ?? 0);
      }
    });
  }, [search, cityFilter, typeFilter, verifiedFilter, activeFilter, page]);

  useEffect(() => { load(); }, [load]);

  const activePlaces = stats.total - stats.inactive;

  const activeChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (search) chips.push({ label: `Search: ${search}`, onRemove: () => setSearch('') });
    if (cityFilter) chips.push({ label: `City: ${cityFilter}`, onRemove: () => setCityFilter('') });
    if (typeFilter) chips.push({ label: `Type: ${mapPlaceTypeLabel(typeFilter as MapPlaceType)}`, onRemove: () => setTypeFilter('') });
    if (verifiedFilter) chips.push({ label: verifiedFilter === 'true' ? 'Verified only' : 'Unverified only', onRemove: () => setVerifiedFilter('') });
    if (activeFilter) chips.push({ label: activeFilter === 'true' ? 'Active only' : 'Inactive only', onRemove: () => setActiveFilter('') });
    return chips;
  }, [search, cityFilter, typeFilter, verifiedFilter, activeFilter]);

  const resetFilters = () => {
    setSearch('');
    setCityFilter('');
    setTypeFilter('');
    setVerifiedFilter('');
    setActiveFilter('');
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDrawerOpen(true);
    setError('');
  };

  const openEdit = (p: MapPlaceRow) => {
    setEditingId(p.id);
    setForm({
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      type: p.type,
      city: p.city,
      region: p.region ?? '',
      latitude: String(p.latitude),
      longitude: String(p.longitude),
      aliasesAr: aliasesToString(p.aliasesAr),
      aliasesEn: aliasesToString(p.aliasesEn),
      isActive: p.isActive,
      isVerified: p.isVerified,
      notes: p.notes ?? '',
    });
    setDrawerOpen(true);
    setError('');
  };

  const buildPayload = (f: FormState) => ({
    nameAr: f.nameAr.trim(),
    nameEn: f.nameEn.trim(),
    type: f.type,
    city: f.city.trim(),
    region: f.region.trim() || null,
    latitude: Number(f.latitude),
    longitude: Number(f.longitude),
    aliasesAr: aliasesFromString(f.aliasesAr),
    aliasesEn: aliasesFromString(f.aliasesEn),
    isActive: f.isActive,
    isVerified: f.isVerified,
    notes: f.notes.trim() || null,
  });

  const save = async () => {
    setSaving(true);
    setError('');
    const payload = buildPayload(form);
    if (!payload.nameAr || !payload.nameEn || !payload.city || !Number.isFinite(payload.latitude)) {
      setError('Arabic name, English name, city, and coordinates are required.');
      setSaving(false);
      return;
    }
    const res = editingId
      ? await adminMapPlaceService.update(editingId, payload)
      : await adminMapPlaceService.create(payload);
    setSaving(false);
    if (res.error) setError(res.error.message);
    else {
      setMsg(editingId ? 'Place updated' : 'Place created');
      setDrawerOpen(false);
      load({ silent: true });
    }
  };

  const openConvertModal = (r: ReviewRow) => {
    setConvertReviewId(r.id);
    setConvertForm({
      nameAr: r.label,
      nameEn: r.label,
      type: inferTypeFromKind(r.locationKind),
      city: r.city?.trim() || '',
      region: '',
      latitude: String(r.latitude),
      longitude: String(r.longitude),
      aliasesAr: '',
      aliasesEn: '',
      isActive: true,
      isVerified: true,
      notes: `From subscription review (${r.source}, ${r.confidence})`,
    });
    setError('');
  };

  const saveConvert = async () => {
    if (!convertReviewId) return;
    setSaving(true);
    setError('');
    const payload = buildPayload(convertForm);
    if (!payload.nameAr || !payload.nameEn || !payload.city) {
      setError('Please set Arabic name, English name, city, and type before saving.');
      setSaving(false);
      return;
    }
    const res = await adminMapLocationReviewService.convert(convertReviewId, {
      label: payload.nameEn,
      nameAr: payload.nameAr,
      nameEn: payload.nameEn,
      type: payload.type,
      city: payload.city,
    });
    if (res.error) {
      setSaving(false);
      setError(res.error.message);
      return;
    }
    const placeId = (res.data as { place?: { id: string } })?.place?.id;
    if (placeId) {
      await adminMapPlaceService.update(placeId, {
        region: payload.region,
        aliasesAr: payload.aliasesAr,
        aliasesEn: payload.aliasesEn,
        isActive: payload.isActive,
        isVerified: payload.isVerified,
        notes: payload.notes,
      });
    }
    setSaving(false);
    setConvertReviewId(null);
    setMsg('Review saved as verified place');
    load({ silent: true });
  };

  const runDiagnostics = async () => {
    setDiagnosticsOpen(true);
    setDiagnosticsLoading(true);
    setDiagnostics(null);
    const res = await adminMapDiagnosticsService.get();
    setDiagnosticsLoading(false);
    if (res.error) setError(res.error.message);
    else setDiagnostics(res.data as DiagnosticsData);
  };

  const copyCoords = async (p: MapPlaceRow) => {
    const text = `${Number(p.latitude).toFixed(6)}, ${Number(p.longitude).toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Coordinates copied');
    } catch {
      setError('Could not copy coordinates');
    }
  };

  if (loading && places.length === 0) {
    return (
      <div className="space-y-6 min-w-0 animate-pulse">
        <div className="h-16 rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100" />
          ))}
        </div>
        <div className="h-40 rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <AdminSectionHeader
        title="Map Places Registry"
        subtitle="Manage verified pickup and drop-off places used by Fizza maps."
        count={stats.total}
        countLabel="places"
        primaryAction={
          <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">
            Add Place
          </Button>
        }
        secondaryAction={
          <Button variant="outline" size="sm" onClick={() => void runDiagnostics()} className="min-h-[44px] gap-1.5">
            <Stethoscope className="h-4 w-4" aria-hidden />
            Run Diagnostics
          </Button>
        }
      />

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}
      {msg && <Alert variant="success" onClose={() => setMsg('')}>{msg}</Alert>}

      <AdminMetricGrid
        columns={5}
        items={[
          { label: 'Total places', value: stats.total, icon: MapPin, color: '#059669' },
          { label: 'Verified places', value: stats.verified, icon: ShieldCheck, color: '#2563EB' },
          { label: 'Active places', value: activePlaces, icon: Activity, color: '#10B981' },
          { label: 'Pending reviews', value: pendingCount, icon: ClipboardList, color: '#D97706' },
          { label: 'Cities covered', value: stats.cities, icon: CheckCircle2, color: '#6366F1' },
        ]}
      />

      {pendingReviews.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5 space-y-4 shadow-card">
          <div>
            <h3 className="text-base font-semibold text-amber-950">Unverified locations from subscriptions</h3>
            <p className="text-sm text-amber-800/80 mt-1">
              Review low-confidence or manual pins before adding them to the verified registry.
            </p>
          </div>
          <ul className="space-y-3">
            {pendingReviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-amber-100 bg-white p-4 space-y-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 break-words">{r.label}</p>
                  <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
                    <span>
                      <span className="font-medium text-gray-500">Coordinates: </span>
                      {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                    </span>
                    <span>
                      <span className="font-medium text-gray-500">Source: </span>
                      {r.source}
                    </span>
                    <span>
                      <span className="font-medium text-gray-500">Confidence: </span>
                      {r.confidence}
                    </span>
                    <span>
                      <span className="font-medium text-gray-500">Kind: </span>
                      {r.locationKind}
                    </span>
                    {r.subscriptionId && (
                      <span className="sm:col-span-2">
                        <span className="font-medium text-gray-500">Subscription: </span>
                        {r.subscriptionId.slice(0, 8)}…
                      </span>
                    )}
                    <span>
                      <span className="font-medium text-gray-500">Created: </span>
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => void adminMapLocationReviewService.ignore(r.id).then(() => load({ silent: true }))}
                  >
                    Ignore
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => openConvertModal(r)}
                  >
                    Edit before saving
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => openConvertModal(r)}
                  >
                    Save as verified place
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AdminToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search Arabic name, English name, aliases, or city…"
        onReset={resetFilters}
        activeChips={activeChips}
        filters={[
          {
            id: 'mp-city',
            label: 'City',
            element: (
              <Input id="mp-city" value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} placeholder="Medina" className="min-h-[44px]" />
            ),
          },
          {
            id: 'mp-type',
            label: 'Type',
            element: (
              <AdminFilterSelect
                id="mp-type"
                value={typeFilter}
                onChange={(v) => { setTypeFilter(v); setPage(1); }}
                options={[{ value: '', label: 'All types' }, ...MAP_PLACE_TYPES.map((t) => ({ value: t, label: mapPlaceTypeLabel(t) }))]}
              />
            ),
          },
          {
            id: 'mp-verified',
            label: 'Verified',
            element: (
              <AdminFilterSelect
                id="mp-verified"
                value={verifiedFilter}
                onChange={(v) => { setVerifiedFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'All' },
                  { value: 'true', label: 'Verified' },
                  { value: 'false', label: 'Unverified' },
                ]}
              />
            ),
          },
          {
            id: 'mp-active',
            label: 'Active',
            element: (
              <AdminFilterSelect
                id="mp-active"
                value={activeFilter}
                onChange={(v) => { setActiveFilter(v); setPage(1); }}
                options={[
                  { value: '', label: 'All' },
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
              />
            ),
          },
        ]}
      />

      {tableLoading && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500" role="status">
          Updating places…
        </div>
      )}

      {!tableLoading && places.length === 0 ? (
        <AdminEmptyState
          icon={MapPin}
          title="No map places match your filters"
          description="Add verified Saudi neighborhoods, schools, and landmarks for reliable parent search."
          action={<Button variant="primary" onClick={openCreate} className="min-h-[44px]">Add Place</Button>}
        />
      ) : !tableLoading ? (
        <AdminTable
          rows={places}
          columns={[
            {
              key: 'names',
              header: 'Place name',
              cell: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{r.nameEn}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.nameAr}</p>
                </div>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              cell: (r) => (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <MapPlaceTypeIcon type={r.type} className="h-4 w-4 text-emerald-700" />
                  {mapPlaceTypeLabel(r.type)}
                </span>
              ),
            },
            { key: 'loc', header: 'City / Region', cell: (r) => `${r.city}${r.region ? ` · ${r.region}` : ''}` },
            {
              key: 'coords',
              header: 'Coordinates',
              cell: (r) => (
                <span className="font-mono text-xs text-gray-600">
                  {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                </span>
              ),
            },
            {
              key: 'verified',
              header: 'Verified',
              cell: (r) => (
                r.isVerified ? <AdminStatusBadge status="ACTIVE" label="Verified" /> : <AdminStatusBadge status="INACTIVE" label="Unverified" />
              ),
            },
            {
              key: 'active',
              header: 'Active',
              cell: (r) => <AdminStatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />,
            },
            {
              key: 'updated',
              header: 'Updated',
              cell: (r) => <span className="text-xs text-gray-600">{formatDate(r.updatedAt)}</span>,
            },
          ]}
          rowActions={(r) => (
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(r)} className="min-h-[44px]">Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => void copyCoords(r)} className="gap-1 min-h-[44px]">
                <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
              </Button>
            </div>
          )}
          mobileCard={(r) => (
            <AdminDataCard
              title={r.nameEn}
              subtitle={r.nameAr}
              badges={
                <>
                  {r.isVerified && <AdminStatusBadge status="ACTIVE" label="Verified" />}
                  <AdminStatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} />
                </>
              }
              metadata={
                <>
                  <AdminMetaItem label="Type" value={
                    <span className="inline-flex items-center gap-1">
                      <MapPlaceTypeIcon type={r.type} className="h-3.5 w-3.5" />
                      {mapPlaceTypeLabel(r.type)}
                    </span>
                  } />
                  <AdminMetaItem label="City" value={r.city} />
                  <AdminMetaItem label="Coords" value={`${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`} />
                  <AdminMetaItem label="Updated" value={formatDate(r.updatedAt)} />
                </>
              }
              actions={
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => void copyCoords(r)}>Copy</Button>
                </div>
              }
              compact
            />
          )}
        />
      ) : null}

      {places.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="min-h-[44px]">
            Previous
          </Button>
          <span className="text-xs text-gray-600">Page {page} of {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="min-h-[44px]">
            Next
          </Button>
        </div>
      )}

      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? 'Edit place' : 'Add place'}
        subtitle="Names and coordinates appear in parent subscription search."
        width="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setDrawerOpen(false)} className="min-h-[44px]">Cancel</Button>
            <Button variant="primary" loading={saving} onClick={() => void save()} className="min-h-[44px]">
              Save Place
            </Button>
          </div>
        }
      >
        <PlaceFormFields form={form} setForm={setForm} idPrefix="place" />
      </AdminDrawer>

      <AdminDrawer
        open={!!convertReviewId}
        onClose={() => setConvertReviewId(null)}
        title="Save as verified place"
        subtitle="Review and complete all fields before adding to the registry. City and type are required."
        width="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setConvertReviewId(null)} className="min-h-[44px]">Cancel</Button>
            <Button variant="primary" loading={saving} onClick={() => void saveConvert()} className="min-h-[44px]">
              Save Place
            </Button>
          </div>
        }
      >
        <Alert variant="warning">
          Confirm Arabic name, English name, type, and city. Do not save with placeholder values.
        </Alert>
        <PlaceFormFields form={convertForm} setForm={setConvertForm} idPrefix="convert" />
      </AdminDrawer>

      <AdminDrawer
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        title="Map diagnostics"
        subtitle="Runtime checks for tiles, providers, and registry health."
        width="lg"
        footer={
          <Button variant="ghost" onClick={() => setDiagnosticsOpen(false)} className="min-h-[44px]">Close</Button>
        }
      >
        {diagnosticsLoading && (
          <p className="text-sm text-gray-500" role="status">Running diagnostics…</p>
        )}
        {diagnostics && (
          <div className="space-y-4">
            <AdminDrawerSection title="Providers">
              <AdminDrawerRow label="Search provider" value={diagnostics.mapSearchProvider} />
              <AdminDrawerRow label="Route provider" value={diagnostics.mapRouteProvider} />
              <AdminDrawerRow label="ORS configured" value={diagnostics.orsConfigured ? 'Yes' : 'No'} />
              <AdminDrawerRow label="OSRM reachable" value={diagnostics.osrmReachable ? 'Yes' : 'No'} />
              <AdminDrawerRow label="Nominatim reachable" value={diagnostics.nominatimReachable ? 'Yes' : 'No'} />
            </AdminDrawerSection>
            <AdminDrawerSection title="Registry">
              <AdminDrawerRow label="Total places" value={diagnostics.mapPlaces.total} />
              <AdminDrawerRow label="Verified" value={diagnostics.mapPlaces.verified} />
              <AdminDrawerRow label="Cities" value={diagnostics.mapPlaces.cities} />
              <AdminDrawerRow label="Seed places present" value={diagnostics.seedPlacesPresent ? 'Yes' : 'No'} />
            </AdminDrawerSection>
            <AdminDrawerSection title="Infrastructure">
              <AdminDrawerRow label="OSM tile CSP" value={diagnostics.osmTileCspConfigured ? 'Configured' : 'Missing'} />
              <AdminDrawerRow label="Storage driver" value={diagnostics.storageDriver} />
              <AdminDrawerRow label="Geocode cache" value={`${diagnostics.geocodeCache.active} active / ${diagnostics.geocodeCache.total} total`} />
              <AdminDrawerRow label="Checked at" value={new Date(diagnostics.timestamp).toLocaleString()} />
            </AdminDrawerSection>
          </div>
        )}
      </AdminDrawer>
    </div>
  );
}
