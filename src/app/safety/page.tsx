'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  Card,
  Button,
  Alert,
  Badge,
  StatusBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  Textarea,
} from '@/components/ui';
import { safetyService } from '@/services/safetyService';
import { tripService } from '@/services/tripService';
import {
  DriverPageHeader,
  DriverSafetyKpiRow,
  DriverEmptyState,
  DriverErrorState,
  DriverLoadingState,
} from '@/components/driver/DriverUI';
import { DRIVER_SAFETY_STATUS_LABEL, type SafetyStatusKey } from '@/lib/ui/driverPortal';
import type { LucideIcon } from 'lucide-react';
import {
  Car,
  ClipboardList,
  Clock,
  MapPin,
  MessageSquare,
  Paperclip,
  Shield,
  TriangleAlert,
  Wrench,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'UNSAFE_DRIVING', label: 'Unsafe Driving', Icon: Car },
  { value: 'HARASSMENT', label: 'Harassment', Icon: TriangleAlert },
  { value: 'VEHICLE_CONDITION', label: 'Vehicle Condition', Icon: Wrench },
  { value: 'ROUTE_DEVIATION', label: 'Route Deviation', Icon: MapPin },
  { value: 'LATE_PICKUP', label: 'Late Pickup', Icon: Clock },
  { value: 'BEHAVIOUR', label: 'Behaviour Issue', Icon: MessageSquare },
  { value: 'OTHER', label: 'Other', Icon: ClipboardList },
];

type SafetyStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

type Report = {
  id: string;
  category: string;
  description: string;
  status: SafetyStatus;
  adminResponse: string | null;
  createdAt: string;
  trip: { id: string; scheduledDate: string; pickupLocation: string } | null;
  attachments: { id: string; filePath: string }[];
};

const STATUS_VARIANT: Record<SafetyStatus, 'warning' | 'success' | 'danger' | 'info'> = {
  PENDING:  'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  RESOLVED: 'info',
};

const STATUS_LABEL: Record<SafetyStatus, string> = {
  PENDING:  'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RESOLVED: 'Resolved',
};

