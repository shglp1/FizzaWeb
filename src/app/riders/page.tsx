'use client';

import { ClipboardList, Heart, UserCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { AppShell } from '@/components/layout/AppShell';
import {
  ParentPageHeader,
  ParentKpiGrid,
  ParentKpiCard,
  ParentRiderCard,
  ParentDrawer,
  ParentEmptyState,
  ParentLoadingState,
  ParentErrorState,
} from '@/components/parent/ParentUI';
import { Button, Input, Textarea, Alert, ConfirmDialog } from '@/components/ui';
import { riderService } from '@/services/riderService';
import { emergencyContactComplete, hasSpecialNeedsIndicator } from '@/lib/riders/riderExposure';
import type { RiderRecord } from '@/lib/riders/riderExposure';

// ─── Types ────────────────────────────────────────────────────────────────────

type Rider = RiderRecord & { isActive: boolean };

type FormValues = {
  name: string;
  relationship: string;
  school: string;
  grade: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  specialNeeds: boolean;
  specialNeedsNotes: string;
  medicalNotes: string;
  allergies: string;
  pickupNotes: string;
  dropoffNotes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  authorizedPickupPersons: string;
  preferredLanguage: '' | 'ar' | 'en';
  avatarUrl: string;
  notes: string;
};

const EMPTY_FORM: FormValues = {
  name: '',
  relationship: '',
  school: '',
  grade: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  specialNeeds: false,
  specialNeedsNotes: '',
  medicalNotes: '',
  allergies: '',
  pickupNotes: '',
  dropoffNotes: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  authorizedPickupPersons: '',
  preferredLanguage: '',
  avatarUrl: '',
  notes: '',
};

function riderToForm(rider: Rider): FormValues {
  const dob = rider.dateOfBirth
    ? new Date(rider.dateOfBirth).toISOString().slice(0, 10)
    : '';
  return {
    name: rider.name,
    relationship: rider.relationship ?? '',
    school: rider.school ?? '',
    grade: rider.grade ?? '',
    phone: rider.phone ?? '',
    dateOfBirth: dob,
    gender: rider.gender ?? '',
    specialNeeds: Boolean(rider.specialNeeds),
    specialNeedsNotes: rider.specialNeedsNotes ?? '',
    medicalNotes: rider.medicalNotes ?? '',
    allergies: rider.allergies ?? '',
    pickupNotes: rider.pickupNotes ?? '',
    dropoffNotes: rider.dropoffNotes ?? '',
    emergencyContactName: rider.emergencyContactName ?? '',
    emergencyContactPhone: rider.emergencyContactPhone ?? '',
    authorizedPickupPersons: rider.authorizedPickupPersons ?? '',
    preferredLanguage: (rider.preferredLanguage as '' | 'ar' | 'en') ?? '',
    avatarUrl: rider.avatarUrl ?? '',
    notes: rider.notes ?? '',
  };
}

function formToPayload(values: FormValues): Record<string, unknown> {
  return {
    name: values.name,
    relationship: values.relationship,
    school: values.school || undefined,
    grade: values.grade || undefined,
    phone: values.phone || undefined,
    dateOfBirth: values.dateOfBirth || null,
    gender: values.gender || undefined,
    specialNeeds: values.specialNeeds,
    specialNeedsNotes: values.specialNeedsNotes || undefined,
    medicalNotes: values.medicalNotes || undefined,
    allergies: values.allergies || undefined,
    pickupNotes: values.pickupNotes || undefined,
    dropoffNotes: values.dropoffNotes || undefined,
    emergencyContactName: values.emergencyContactName || undefined,
    emergencyContactPhone: values.emergencyContactPhone || undefined,
    authorizedPickupPersons: values.authorizedPickupPersons || undefined,
    preferredLanguage: values.preferredLanguage || null,
    avatarUrl: values.avatarUrl || null,
    notes: values.notes || undefined,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<Rider | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>();
  const specialNeedsChecked = watch('specialNeeds');

  const loadRiders = () => {
    setLoading(true);
    riderService.list().then((res) => {
      if (res.data) setRiders(res.data);
      else setPageError(res.error?.message ?? 'Failed to load riders.');
      setLoading(false);
    });
  };

  useEffect(() => { loadRiders(); }, []);

  const kpis = useMemo(() => {
    const active = riders.filter((r) => r.isActive).length;
    const specialNeeds = riders.filter((r) => hasSpecialNeedsIndicator(r)).length;
    return { total: riders.length, active, specialNeeds, withSubscription: 0 };
  }, [riders]);

  const openAdd = () => {
    setEditingRider(null);
    reset(EMPTY_FORM);
    setActionError('');
    setDrawerOpen(true);
  };

  const openEdit = (rider: Rider) => {
    setEditingRider(rider);
    reset(riderToForm(rider));
    setActionError('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingRider(null);
    setActionError('');
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const payload = formToPayload(values);
      const res = editingRider
        ? await riderService.update(editingRider.id, payload)
        : await riderService.create(payload);
      if (res.data) {
        setActionSuccess(editingRider ? 'Rider updated.' : 'Rider added.');
        closeDrawer();
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
      <ParentPageHeader
        title="Family Riders"
        subtitle="Manage profiles, emergency contacts, and transport notes"
        action={
          <Button variant="primary" size="sm" onClick={openAdd}>
            Add Rider
          </Button>
        }
      />

      {actionSuccess && (
        <Alert variant="success" className="mb-4" onClose={() => setActionSuccess('')}>
          {actionSuccess}
        </Alert>
      )}
      {actionError && !drawerOpen && (
        <Alert variant="error" className="mb-4" onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {!loading && !pageError && riders.length > 0 && (
        <div className="mb-6">
          <ParentKpiGrid columns={4}>
            <ParentKpiCard label="Total riders" value={kpis.total} icon={Users} />
            <ParentKpiCard label="Active" value={kpis.active} icon={UserCheck} color="#059669" />
            <ParentKpiCard label="Special needs" value={kpis.specialNeeds} icon={Heart} color="#7C3AED" />
            <ParentKpiCard label="With subscription" value={kpis.withSubscription} icon={ClipboardList} color="#6366F1" helper="Active plans" />
          </ParentKpiGrid>
        </div>
      )}

      {loading ? (
        <ParentLoadingState message="Loading riders…" />
      ) : pageError ? (
        <ParentErrorState message={pageError} onRetry={loadRiders} />
      ) : riders.length === 0 ? (
        <ParentEmptyState
          icon={Users}
          title="No riders yet"
          description="Add your family members to start scheduling trips."
          action={<Button variant="primary" size="sm" onClick={openAdd}>Add First Rider</Button>}
        />
      ) : (
        <div className="space-y-3">
          {riders.map((rider) => (
            <ParentRiderCard
              key={rider.id}
              name={rider.name}
              relationship={rider.relationship}
              school={rider.school}
              grade={rider.grade}
              phone={rider.phone}
              avatarUrl={rider.avatarUrl}
              specialNeeds={hasSpecialNeedsIndicator(rider)}
              emergencyComplete={emergencyContactComplete(rider)}
              activeSubscriptions={0}
              upcomingTrips={0}
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={() => openEdit(rider)}>Edit</Button>
                  <Button
                    variant={rider.isActive ? 'danger-outline' : 'ghost'}
                    size="sm"
                    onClick={() => setConfirmToggle(rider)}
                  >
                    {rider.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}

      <ParentDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingRider ? 'Edit Rider' : 'Add Rider'}
        footer={
          <div className="flex gap-2">
            <Button type="submit" form="rider-form" variant="primary" loading={submitting} className="flex-1">
              {editingRider ? 'Update Rider' : 'Add Rider'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeDrawer}>Cancel</Button>
          </div>
        }
      >
        {actionError && (
          <Alert variant="error" className="mb-4" onClose={() => setActionError('')}>
            {actionError}
          </Alert>
        )}

        <form id="rider-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Basic information</legend>
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
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date of birth" type="date" {...register('dateOfBirth')} />
              <Input label="Gender" placeholder="Male, Female, etc." {...register('gender')} />
            </div>
            <Input label="Phone" type="tel" placeholder="+966 5X XXX XXXX" {...register('phone')} />
            <Input label="Avatar URL" type="url" placeholder="https://…" {...register('avatarUrl')} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">School</legend>
            <Input label="School" placeholder="School name" {...register('school')} />
            <Input label="Grade" placeholder="e.g. 5" {...register('grade')} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Special needs and health</legend>
            <label className="flex items-start gap-3 px-3 py-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 mt-0.5 accent-fizza-secondary" {...register('specialNeeds')} />
              <div>
                <span className="text-sm font-medium text-gray-700">Has special needs</span>
                <p className="text-xs text-gray-400">Requires additional support during transport</p>
              </div>
            </label>
            {specialNeedsChecked && (
              <Textarea label="Special needs notes" rows={2} placeholder="Describe support requirements…" {...register('specialNeedsNotes')} />
            )}
            <Textarea label="Medical notes" rows={2} placeholder="Conditions the driver should know about…" {...register('medicalNotes')} />
            <Textarea label="Allergies" rows={2} placeholder="Food, medication, or environmental allergies…" {...register('allergies')} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Transport notes</legend>
            <Textarea label="Pickup notes" rows={2} placeholder="Gate, building, waiting spot…" {...register('pickupNotes')} />
            <Textarea label="Drop-off notes" rows={2} placeholder="Entrance, classroom, handoff instructions…" {...register('dropoffNotes')} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Emergency contact</legend>
            <Input label="Contact name" placeholder="Parent or guardian name" {...register('emergencyContactName')} />
            <Input label="Contact phone" type="tel" placeholder="+966 5X XXX XXXX" {...register('emergencyContactPhone')} />
            <Textarea label="Authorized pickup persons" rows={2} placeholder="Names of people allowed to receive the rider…" {...register('authorizedPickupPersons')} />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Other</legend>
            <div>
              <label htmlFor="preferredLanguage" className="block text-sm font-medium text-gray-700 mb-1">Preferred language</label>
              <select
                id="preferredLanguage"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 bg-white"
                {...register('preferredLanguage')}
              >
                <option value="">No preference</option>
                <option value="ar">Arabic</option>
                <option value="en">English</option>
              </select>
            </div>
            <Textarea label="General notes" rows={3} placeholder="Any additional information for the driver…" {...register('notes')} />
          </fieldset>
        </form>
      </ParentDrawer>

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
