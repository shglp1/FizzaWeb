'use client';

import { FileText, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { driverApplicationService } from '@/services/driverApplicationService';
import { Button, Alert, Textarea, ErrorState } from '@/components/ui';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';
import { listDriverApplicationDocuments, isImageUrl } from '@/lib/driver/driverApplicationDocs';
import {
  AdminSectionHeader,
  AdminTabs,
  AdminMetricGrid,
  AdminDataCard,
  AdminMetaItem,
  AdminStatusBadge,
  AdminEmptyState,
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
  AdminSectionLoading,
} from '@/components/admin/AdminUI';

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
  driverLicenseUrl?: string | null;
  vehicleRegistrationUrl?: string | null;
  nationalIdUrl?: string | null;
  vehicleInsuranceUrl?: string | null;
  vehiclePhotoUrl?: string | null;
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

const APP_TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Needs Changes', value: 'NEEDS_CHANGES' },
];

const STATUS_LABELS: Record<AppStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  NEEDS_CHANGES: 'Needs changes',
};

export function ApplicationsSection() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [selected, setSelected] = useState<Application | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'NEEDS_CHANGES' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadApplications = useCallback((status: string, p: number, l: number) => {
    setLoading(true);
    setPageError('');
    driverApplicationService.adminList(status || undefined, p, l).then((res) => {
      if (res.data) {
        setApplications(res.data.applications ?? []);
        setMeta(res.data.meta ?? null);
      } else {
        setPageError(res.error?.message ?? 'Failed to load applications.');
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadApplications(activeTab, page, limit); }, [activeTab, page, limit, loadApplications]);

  useEffect(() => {
    Promise.all(
      ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES'].map((s) =>
        driverApplicationService.adminList(s, 1).then((res) => ({
          status: s,
          total: (res.data?.meta as PaginationMeta | undefined)?.total ?? 0,
        })),
      ),
    ).then((results) => {
      const map: Record<string, number> = {};
      results.forEach((r) => { map[r.status] = r.total; });
      setCounts(map);
    });
  }, []);

  const submitReview = async (appId: string) => {
    if (!reviewAction) return;
    if (reviewAction !== 'APPROVE' && !reasonText.trim()) {
      setReviewMsg({ text: 'A reason is required for this action.', type: 'error' });
      return;
    }
    setReviewSubmitting(true);
    setReviewMsg(null);
    try {
      const res = await driverApplicationService.adminReview(
        appId,
        reviewAction,
        reviewAction !== 'APPROVE' ? reasonText.trim() : undefined,
      );
      if (res.data?.application) {
        setReviewMsg({ text: `Application ${reviewAction.toLowerCase().replace('_', ' ')} successfully.`, type: 'success' });
        setSelected(null);
        setReviewAction(null);
        loadApplications(activeTab, page, limit);
      } else {
        setReviewMsg({ text: res.error?.message ?? 'Action failed.', type: 'error' });
      }
    } catch {
      setReviewMsg({ text: 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const tabsWithCounts = APP_TABS.map((t) => ({
    ...t,
    count: t.value ? counts[t.value] : meta?.total,
  }));

  return (
    <div>
      <AdminSectionHeader
        title="Driver Applications"
        subtitle="Review queue for new driver onboarding"
        count={meta?.total}
        countLabel="applications"
      />

      <AdminMetricGrid
        columns={4}
        items={[
          { label: 'Pending', value: counts.PENDING ?? '—', icon: FileText, color: '#D97706', onClick: () => { setActiveTab('PENDING'); setPage(1); }, active: activeTab === 'PENDING' },
          { label: 'Approved', value: counts.APPROVED ?? '—', icon: CheckCircle, color: '#059669', onClick: () => { setActiveTab('APPROVED'); setPage(1); }, active: activeTab === 'APPROVED' },
          { label: 'Rejected', value: counts.REJECTED ?? '—', icon: XCircle, color: '#DC2626', onClick: () => { setActiveTab('REJECTED'); setPage(1); }, active: activeTab === 'REJECTED' },
          { label: 'Needs Changes', value: counts.NEEDS_CHANGES ?? '—', icon: AlertCircle, color: '#EA580C', onClick: () => { setActiveTab('NEEDS_CHANGES'); setPage(1); }, active: activeTab === 'NEEDS_CHANGES' },
        ]}
      />

      <AdminTabs
        tabs={tabsWithCounts}
        active={activeTab}
        onChange={(v) => { setActiveTab(v); setPage(1); }}
      />

      {reviewMsg && !selected && (
        <Alert variant={reviewMsg.type} className="mb-4" onClose={() => setReviewMsg(null)}>{reviewMsg.text}</Alert>
      )}

      {loading ? (
        <AdminSectionLoading message="Loading applications…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => loadApplications(activeTab, page, limit)} />
      ) : applications.length === 0 ? (
        <AdminEmptyState icon={FileText} title="No applications found" description="No driver applications match this filter." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {applications.map((app) => (
            <AdminDataCard
              key={app.id}
              title={app.applicant.fullName}
              subtitle={app.applicant.user.email}
              badges={<AdminStatusBadge status={app.status} label={STATUS_LABELS[app.status]} />}
              onClick={() => { setSelected(app); setReviewAction(null); setReasonText(''); setReviewMsg(null); }}
              metadata={
                <>
                  <AdminMetaItem label="Vehicle" value={`${app.vehicleBrand} ${app.vehicleModel}`} />
                  <AdminMetaItem label="Plate" value={app.plateNumber} />
                  <AdminMetaItem label="City" value={app.city} />
                  <AdminMetaItem label="Submitted" value={new Date(app.submittedAt).toLocaleDateString()} />
                </>
              }
              compact
            >
              {app.femaleDriver && (
                <p className="text-xs text-fizza-secondary font-medium mt-1">Female driver preference</p>
              )}
            </AdminDataCard>
          ))}
        </div>
      )}

      {meta && (
        <AdminPagination
          meta={meta}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
          className="mt-5"
        />
      )}

      <AdminDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setReviewAction(null); }}
        title={selected?.applicant.fullName ?? 'Application'}
        subtitle={selected ? STATUS_LABELS[selected.status] : undefined}
        width="lg"
      >
        {selected && (
          <>
            <AdminDrawerSection title="Applicant">
              <AdminDrawerRow label="Email" value={selected.applicant.user.email} />
              <AdminDrawerRow label="Phone" value={selected.applicant.phone ?? '—'} />
            </AdminDrawerSection>

            <AdminDrawerSection title="Vehicle">
              <AdminDrawerRow label="Type" value={`${selected.vehicleCategory} · ${selected.vehicleType}`} />
              <AdminDrawerRow label="Vehicle" value={`${selected.vehicleBrand} ${selected.vehicleModel} (${selected.vehicleYear})`} />
              <AdminDrawerRow label="Plate" value={selected.plateNumber} />
              <AdminDrawerRow label="Color" value={selected.vehicleColor} />
              <AdminDrawerRow label="Capacity" value={`${selected.vehicleCapacity} seats`} />
              <AdminDrawerRow label="License" value={selected.licenseNumber} />
            </AdminDrawerSection>

            <AdminDrawerSection title="Documents">
              {listDriverApplicationDocuments(selected).length === 0 ? (
                <p className="text-sm text-gray-500">No documents uploaded.</p>
              ) : (
                <div className="space-y-3">
                  {listDriverApplicationDocuments(selected).map((doc) => (
                    <div key={doc.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-sm text-gray-600 w-40 shrink-0">{doc.label}</span>
                      {isImageUrl(doc.url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={doc.url} alt={doc.label} className="h-16 w-24 rounded-lg object-cover border border-gray-200" />
                      ) : null}
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
                      >
                        View file <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </AdminDrawerSection>

            <AdminDrawerSection title="Service area">
              <AdminDrawerRow label="City" value={selected.city} />
              <AdminDrawerRow label="Area" value={selected.serviceArea} />
              {selected.femaleDriver && <AdminDrawerRow label="Preference" value="Female driver" />}
            </AdminDrawerSection>

            {selected.driverNotes && (
              <AdminDrawerSection title="Applicant notes">
                <p className="text-sm text-gray-600 italic">{selected.driverNotes}</p>
              </AdminDrawerSection>
            )}

            {selected.adminResponse && (
              <AdminDrawerSection title="Previous admin note">
                <p className="text-sm text-orange-800">{selected.adminResponse}</p>
              </AdminDrawerSection>
            )}

            <AdminDrawerSection title="Timeline">
              <AdminDrawerRow label="Submitted" value={new Date(selected.submittedAt).toLocaleString()} />
              {selected.resubmittedAt && <AdminDrawerRow label="Resubmitted" value={new Date(selected.resubmittedAt).toLocaleString()} />}
              {selected.reviewer && <AdminDrawerRow label="Reviewed by" value={selected.reviewer.fullName} />}
            </AdminDrawerSection>

            {(selected.status === 'PENDING' || selected.status === 'NEEDS_CHANGES') && (
              <AdminDrawerSection title="Review actions">
                <div className="flex flex-wrap gap-2 mb-3">
                  {(['APPROVE', 'NEEDS_CHANGES', 'REJECT'] as const).map((action) => (
                    <Button
                      key={action}
                      size="sm"
                      variant={reviewAction === action ? 'primary' : action === 'REJECT' ? 'danger-outline' : 'outline'}
                      onClick={() => setReviewAction(reviewAction === action ? null : action)}
                      className="min-h-[44px]"
                    >
                      {action === 'APPROVE' ? 'Approve' : action === 'REJECT' ? 'Reject' : 'Request changes'}
                    </Button>
                  ))}
                </div>
                {reviewAction && reviewAction !== 'APPROVE' && (
                  <Textarea
                    rows={3}
                    placeholder={reviewAction === 'REJECT' ? 'Reason for rejection (required)…' : 'Describe changes needed (required)…'}
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                  />
                )}
                {reviewAction === 'APPROVE' && (
                  <Alert variant="info" className="mt-2">
                    Approving creates a Driver record and upgrades the user role.
                  </Alert>
                )}
                {reviewMsg && <Alert variant={reviewMsg.type} className="mt-2">{reviewMsg.text}</Alert>}
                {reviewAction && (
                  <Button variant="primary" size="sm" loading={reviewSubmitting} onClick={() => submitReview(selected.id)} className="mt-3 min-h-[44px]">
                    Confirm review
                  </Button>
                )}
              </AdminDrawerSection>
            )}
          </>
        )}
      </AdminDrawer>
    </div>
  );
}