const EMPTY_FORM = { category: '', description: '', tripId: '', attachmentUrl: '' };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SafetyPage() {
  const [reports, setReports]           = useState<Report[]>([]);
  const [loading, setLoading]           = useState(true);
  const [pageError, setPageError]       = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState('');
  const [formSuccess, setFormSuccess]   = useState('');
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editDesc, setEditDesc]         = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError]       = useState('');
  const [userRole, setUserRole]         = useState<string | null>(null);
  const [tripOptions, setTripOptions]   = useState<{ id: string; label: string }[]>([]);

  const loadReports = () => {
    setLoading(true);
    safetyService.listReports().then((res: { data?: { reports: Report[] }; error?: { message: string } }) => {
      if (res.data) setReports(res.data.reports);
      else setPageError(res.error?.message ?? 'Failed to load safety reports.');
      setLoading(false);
    });
  };

  useEffect(() => { loadReports(); }, []);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.role) {
          setUserRole(res.data.role);
          if (res.data.role === 'DRIVER') {
            tripService.list('upcoming').then((tRes) => {
              if (tRes.data && Array.isArray(tRes.data)) {
                setTripOptions(
                  tRes.data.slice(0, 20).map((t: { id: string; scheduledDate: string; rider: { name: string } | null; pickupLocation: string }) => ({
                    id: t.id,
                    label: `${new Date(t.scheduledDate).toLocaleDateString()} · ${t.rider?.name ?? 'Rider'} · ${t.pickupLocation}`,
                  })),
                );
              }
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.category)                 { setFormError('Please select a category.'); return; }
    if (form.description.length < 20)   { setFormError('Description must be at least 20 characters.'); return; }
    setFormError('');
    setSubmitting(true);
    const payload: { category: string; description: string; tripId?: string; attachmentUrls?: string[] } = {
      category: form.category,
      description: form.description,
    };
    if (form.tripId.trim())        payload.tripId = form.tripId.trim();
    if (form.attachmentUrl.trim()) payload.attachmentUrls = [form.attachmentUrl.trim()];

    const res = await safetyService.createReport(payload);
    setSubmitting(false);
    if (res.data?.reportId) {
      setFormSuccess('Safety report submitted. Our team will review it shortly.');
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadReports();
    } else {
      setFormError(res.error?.message ?? 'Failed to submit report. Please try again.');
    }
  };

  const handleEditSave = async (reportId: string) => {
    if (editDesc.length < 20) { setEditError('Description must be at least 20 characters.'); return; }
    setEditSubmitting(true);
    setEditError('');
    const res = await safetyService.updateReport(reportId, { description: editDesc });
    setEditSubmitting(false);
    if (res.data) {
      setEditingId(null);
      loadReports();
    } else {
      setEditError(res.error?.message ?? 'Update failed.');
    }
  };

  const catMeta = (val: string) => CATEGORIES.find((c) => c.value === val) ?? CATEGORIES[CATEGORIES.length - 1];
  const isDriver = userRole === 'DRIVER';

  const kpi = {
    submitted: reports.length,
    underReview: reports.filter((r) => r.status === 'PENDING').length,
    resolved: reports.filter((r) => r.status === 'RESOLVED' || r.status === 'APPROVED').length,
    rejected: reports.filter((r) => r.status === 'REJECTED').length,
  };

  const header = isDriver ? (
    <DriverPageHeader
      title="Safety Center"
      subtitle="Report incidents and review admin responses."
      action={
        <Button
          variant={showForm ? 'ghost' : 'primary'}
          size="sm"
          onClick={() => { setShowForm((p) => !p); setFormError(''); setFormSuccess(''); }}
        >
          {showForm ? 'Cancel' : 'New Report'}
        </Button>
      }
    />
  ) : (
    <PageHeader
      title="Safety Reports"
      subtitle={`${reports.length} report${reports.length !== 1 ? 's' : ''} submitted`}
      action={
        <Button
          variant={showForm ? 'ghost' : 'primary'}
          size="sm"
          onClick={() => { setShowForm((p) => !p); setFormError(''); setFormSuccess(''); }}
        >
          {showForm ? 'Cancel' : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Report
            </>
          )}
        </Button>
      }
    />
  );

  return (
    <AppShell>
      {header}

      {isDriver && !loading && reports.length >= 0 && (
        <div className="mb-5">
          <DriverSafetyKpiRow {...kpi} />
        </div>
      )}

      {/* Success feedback */}
      {formSuccess && (
        <Alert variant="success" className="mb-4" onClose={() => setFormSuccess('')}>
          {formSuccess}
        </Alert>
      )}

      {/* Submit form */}
      {showForm && (
        <Card className="mb-5 border-fizza-secondary/30 bg-emerald-50/20">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Submit a Safety Report</h2>

          {formError && (
            <Alert variant="error" className="mb-4" onClose={() => setFormError('')}>{formError}</Alert>
          )}

          {/* Category selector */}
          <div className="field mb-4">
            <label className="label">Category <span className="text-red-500 ml-0.5">*</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, category: c.value }))}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                    form.category === c.value
                      ? 'border-fizza-secondary bg-emerald-50 text-fizza-primary'
                      : 'border-gray-200 text-gray-600 hover:border-emerald-200'
                  }`}
                >
                  <c.Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Description"
            required
            rows={4}
            placeholder="Describe what happened in detail (at least 20 characters)…"
            value={form.description}
            helpText={`${form.description.length} / 20 minimum`}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            {isDriver && tripOptions.length > 0 ? (
              <div className="field sm:col-span-2">
                <label className="label">Linked trip <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  className="input"
                  value={form.tripId}
                  onChange={(e) => setForm((p) => ({ ...p, tripId: e.target.value }))}
                >
                  <option value="">Not trip-related</option>
                  {tripOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="field">
                <label className="label">Trip ID <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={form.tripId}
                  onChange={(e) => setForm((p) => ({ ...p, tripId: e.target.value }))}
                  placeholder="Leave blank if not trip-related"
                  className="input"
                />
              </div>
            )}
            <div className="field">
              <label className="label">Attachment URL <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="url"
                value={form.attachmentUrl}
                onChange={(e) => setForm((p) => ({ ...p, attachmentUrl: e.target.value }))}
                placeholder="https://…"
                className="input"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <Button variant="primary" loading={submitting} onClick={handleSubmit}>
              Submit Report
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setFormError(''); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Reports list */}
      {loading ? (
        isDriver ? <DriverLoadingState message="Loading safety reports…" /> : <LoadingState message="Loading safety reports…" />
      ) : pageError ? (
        isDriver ? <DriverErrorState message={pageError} onRetry={loadReports} /> : <ErrorState message={pageError} onRetry={loadReports} />
      ) : reports.length === 0 ? (
        isDriver ? (
          <DriverEmptyState
            icon={Shield}
            title="No safety reports submitted."
            description="If you experienced a safety concern on a trip, submit a report."
            action={<Button variant="primary" size="sm" onClick={() => setShowForm(true)}>New Report</Button>}
          />
        ) : (
          <EmptyState
            icon="shield"
            title="No safety reports yet"
            description="If you experienced a safety concern on a trip, please submit a report."
            action={{ label: 'Submit First Report', onClick: () => setShowForm(true) }}
          />
        )
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 shrink-0">
                    {(() => {
                      const m = catMeta(report.category);
                      return <m.Icon className="h-5 w-5 text-red-600" strokeWidth={1.75} aria-hidden />;
                    })()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{catMeta(report.category).label}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(report.createdAt).toLocaleDateString('en-SA', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <StatusBadge variant={STATUS_VARIANT[report.status]}>
                  {isDriver ? (DRIVER_SAFETY_STATUS_LABEL[report.status as SafetyStatusKey] ?? STATUS_LABEL[report.status]) : STATUS_LABEL[report.status]}
                </StatusBadge>
              </div>

              {/* Description (edit or read) */}
              {editingId === report.id ? (
                <div className="mb-3">
                  <Textarea
                    rows={3}
                    value={editDesc}
                    error={editError}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button variant="primary" size="sm" loading={editSubmitting} onClick={() => handleEditSave(report.id)}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 mb-3 leading-relaxed">{report.description}</p>
              )}

              {/* Trip link */}
              {report.trip && (
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  Trip on {new Date(report.trip.scheduledDate).toLocaleDateString()} · {report.trip.pickupLocation}
                </div>
              )}

              {/* Attachments */}
              {report.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {report.attachments.map((a, i) => (
                    <a
                      key={a.id}
                      href={a.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      <Paperclip className="h-3 w-3" aria-hidden />
                      Attachment {i + 1}
                    </a>
                  ))}
                </div>
              )}

              {/* Admin response */}
              {report.adminResponse && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Admin Response</p>
                  <p className="text-sm text-gray-700">{report.adminResponse}</p>
                </div>
              )}

              {/* Edit button (pending only) */}
              {report.status === 'PENDING' && editingId !== report.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditingId(report.id); setEditDesc(report.description); setEditError(''); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Report
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
