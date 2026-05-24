/** Role-based rider field visibility for Parent, Driver, and Admin surfaces. */

export type RiderRecord = {
  id: string;
  name: string;
  relationship?: string | null;
  school?: string | null;
  grade?: string | null;
  phone?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  specialNeeds?: boolean;
  specialNeedsNotes?: string | null;
  medicalNotes?: string | null;
  allergies?: string | null;
  pickupNotes?: string | null;
  dropoffNotes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  authorizedPickupPersons?: string | null;
  preferredLanguage?: string | null;
  avatarUrl?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export function hasSpecialNeedsIndicator(rider: Pick<RiderRecord, 'specialNeeds'>): boolean {
  return Boolean(rider.specialNeeds);
}

export function riderForParentView(rider: RiderRecord): RiderRecord {
  return rider;
}

/** Operational subset for drivers — no full medical/allergy details. */
export function riderForDriverView(rider: RiderRecord): {
  name: string;
  school: string | null;
  grade: string | null;
  specialNeeds: boolean;
  pickupNotes: string | null;
  dropoffNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
} {
  return {
    name: rider.name,
    school: rider.school ?? null,
    grade: rider.grade ?? null,
    specialNeeds: Boolean(rider.specialNeeds),
    pickupNotes: rider.pickupNotes ?? null,
    dropoffNotes: rider.dropoffNotes ?? null,
    emergencyContactName: rider.emergencyContactName ?? null,
    emergencyContactPhone: rider.emergencyContactPhone ?? null,
  };
}

export function riderForAdminView(rider: RiderRecord): RiderRecord {
  return rider;
}

export function formatDriverRiderMeta(rider: Pick<RiderRecord, 'school' | 'grade' | 'specialNeeds'>): string {
  const parts: string[] = [];
  if (rider.school) parts.push(rider.school);
  if (rider.grade) parts.push(`Grade ${rider.grade}`);
  if (rider.specialNeeds) parts.push('Special needs');
  return parts.join(' · ') || 'Rider';
}

export function emergencyContactComplete(rider: Pick<RiderRecord, 'emergencyContactName' | 'emergencyContactPhone'>): boolean {
  return Boolean(rider.emergencyContactName?.trim() && rider.emergencyContactPhone?.trim());
}

export function riderProfileComplete(rider: RiderRecord): boolean {
  return Boolean(
    rider.name?.trim()
    && rider.relationship?.trim()
    && rider.school?.trim()
    && emergencyContactComplete(rider),
  );
}
