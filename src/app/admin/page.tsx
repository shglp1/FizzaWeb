'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { driverApplicationService } from '@/services/driverApplicationService';

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

type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };

const TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Needs Changes', value: 'NEEDS_CHANGES' },
];

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  NEEDS_CHANGES: { label: 'Needs Changes', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
};

export default function AdminPage() {
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

  const loadApplications = (status: string, p: number) => {
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
  };

  useEffect(() => {
    loadApplications(activeTab, page);
  }, [activeTab, page]);

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
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Admin — Driver Applications</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
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
        <p className="text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 text-sm mb-4">
          {reviewSuccess}
        </p>
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
            const cfg = STATUS_CONFIG[app.status];
            const isReviewing = reviewingId === app.id;

            return (
              <div key={app.id} className="card">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-semibold text-base">{app.applicant.fullName}</h2>
                    <p className="text-sm text-gray-500">{app.applicant.user.email}</p>
                    {app.applicant.phone && (
                      <p className="text-sm text-gray-500">{app.applicant.phone}</p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${cfg.bg} ${cfg.color} border ${cfg.border}`}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Vehicle & Driver info */}
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-700 mb-4">
                  <p><span className="text-gray-400">Type:</span> {app.vehicleCategory}</p>
                  <p><span className="text-gray-400">Vehicle:</span> {app.vehicleBrand} {app.vehicleModel} ({app.vehicleYear})</p>
                  <p><span className="text-gray-400">Plate:</span> {app.plateNumber}</p>
                  <p><span className="text-gray-400">Color:</span> {app.vehicleColor}</p>
                  <p><span className="text-gray-400">Capacity:</span> {app.vehicleCapacity} seats</p>
                  <p><span className="text-gray-400">License:</span> {app.licenseNumber}</p>
                  <p><span className="text-gray-400">City:</span> {app.city}</p>
                  <p><span className="text-gray-400">Area:</span> {app.serviceArea}</p>
                  {app.femaleDriver && (
                    <p className="text-emerald-600 font-medium">Female driver ✓</p>
                  )}
                </div>

                {app.driverNotes && (
                  <div className="mb-3 p-2 bg-gray-50 rounded-lg text-sm text-gray-600 italic">
                    {app.driverNotes}
                  </div>
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

                {/* Action buttons — only for PENDING or NEEDS_CHANGES */}
                {(app.status === 'PENDING' || app.status === 'NEEDS_CHANGES') && (
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex gap-2 flex-wrap mb-3">
                      <button
                        onClick={() => startReview(app.id, 'APPROVE')}
                        className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-all ${
                          isReviewing && reviewAction === 'APPROVE'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => startReview(app.id, 'NEEDS_CHANGES')}
                        className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-all ${
                          isReviewing && reviewAction === 'NEEDS_CHANGES'
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'border-orange-300 text-orange-600 hover:bg-orange-50'
                        }`}
                      >
                        Request Changes
                      </button>
                      <button
                        onClick={() => startReview(app.id, 'REJECT')}
                        className={`text-sm px-4 py-2 rounded-xl font-semibold border transition-all ${
                          isReviewing && reviewAction === 'REJECT'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'border-red-300 text-red-600 hover:bg-red-50'
                        }`}
                      >
                        Reject
                      </button>
                    </div>

                    {isReviewing && (
                      <div className="space-y-2">
                        {reviewAction !== 'APPROVE' && (
                          <textarea
                            className="input h-20 resize-none w-full"
                            placeholder={
                              reviewAction === 'REJECT'
                                ? 'Reason for rejection (required)…'
                                : 'Describe the changes needed (required)…'
                            }
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                          />
                        )}
                        {reviewAction === 'APPROVE' && (
                          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                            This will approve the application, create a Driver record, and upgrade the user role to Driver.
                          </p>
                        )}
                        {reviewError && (
                          <p className="text-red-600 text-sm">{reviewError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitReview(app.id)}
                            disabled={reviewSubmitting}
                            className="btn-primary text-sm px-4 py-2"
                          >
                            {reviewSubmitting ? 'Submitting…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => { setReviewingId(null); setReviewAction(null); }}
                            className="btn-outline text-sm px-4 py-2"
                          >
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

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-outline text-sm px-4 py-2 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            className="btn-outline text-sm px-4 py-2 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </AppShell>
  );
}
