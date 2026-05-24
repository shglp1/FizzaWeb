'use client';

import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { safetyService } from '@/services/safetyService';
import { Button, Alert, Textarea, Pagination, ErrorState } from '@/components/ui';
import { Paperclip } from 'lucide-react';
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
} from '@/components/admin/AdminUI';

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

type PaginationMeta = { page: number; limit: number; total: number; totalPages: number };

const SAFETY_CAT_LABELS: Record<string, string> = {
  UNSAFE_DRIVING: 'Unsafe Driving',
  HARASSMENT: 'Harassment',
  VEHICLE_CONDITION: 'Vehicle Condition',
  ROUTE_DEVIATION: 'Route Deviation',
  LATE_PICKUP: 'Late Pickup',
  BEHAVIOUR: 'Behaviour Issue',
  OTHER: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RESOLVED: 'Resolved',
};

const HIGH_SEVERITY_CATS = ['UNSAFE_DRIVING', 'HARASSMENT', 'ROUTE_DEVIATION'];

export function SafetySection() {
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [safetyMeta, setSafetyMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [safetyPage, setSafetyPage] = useState(1);
  const [selected, setSelected] = useState<SafetyReport | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'RESOLVE' | null>(null);
  const [reviewResponse, setReviewResponse] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadReports = useCallback((status: string, category: string, from: string, to: string, p: number) => {
    setLoading(true);
    setPageError('');
    safetyService.adminListReports({
      status: status || undefined,
      category: category || undefined,
      dateFrom: from || undefined,
      dateTo: to || undefined,
      page: p,
    }).then((res: { data?: { reports: SafetyReport[]; meta: PaginationMeta }; error?: { message: string } }) => {
      if (res.data) {
        setReports(res.data.reports ?? []);
        setSafetyMeta(res.data.meta ?? null);
      } else {
        setPageError(res.error?.message ?? 'Failed to load safety reports.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadReports(statusFilter, categoryFilter, dateFrom, dateTo, safetyPage);
  }, [statusFilter, categoryFilter, dateFrom, dateTo, safetyPage, loadReports]);

  const openCount = reports.filter((r) => r.status === 'PENDING').length;
  const highSeverity = reports.filter((r) => HIGH_SEVERITY_CATS.includes(r.category)).length;

  const submitReview = async (reportId: string) => {
    if (!reviewAction) {
      setReviewMsg({ text: 'Select an action.', type: 'error' });
      return;
    }
    if ((reviewAction === 'REJECT' || reviewAction === 'RESOLVE') && !reviewResponse.trim()) {
      setReviewMsg({ text: 'Response required for Reject/Resolve.', type: 'error' });
      return;
    }
    setReviewSubmitting(true);
    setReviewMsg(null);
    const res = await safetyService.adminReviewReport(reportId, {
      action: reviewAction,
      adminResponse: reviewResponse.trim() || undefined,
    });
    setReviewSubmitting(false);
    if (res.data) {
      setReviewMsg({ text: 'Review submitted.', type: 'success' });
      setSelected(null);
      loadReports(statusFilter, categoryFilter, dateFrom, dateTo, safetyPage);
    } else {
      setReviewMsg({ text: res.error?.message ?? 'Review failed.', type: 'error' });
    }
  };

  return (
    <div>
      <AdminSectionHeader
        title="Safety Reports"
        subtitle="Incident reports requiring admin review and resolution"
        count={safetyMeta?.total}
        countLabel="reports"
      />

      <AdminMetricGrid
        columns={4}
        items={[
          { label: 'Open Reports', value: openCount, icon: AlertTriangle, color: '#D97706', helper: 'Pending on page' },
          { label: 'Under Review', value: reports.filter((r) => r.status === 'PENDING').length, icon: Shield },
          { label: 'Resolved', value: reports.filter((r) => ['APPROVED', 'RESOLVED'].includes(r.status)).length, icon: CheckCircle, color: '#059669' },
          { label: 'High Severity', value: highSeverity, icon: XCircle, color: '#DC2626', helper: 'On current page' },
        ]}
      />

      <AdminToolbar
        filters={[
          {
            id: 'safety-status',
            label: 'Status',
            element: (
              <AdminFilterSelect
                id="safety-status"
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setSafetyPage(1); }}
                options={[
                  { value: '', label: 'All statuses' },
                  ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
            ),
          },
          {
            id: 'safety-category',
            label: 'Category',
            element: (
              <AdminFilterSelect
                id="safety-category"
                value={categoryFilter}
                onChange={(v) => { setCategoryFilter(v); setSafetyPage(1); }}
                options={[
                  { value: '', label: 'All categories' },
                  ...Object.entries(SAFETY_CAT_LABELS).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
            ),
          },
          {
            id: 'safety-from',
            label: 'From',
            element: (
              <input id="safety-from" type="date" className="input text-sm h-11 w-full min-h-[44px]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSafetyPage(1); }} />
            ),
          },
          {
            id: 'safety-to',
            label: 'To',
            element: (
              <input id="safety-to" type="date" className="input text-sm h-11 w-full min-h-[44px]" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSafetyPage(1); }} />
            ),
          },
        ]}
      />

      {reviewMsg && !selected && (
        <Alert variant={reviewMsg.type} className="mb-4" onClose={() => setReviewMsg(null)}>{reviewMsg.text}</Alert>
      )}

      {loading ? (
        <AdminSectionLoading message="Loading safety reports…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => loadReports(statusFilter, categoryFilter, dateFrom, dateTo, safetyPage)} />
      ) : reports.length === 0 ? (
        <AdminEmptyState icon={Shield} title="No safety reports found" description="No reports match the selected filters." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {reports.map((report) => (
            <AdminDataCard
              key={report.id}
              title={SAFETY_CAT_LABELS[report.category] ?? report.category}
              subtitle={report.user?.fullName ?? 'Anonymous'}
              badges={
                <>
                  <AdminStatusBadge status={report.status} label={STATUS_LABELS[report.status]} />
                  {HIGH_SEVERITY_CATS.includes(report.category) && (
                    <span className="inline-flex items-center rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      High severity
                    </span>
                  )}
                </>
              }
              onClick={() => { setSelected(report); setReviewAction(null); setReviewResponse(''); setReviewMsg(null); }}
              compact
            >
              <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
              {report.adminResponse && (
                <p className="text-xs text-blue-600 mt-2 line-clamp-1">Response: {report.adminResponse}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">{new Date(report.createdAt).toLocaleDateString()}</p>
            </AdminDataCard>
          ))}
        </div>
      )}

      {safetyMeta && safetyMeta.totalPages > 1 && (
        <Pagination page={safetyMeta.page} totalPages={safetyMeta.totalPages} onPageChange={setSafetyPage} className="mt-5" />
      )}

      <AdminDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setReviewAction(null); }}
        title={selected ? (SAFETY_CAT_LABELS[selected.category] ?? selected.category) : ''}
        subtitle={selected?.user?.fullName}
        width="lg"
      >
        {selected && (
          <>
            <AdminDrawerSection title="Report">
              <p className="text-sm text-gray-700 leading-relaxed">{selected.description}</p>
              <AdminDrawerRow label="Status" value={<AdminStatusBadge status={selected.status} label={STATUS_LABELS[selected.status]} />} />
              <AdminDrawerRow label="Submitted" value={new Date(selected.createdAt).toLocaleString()} />
              {selected.user && (
                <>
                  <AdminDrawerRow label="Reporter" value={selected.user.fullName} />
                  <AdminDrawerRow label="Contact" value={selected.user.user.email} />
                </>
              )}
            </AdminDrawerSection>

            {selected.trip && (
              <AdminDrawerSection title="Linked trip">
                <AdminDrawerRow label="Date" value={new Date(selected.trip.scheduledDate).toLocaleDateString()} />
                <AdminDrawerRow label="Pickup" value={selected.trip.pickupLocation} />
                {selected.trip.rider && <AdminDrawerRow label="Rider" value={selected.trip.rider.name} />}
                {selected.trip.driver?.profile && <AdminDrawerRow label="Driver" value={selected.trip.driver.profile.fullName} />}
              </AdminDrawerSection>
            )}

            {selected.attachments.length > 0 && (
              <AdminDrawerSection title="Evidence">
                <div className="flex flex-wrap gap-2">
                  {selected.attachments.map((a, i) => (
                    <a key={a.id} href={a.filePath} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1 min-h-[44px]">
                      <Paperclip className="h-3 w-3" aria-hidden /> Attachment {i + 1}
                    </a>
                  ))}
                </div>
              </AdminDrawerSection>
            )}

            {selected.adminResponse && (
              <AdminDrawerSection title="Admin response">
                <p className="text-sm text-blue-800">{selected.adminResponse}</p>
                {selected.reviewer && <p className="text-xs text-gray-500 mt-1">By {selected.reviewer.fullName}</p>}
              </AdminDrawerSection>
            )}

            {selected.status !== 'RESOLVED' && (
              <AdminDrawerSection title="Review">
                <div className="flex flex-wrap gap-2 mb-3">
                  {(['APPROVE', 'REJECT', 'RESOLVE'] as const).map((a) => (
                    <Button
                      key={a}
                      size="sm"
                      variant={reviewAction === a ? (a === 'APPROVE' ? 'primary' : a === 'REJECT' ? 'danger' : 'outline') : 'ghost'}
                      onClick={() => setReviewAction(a)}
                      className="min-h-[44px]"
                    >
                      {a === 'APPROVE' ? 'Approve' : a === 'REJECT' ? 'Reject' : 'Resolve'}
                    </Button>
                  ))}
                </div>
                <Textarea
                  rows={3}
                  placeholder={reviewAction === 'APPROVE' ? 'Optional response…' : 'Response required for Reject/Resolve…'}
                  value={reviewResponse}
                  onChange={(e) => setReviewResponse(e.target.value)}
                />
                {reviewMsg && <Alert variant={reviewMsg.type} className="mt-2">{reviewMsg.text}</Alert>}
                <Button variant="primary" size="sm" loading={reviewSubmitting} disabled={!reviewAction} onClick={() => submitReview(selected.id)} className="mt-3 min-h-[44px]">
                  Submit review
                </Button>
              </AdminDrawerSection>
            )}
          </>
        )}
      </AdminDrawer>
    </div>
  );
}
