'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, TicketPercent } from 'lucide-react';
import { adminPromoService } from '@/services/adminService';
import { Alert, Button, Input, Textarea } from '@/components/ui';
import {
  AdminSectionHeader,
  AdminToolbar,
  AdminMetricGrid,
  AdminTable,
  AdminStatusBadge,
  AdminEmptyState,
  AdminSectionLoading,
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
  AdminDataCard,
  AdminMetaItem,
  AdminFilterSelect,
} from '@/components/admin/AdminUI';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { downloadCsv } from '@/lib/ui/adminExport';
import { formatSar } from '@/lib/ui/adminCurrency';
import {
  clientPaginationMeta,
  DEFAULT_ADMIN_PAGE_LIMIT,
  paginateClientList,
} from '@/lib/ui/adminPagination';
import {
  averageOrderAfterDiscount,
  computePromoKpis,
  decodePromoNotes,
  encodePromoNotes,
  filterPromoCodes,
  getPromoCodeStatus,
  normalizePromoCodeInput,
  promoCodesToCsv,
  remainingPromoUses,
  sortPromoCodes,
  validatePromoForm,
  type PromoCodeSummary,
  type PromoFormInput,
  type PromoSortKey,
  type PromoStatusFilter,
} from '@/lib/promo/promoAdminHelpers';

type PromoCode = PromoCodeSummary & {
  _count?: { redemptions: number };
};

type Redemption = {
  id: string;
  subtotalSar: string | number;
  discountSar: string | number;
  finalSar: string | number;
  createdAt: string;
  paymentId: string | null;
  user: { fullName: string; user: { email: string } };
  subscription: { id: string; package: { name: string } | null } | null;
};

type PromoDetail = PromoCode & {
  redemptions: Redemption[];
};

const EMPTY_FORM: PromoFormInput = {
  code: '',
  discountPercent: '10',
  partnerName: '',
  campaignName: '',
  maxUses: '',
  expiresAt: '',
  isActive: true,
  notes: '',
};

const STATUS_OPTIONS: { value: PromoStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'exhausted', label: 'Exhausted' },
];

const SORT_OPTIONS: { value: PromoSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_used', label: 'Most used' },
  { value: 'highest_revenue', label: 'Highest revenue' },
];

function statusBadge(status: ReturnType<typeof getPromoCodeStatus>) {
  switch (status) {
    case 'active':
      return <AdminStatusBadge status="ACTIVE" />;
    case 'expired':
      return <AdminStatusBadge status="EXPIRED" />;
    case 'disabled':
      return <AdminStatusBadge status="INACTIVE" />;
    case 'exhausted':
      return <AdminStatusBadge status="WARNING" label="Exhausted" />;
  }
}

function PromoCodeChip({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1 font-mono text-sm font-bold text-emerald-800 tracking-wide">
      {code}
    </span>
  );
}

