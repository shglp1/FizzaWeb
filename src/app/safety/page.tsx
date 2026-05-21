'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { safetyService } from '@/services/safetyService';

const CATEGORIES = [
  { value: 'UNSAFE_DRIVING', label: 'Unsafe Driving' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'VEHICLE_CONDITION', label: 'Vehicle Condition' },
  { value: 'ROUTE_DEVIATION', label: 'Route Deviation' },
  { value: 'LATE_PICKUP', label: 'Late Pickup' },
  { value: 'BEHAVIOUR', label: 'Behaviour Issue' },
  { value: 'OTHER', label: 'Other' },
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

const STATUS_CFG: Record<SafetyStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING:  { label: 'Pending Review', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  APPROVED: { label: 'Approved',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  REJECTED: { label: 'Rejected',       color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  RESOLVED: { label: 'Resolved',       color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
};

const EMPTY_FORM = { category: '', description: '', tripId: '', attachmentUrl: '' };

export default function SafetyPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const loadReports = () => {
    setLoading(true);
    safetyService.listReports().then((res: { data?: { reports: Report[] }; error?: { message: string } }) => {
      if (res.data) setReports(res.data.reports);
      else setPageError(res.error?.message ?? 'Failed to load safety reports.');
      setLoading(false);
    });
  };

  useEffect(() => { loadReports(); }, []);

  const handleSubmit = async () => {
    if (!form.category) { setFormError('Please select a category.'); return; }
    if (form.description.length < 20) { setFormError('Description must be at least 20 characters.'); return; }
    setFormError('');
    setSubmitting(true);
    const payload: { category: string; description: string; tripId?: string; attachmentUrls?: string[] } = {
      category: form.category,
      description: form.description,
    };
    if (form.tripId.trim()) payload.tripId = form.tripId.trim();
    if (form.attachmentUrl.trim()) payload.attachmentUrls = [form.attachmentUrl.trim()];

    const res = await safetyService.createReport(payload);
    setSubmitting(false);
    if (res.data?.reportId) {
      setFormSuccess('Safety report submitted successfully. Our team will review it shortly.');
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

  const catLabel = (val: string) => CATEGORIES.find((c) => c.value === val)?.label ?? val;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Safety Reports</h1>
        <button
          onClick={() => { setShowForm((p) => !p); setFormError(''); setFormSuccess(''); }}
          className="btn-primary text-sm px-4 py-2 rounded-xl"
        >
          {showForm ? 'Cancel' : '+ New Report'}
        </button>
      </div>

      {formSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 mb-4">
          {formSuccess}
        </div>
      )}

      {/* Submit form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Submit a Safety Report</h2>
          {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}

          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <label className="block text-sm font-medium text-gray-700 mb-1">Description * (min 20 characters)</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Describe what happened in detail…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">Trip ID (optional)</label>
          <input
            type="text"
            value={form.tripId}
            onChange={(e) => setForm((p) => ({ ...p, tripId: e.target.value }))}
            placeholder="Leave blank if not related to a specific trip"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1">Attachment URL (optional)</label>
          <input
            type="url"
            value={form.attachmentUrl}
            onChange={(e) => setForm((p) => ({ ...p, attachmentUrl: e.target.value }))}
            placeholder="https://…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary text-sm px-5 py-2 rounded-xl disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading safety reports…</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No safety reports yet</p>
          <p className="text-gray-400 text-sm">
            If you experienced a safety concern, please submit a report.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const cfg = STATUS_CFG[report.status];
            return (
              <div key={report.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-base">{catLabel(report.category)}</p>
                    <p className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>

                {editingId === report.id ? (
                  <div className="mb-3">
                    <textarea
                      rows={3}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    {editError && <p className="text-xs text-red-600 mt-1">{editError}</p>}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEditSave(report.id)}
                        disabled={editSubmitting}
                        className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                      >
                        {editSubmitting ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 mb-3">{report.description}</p>
                )}

                {report.trip && (
                  <p className="text-xs text-gray-500 mb-2">
                    Trip: {new Date(report.trip.scheduledDate).toLocaleDateString()} — {report.trip.pickupLocation}
                  </p>
                )}

                {report.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {report.attachments.map((a) => (
                      <a key={a.id} href={a.filePath} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline">
                        Attachment
                      </a>
                    ))}
                  </div>
                )}

                {report.adminResponse && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 mb-3">
                    <span className="font-medium text-gray-500 text-xs block mb-0.5">Admin Response:</span>
                    {report.adminResponse}
                  </div>
                )}

                {report.status === 'PENDING' && editingId !== report.id && (
                  <button
                    onClick={() => { setEditingId(report.id); setEditDesc(report.description); setEditError(''); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Edit Report
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
