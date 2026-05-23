'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  Card,
  Input,
  Textarea,
  Button,
  Alert,
  Badge,
  LoadingState,
  ErrorState,
  ConfirmDialog,
  EmptyState,
} from '@/components/ui';
import { riderService } from '@/services/riderService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Rider = {
  id: string;
  name: string;
  relationship: string;
  school: string | null;
  grade: string | null;
  phone: string | null;
  specialNeeds: boolean;
  notes: string | null;
  isActive: boolean;
};

type FormValues = {
  name: string;
  relationship: string;
  school: string;
  grade: string;
  phone: string;
  specialNeeds: boolean;
  notes: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<Rider | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const loadRiders = () => {
    setLoading(true);
    riderService.list().then((res) => {
      if (res.data) setRiders(res.data);
      else setPageError(res.error?.message ?? 'Failed to load riders.');
      setLoading(false);
    });
  };

  useEffect(() => { loadRiders(); }, []);

  const openAdd = () => {
    setEditingRider(null);
    reset({ name: '', relationship: '', school: '', grade: '', phone: '', specialNeeds: false, notes: '' });
    setActionError('');
    setActionSuccess('');
    setShowForm(true);
  };

  const openEdit = (rider: Rider) => {
    setEditingRider(rider);
    reset({
      name: rider.name,
      relationship: rider.relationship,
      school: rider.school ?? '',
      grade: rider.grade ?? '',
      phone: rider.phone ?? '',
      specialNeeds: rider.specialNeeds,
      notes: rider.notes ?? '',
    });
    setActionError('');
    setActionSuccess('');
    setShowForm(true);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const payload = {
        name: values.name,
        relationship: values.relationship,
        school: values.school || undefined,
        grade: values.grade || undefined,
        phone: values.phone || undefined,
        specialNeeds: values.specialNeeds,
        notes: values.notes || undefined,
      };
      const res = editingRider
        ? await riderService.update(editingRider.id, payload)
        : await riderService.create(payload);
      if (res.data) {
        setActionSuccess(editingRider ? 'Rider updated.' : 'Rider added.');
        setShowForm(false);
        loadRiders();
      } else {
        setActionError(res.error?.message ?? 'Failed to save rider.');
      }
    } catch {
      setActionError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmToggleActive = async () => {
    if (!confirmToggle) return;
    const rider = confirmToggle;
    setConfirmToggle(null);
    try {
      const res = rider.isActive
        ? await riderService.deactivate(rider.id)
        : await riderService.reactivate(rider.id);
      if (res.data) {
        setActionSuccess(`${rider.name} ${rider.isActive ? 'deactivated' : 'reactivated'}.`);
        loadRiders();
      } else {
        setActionError(res.error?.message ?? 'Action failed.');
      }
    } catch {
      setActionError('Something went wrong.');
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Family Riders"
        subtitle={`${riders.length} rider${riders.length !== 1 ? 's' : ''} registered`}
        action={
          <Button variant="primary" size="sm" onClick={openAdd}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Rider
          </Button>
        }
      />

      {/* Action feedback */}
      {actionSuccess && (
        <Alert variant="success" className="mb-4" onClose={() => setActionSuccess('')}>
          {actionSuccess}
        </Alert>
      )}
      {actionError && (
        <Alert variant="error" className="mb-4" onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {/* Add / Edit form panel */}
      {showForm && (
        <Card className="mb-5 border-fizza-secondary/30 bg-emerald-50/30">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">
              {editingRider ? 'Edit Rider' : 'Add New Rider'}
            </h2>
            <button
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Full name"
              placeholder="e.g. Ahmad Al-Rashidi"
              required
              error={errors.name?.message}
              {...register('name', { required: 'Name is required' })}
            />
            <Input
              label="Relationship"
              placeholder="Son, Daughter, etc."
              required
              error={errors.relationship?.message}
              {...register('relationship', { required: 'Relationship is required' })}
            />
            <Input label="School" placeholder="School name" {...register('school')} />
            <Input label="Grade" placeholder="e.g. Grade 5" {...register('grade')} />
            <Input label="Phone" type="tel" placeholder="+966 5X XXX XXXX" {...register('phone')} />
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-gray-200 bg-white cursor-pointer"
              onClick={() => {
                const el = document.getElementById('specialNeeds') as HTMLInputElement;
                if (el) el.click();
              }}
            >
              <input
                id="specialNeeds"
                type="checkbox"
                className="w-4 h-4 accent-fizza-secondary"
                {...register('specialNeeds')}
              />
              <div>
                <label htmlFor="specialNeeds" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Has special needs
                </label>
                <p className="text-xs text-gray-400">Requires additional support</p>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Notes"
                placeholder="Any additional information for the driver…"
                rows={3}
                {...register('notes')}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" variant="primary" loading={submitting} className="flex-1 sm:flex-none">
                {editingRider ? 'Update Rider' : 'Add Rider'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Riders list */}
      {loading ? (
        <LoadingState message="Loading riders…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={loadRiders} />
      ) : riders.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No riders yet"
          description="Add your family members to start scheduling trips."
          action={{ label: 'Add First Rider', onClick: openAdd }}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {riders.map((rider) => (
            <Card key={rider.id} variant="interactive">
              <div className="flex items-start gap-3 mb-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${rider.isActive ? 'bg-emerald-100 text-fizza-primary' : 'bg-gray-100 text-gray-400'}`}>
                  {rider.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{rider.name}</p>
                  <p className="text-xs text-gray-500">{rider.relationship}</p>
                </div>
                <Badge variant={rider.isActive ? 'success' : 'gray'}>
                  {rider.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                {rider.school && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🏫</span>
                    <span className="truncate">{rider.school}{rider.grade ? ` · ${rider.grade}` : ''}</span>
                  </div>
                )}
                {rider.phone && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">📞</span>
                    <span>{rider.phone}</span>
                  </div>
                )}
                {rider.specialNeeds && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">♿</span>
                    <span className="text-amber-700 font-medium">Special needs</span>
                  </div>
                )}
                {rider.notes && (
                  <p className="text-gray-400 text-xs line-clamp-2 mt-1 italic">&ldquo;{rider.notes}&rdquo;</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEdit(rider)}
                >
                  Edit
                </Button>
                <Button
                  variant={rider.isActive ? 'danger-outline' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmToggle(rider)}
                >
                  {rider.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm toggle dialog */}
      <ConfirmDialog
        isOpen={!!confirmToggle}
        title={confirmToggle?.isActive ? 'Deactivate Rider?' : 'Reactivate Rider?'}
        message={
          confirmToggle?.isActive
            ? `${confirmToggle.name} won't be assigned to future trips until reactivated.`
            : `${confirmToggle?.name ?? 'This rider'} will be available for future trips again.`
        }
        confirmLabel={confirmToggle?.isActive ? 'Deactivate' : 'Reactivate'}
        confirmVariant={confirmToggle?.isActive ? 'danger' : 'primary'}
        onConfirm={confirmToggleActive}
        onCancel={() => setConfirmToggle(null)}
      />
    </AppShell>
  );
}