function UsageCell({ row }: { row: PromoCode }) {
  const rem = remainingPromoUses(row);
  const maxLabel = row.maxUses != null ? row.maxUses : null;
  const pct = maxLabel != null && maxLabel > 0
    ? Math.min(100, Math.round((row.useCount / maxLabel) * 100))
    : null;

  return (
    <div className="min-w-[7rem]">
      <p className="font-medium text-gray-900 tabular-nums">
        {row.useCount}
        {maxLabel != null ? ` / ${maxLabel}` : ' / ∞'}
      </p>
      {rem != null && (
        <p className="text-xs text-gray-500 mt-0.5">{rem} remaining</p>
      )}
      {pct != null && (
        <div className="mt-1.5 h-1.5 w-full max-w-[6rem] rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${pct >= 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function RevenueCell({ row }: { row: PromoCode }) {
  return (
    <div className="space-y-1 text-sm min-w-[8rem]">
      <p>
        <span className="text-gray-400 text-xs block">Discount</span>
        <span className="font-medium text-red-700 tabular-nums">{formatSar(Number(row.totalDiscountSar))}</span>
      </p>
      <p>
        <span className="text-gray-400 text-xs block">Paid</span>
        <span className="font-medium text-emerald-700 tabular-nums">{formatSar(Number(row.totalPaidSar))}</span>
      </p>
    </div>
  );
}

function toDatetimeLocalValue(iso: string | Date | null): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PromoCodesSection() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PromoStatusFilter>('all');
  const [sortKey, setSortKey] = useState<PromoSortKey>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_ADMIN_PAGE_LIMIT);
  const [redemptionPage, setRedemptionPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PromoFormInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PromoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminPromoService.list().then((res) => {
      if (res.error) setError(res.error.message);
      else setCodes((res.data as PromoCode[]) ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortKey]);

  useEffect(() => {
    setRedemptionPage(1);
  }, [detail?.id]);

  const filtered = useMemo(
    () => sortPromoCodes(filterPromoCodes(codes, search, statusFilter), sortKey),
    [codes, search, statusFilter, sortKey],
  );

  const pageMeta = useMemo(
    () => clientPaginationMeta(filtered.length, page, limit),
    [filtered.length, page, limit],
  );

  const pagedRows = useMemo(
    () => paginateClientList(filtered, pageMeta.page, limit),
    [filtered, pageMeta.page, limit],
  );

  const redemptionMeta = useMemo(
    () => clientPaginationMeta(detail?.redemptions.length ?? 0, redemptionPage, DEFAULT_ADMIN_PAGE_LIMIT),
    [detail?.redemptions.length, redemptionPage],
  );

  const pagedRedemptions = useMemo(
    () => paginateClientList(detail?.redemptions ?? [], redemptionMeta.page, DEFAULT_ADMIN_PAGE_LIMIT),
    [detail?.redemptions, redemptionMeta.page],
  );

  const kpis = useMemo(() => computePromoKpis(codes), [codes]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError('');
  };

  const openEdit = (code: PromoCode) => {
    const { campaignName, notes } = decodePromoNotes(code.notes);
    setEditingId(code.id);
    setForm({
      code: code.code,
      discountPercent: String(code.discountPercent),
      partnerName: code.partnerName ?? '',
      campaignName: campaignName ?? '',
      maxUses: code.maxUses != null ? String(code.maxUses) : '',
      expiresAt: toDatetimeLocalValue(code.expiresAt),
      isActive: code.isActive,
      notes: notes ?? '',
    });
    setFormOpen(true);
    setError('');
  };

  const openDetails = async (code: PromoCode) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    const res = await adminPromoService.get(code.id);
    if (res.data) setDetail(res.data as PromoDetail);
    else setError(res.error?.message ?? 'Could not load promo details');
    setDetailLoading(false);
  };

  const handleSave = async () => {
    const validationError = validatePromoForm(form, codes, editingId);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    const payload = {
      code: normalizePromoCodeInput(form.code),
      partnerName: form.partnerName.trim() || null,
      discountPercent: Number(form.discountPercent),
      maxUses: form.maxUses.trim() ? Number(form.maxUses) : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      notes: encodePromoNotes(form.campaignName, form.notes),
      isActive: form.isActive,
    };

    const res = editingId
      ? await adminPromoService.update(editingId, payload)
      : await adminPromoService.create(payload);

    setSaving(false);
    if (res.error) setError(res.error.message);
    else {
      setMsg(editingId ? 'Promo code updated' : 'Promo code created');
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      load();
    }
  };

  const toggleActive = async (code: PromoCode) => {
    await adminPromoService.update(code.id, { isActive: !code.isActive });
    load();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setMsg(`Copied ${code}`);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  const exportCsv = () => {
    downloadCsv('fizza-promo-codes.csv', promoCodesToCsv(filtered));
  };

  if (loading) return <AdminSectionLoading message="Loading promo codes…" />;

  return (
    <div className="space-y-6 min-w-0">
      <AdminSectionHeader
        title="Promo Codes"
        subtitle="Create and track discount codes for campaigns, influencers, and marketing partners."
        count={codes.length}
        countLabel="codes"
        primaryAction={
          <Button variant="primary" size="sm" onClick={openCreate} className="min-h-[44px]">
            Create Promo Code
          </Button>
        }
        secondaryAction={
          <Button variant="outline" size="sm" onClick={exportCsv} className="min-h-[44px] gap-2">
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        }
      />

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}
      {msg && <Alert variant="success" onClose={() => setMsg('')}>{msg}</Alert>}

      <AdminMetricGrid
        columns={5}
        items={[
          { label: 'Active codes', value: kpis.active, icon: TicketPercent, color: '#059669' },
          { label: 'Total redemptions', value: kpis.totalRedemptions, color: '#6366F1' },
          { label: 'Total discount given', value: formatSar(kpis.totalDiscount), color: '#DC2626' },
          { label: 'Total paid after discount', value: formatSar(kpis.totalPaid), color: '#059669' },
          { label: 'Expiring soon', value: kpis.expiringSoon, helper: 'Within 7 days', color: '#D97706' },
        ]}
      />

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code or partner…"
        filters={[
          {
            id: 'promo-status',
            label: 'Status',
            element: (
              <AdminFilterSelect
                id="promo-status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as PromoStatusFilter)}
                options={STATUS_OPTIONS}
              />
            ),
          },
          {
            id: 'promo-sort',
            label: 'Sort',
            element: (
              <AdminFilterSelect
                id="promo-sort"
                value={sortKey}
                onChange={(v) => setSortKey(v as PromoSortKey)}
                options={SORT_OPTIONS}
              />
            ),
          },
        ]}
      />

      {filtered.length > 0 && (
        <p className="text-xs text-gray-500 -mt-2 mb-1">
          {filtered.length === codes.length
            ? `${filtered.length} promo code${filtered.length === 1 ? '' : 's'}`
            : `${filtered.length} of ${codes.length} codes match your filters`}
        </p>
      )}

      {filtered.length === 0 ? (
        <AdminEmptyState
          icon={TicketPercent}
          title="No promo codes found"
          description="Create a code for influencers or marketing campaigns."
          action={<Button variant="primary" onClick={openCreate}>Create Promo Code</Button>}
        />
      ) : (
        <>
        <AdminTable
          columns={[
            {
              key: 'code',
              header: 'Code',
              className: 'min-w-[9rem]',
              cell: (r) => (
                <div className="flex items-center gap-2">
                  <PromoCodeChip code={r.code} />
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700">
                    {r.discountPercent}% off
                  </span>
                </div>
              ),
            },
            {
              key: 'partner',
              header: 'Campaign',
              className: 'min-w-[10rem]',
              cell: (r) => {
                const { campaignName } = decodePromoNotes(r.notes);
                const partner = r.partnerName ?? campaignName ?? '—';
                return (
                  <div>
                    <p className="font-medium text-gray-900">{partner}</p>
                    {r.partnerName && campaignName && (
                      <p className="text-xs text-gray-500 mt-0.5">{campaignName}</p>
                    )}
                  </div>
                );
              },
            },
            { key: 'status', header: 'Status', cell: (r) => statusBadge(getPromoCodeStatus(r)) },
            {
              key: 'uses',
              header: 'Usage',
              cell: (r) => <UsageCell row={r} />,
            },
            {
              key: 'revenue',
              header: 'Revenue impact',
              cell: (r) => <RevenueCell row={r} />,
            },
            {
              key: 'expiry',
              header: 'Expiry',
              cell: (r) =>
                r.expiresAt
                  ? new Date(r.expiresAt).toLocaleDateString('en-SA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Never',
            },
            {
              key: 'created',
              header: 'Created',
              cell: (r) => new Date(r.createdAt).toLocaleDateString('en-SA'),
            },
          ]}
          rows={pagedRows}
          onRowClick={(r) => void openDetails(r)}
          rowActions={(r) => (
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(r)} className="min-h-[44px]">Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => toggleActive(r)} className="min-h-[44px]">
                {r.isActive ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void copyCode(r.code)} className="min-h-[44px] gap-1">
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void openDetails(r)} className="min-h-[44px]">Details</Button>
            </div>
          )}
          mobileCard={(r) => {
            const { campaignName } = decodePromoNotes(r.notes);
            const rem = remainingPromoUses(r);
            return (
              <AdminDataCard
                title={r.code}
                subtitle={r.partnerName ?? campaignName ?? undefined}
                badges={
                  <>
                    {statusBadge(getPromoCodeStatus(r))}
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                      {r.discountPercent}% off
                    </span>
                  </>
                }
                metadata={
                  <>
                    <AdminMetaItem
                      label="Uses"
                      value={`${r.useCount}${r.maxUses != null ? ` / ${r.maxUses}` : ' / ∞'}`}
                    />
                    <AdminMetaItem label="Remaining" value={rem != null ? rem : '∞'} />
                    <AdminMetaItem label="Discount given" value={formatSar(Number(r.totalDiscountSar))} />
                    <AdminMetaItem label="Paid" value={formatSar(Number(r.totalPaidSar))} />
                    <AdminMetaItem
                      label="Expiry"
                      value={r.expiresAt ? new Date(r.expiresAt).toLocaleDateString('en-SA') : 'Never'}
                    />
                  </>
                }
                actions={
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(r)}>
                      {r.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void copyCode(r.code)}>Copy</Button>
                    <Button variant="ghost" size="sm" onClick={() => void openDetails(r)}>Details</Button>
                  </div>
                }
                onClick={() => void openDetails(r)}
                compact
              />
            );
          }}
        />

        <AdminPagination
          meta={pageMeta}
          onPageChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          className="mt-5"
        />
        </>
      )}

      <AdminDrawer
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingId(null); }}
        title={editingId ? 'Edit promo code' : 'Create promo code'}
        subtitle="Percentage discounts apply to subscription checkout totals."
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setFormOpen(false)} className="min-h-[44px]">Cancel</Button>
            <Button variant="primary" loading={saving} onClick={() => void handleSave()} className="min-h-[44px]">
              {editingId ? 'Save changes' : 'Create code'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Code"
            placeholder="TEST10"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
          />
          <Input
            label="Percentage discount"
            type="number"
            min={1}
            max={100}
            value={form.discountPercent}
            onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))}
          />
          <Input
            label="Partner / influencer name"
            placeholder="Name for reporting"
            value={form.partnerName}
            onChange={(e) => setForm((p) => ({ ...p, partnerName: e.target.value }))}
          />
          <Input
            label="Campaign name (optional)"
            placeholder="Spring 2026 launch"
            value={form.campaignName}
            onChange={(e) => setForm((p) => ({ ...p, campaignName: e.target.value }))}
          />
          <Input
            label="Max uses"
            type="number"
            min={1}
            placeholder="Unlimited if empty"
            value={form.maxUses}
            onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
          />
          <Input
            label="Expiry date"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[44px]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="rounded accent-emerald-600"
            />
            Active
          </label>
          <Textarea
            label="Notes (optional)"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>
      </AdminDrawer>

      <AdminDrawer
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetail(null); }}
        title={detail?.code ?? 'Promo code details'}
        subtitle={detail?.partnerName ?? undefined}
        width="lg"
      >
        {detailLoading ? (
          <AdminSectionLoading message="Loading redemptions…" />
        ) : detail ? (
          <>
            <AdminDrawerSection title="Campaign summary">
              <AdminDrawerRow label="Status" value={statusBadge(getPromoCodeStatus(detail))} />
              <AdminDrawerRow label="Discount" value={`${detail.discountPercent}%`} />
              <AdminDrawerRow
                label="Campaign"
                value={decodePromoNotes(detail.notes).campaignName ?? '—'}
              />
              <AdminDrawerRow label="Uses" value={`${detail.useCount}${detail.maxUses != null ? ` / ${detail.maxUses}` : ' / ∞'}`} />
              <AdminDrawerRow label="Total discount" value={formatSar(Number(detail.totalDiscountSar))} />
              <AdminDrawerRow label="Total paid after discount" value={formatSar(Number(detail.totalPaidSar))} />
              <AdminDrawerRow
                label="Average order after discount"
                value={formatSar(averageOrderAfterDiscount(detail))}
              />
            </AdminDrawerSection>

            <AdminDrawerSection title="Redemptions">
              {detail.redemptions.length === 0 ? (
                <p className="text-sm text-gray-500">No redemptions yet.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {pagedRedemptions.map((r) => (
                      <div key={r.id} className="rounded-lg border border-gray-100 bg-white p-3 text-sm">
                        <p className="font-medium text-gray-900">{r.user.fullName}</p>
                        <p className="text-xs text-gray-500">{r.user.user.email}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <div><span className="text-gray-400">Subscription</span><br />{r.subscription?.package?.name ?? r.subscription?.id ?? '—'}</div>
                          <div><span className="text-gray-400">Redeemed</span><br />{new Date(r.createdAt).toLocaleString('en-SA')}</div>
                          <div><span className="text-gray-400">Original</span><br />{formatSar(Number(r.subtotalSar))}</div>
                          <div><span className="text-gray-400">Discount</span><br />{formatSar(Number(r.discountSar))}</div>
                          <div><span className="text-gray-400">Paid</span><br />{formatSar(Number(r.finalSar))}</div>
                          <div><span className="text-gray-400">Payment ID</span><br />{r.paymentId ?? '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {detail.redemptions.length > DEFAULT_ADMIN_PAGE_LIMIT && (
                    <AdminPagination
                      meta={redemptionMeta}
                      onPageChange={setRedemptionPage}
                      className="mt-4"
                      alwaysShow={false}
                    />
                  )}
                </>
              )}
            </AdminDrawerSection>
          </>
        ) : (
          <p className="text-sm text-gray-500">Could not load details.</p>
        )}
      </AdminDrawer>
    </div>
  );
}
